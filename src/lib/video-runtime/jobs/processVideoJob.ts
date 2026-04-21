/**
 * jobs/processVideoJob.ts
 *
 * Worker entrypoint — queries pending video_jobs and polls each one.
 * Called by the cron route (check-videos) every 2 minutes.
 * Claims jobs from video_jobs table, not from generations directly.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { VideoJobRow } from "../types";
import { pollVideoJob } from "./pollVideoJob";
import { finalizeVideoArtifact } from "../persistence/finalizeVideoArtifact";
import { uploadVideoArtifact } from "../storage/uploadVideoArtifact";
import { updateVideoJob } from "../persistence/updateVideoJob";
import { stitchLongformVideo } from "../longform/stitchLongformVideo";

const CHUNK_SIZE = 10;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * After a clip job completes, check if all sibling clips for the same
 * parent are done. If so, trigger stitching.
 */
async function resolveParentIfReady(
  admin: ReturnType<typeof createAdminClient>,
  parentJobId: string,
  workspaceId: string,
): Promise<void> {
  const { data: siblings, error } = await admin
    .from("video_jobs")
    .select("id, status, output_url, clip_index")
    .eq("parent_job_id", parentJobId)
    .order("clip_index", { ascending: true });

  if (error || !siblings?.length) return;

  const allDone = siblings.every((s) => s.status === "completed" && s.output_url);
  if (!allDone) return;

  // All clips complete — get parent job for generation_id
  const { data: parentJob } = await admin
    .from("video_jobs")
    .select("id, generation_id, workspace_id")
    .eq("id", parentJobId)
    .single();
  if (!parentJob) return;

  // Collect clip URLs in order
  const clipUrls: string[] = (siblings as Array<{ clip_index: number | null; output_url: string | null }>)
    .sort((a, b) => (a.clip_index ?? 0) - (b.clip_index ?? 0))
    .map((s) => s.output_url)
    .filter((url): url is string => !!url);

  if (clipUrls.length === 0) return;

  const stitchResult = await stitchLongformVideo(clipUrls);

  if (stitchResult.status === "failed") {
    console.error(JSON.stringify({ level: "error", event: "STITCH_FAILED", parentJobId, reason: stitchResult.reason }));
    await updateVideoJob(parentJobId, { status: "failed", error: stitchResult.reason });
    return;
  }

  // Upload stitched video
  let storageUrl: string;
  let mimeType: string;
  try {
    const uploaded = await uploadVideoArtifact(stitchResult.outputUrl, workspaceId);
    storageUrl = uploaded.storageUrl;
    mimeType = uploaded.mimeType;
  } catch (uploadErr) {
    const reason = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
    console.error(JSON.stringify({ level: "error", event: "STITCH_UPLOAD_FAILED", parentJobId, reason }));
    await updateVideoJob(parentJobId, { status: "failed", error: reason });
    return;
  }

  await finalizeVideoArtifact({
    generationId: parentJob.generation_id,
    jobId: parentJobId,
    workspaceId,
    storageUrl,
    mimeType,
  });

  console.log(JSON.stringify({ level: "info", event: "LONG_VIDEO_STITCHED", parentJobId, clipCount: clipUrls.length, storageUrl }));
}

export async function processVideoPendingJobs(): Promise<{
  checked: number;
  completed: number;
  failed: number;
  processing: number;
}> {
  const admin = createAdminClient();

  const { data: jobs, error } = await admin
    .from("video_jobs")
    .select("id, generation_id, parent_job_id, workspace_id, provider, model, provider_job_id, clip_index, phase, status, request_payload, response_payload, output_url, error, created_at, updated_at")
    .in("status", ["pending", "queued", "processing"])
    .not("provider_job_id", "is", null)
    .is("parent_job_id", null) // Only leaf clip jobs — parent tracking rows are resolved separately
    .order("created_at", { ascending: true })
    .limit(100);

  if (error || !jobs?.length) {
    return { checked: 0, completed: 0, failed: 0, processing: 0 };
  }

  // Also get longform clip jobs (those with a parent_job_id but not themselves parents)
  const { data: clipJobs } = await admin
    .from("video_jobs")
    .select("id, generation_id, parent_job_id, workspace_id, provider, model, provider_job_id, clip_index, phase, status, request_payload, response_payload, output_url, error, created_at, updated_at")
    .in("status", ["pending", "queued", "processing"])
    .not("provider_job_id", "is", null)
    .not("parent_job_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(100);

  const allJobs = [...(jobs as VideoJobRow[]), ...((clipJobs ?? []) as VideoJobRow[])];
  if (allJobs.length === 0) return { checked: 0, completed: 0, failed: 0, processing: 0 };

  let completed = 0;
  let failed = 0;
  let processing = 0;

  // Track which parent jobs need sibling checking
  const completedClipParents = new Map<string, string>(); // parentJobId → workspaceId

  for (const batch of chunk(allJobs, CHUNK_SIZE)) {
    const results = await Promise.allSettled(
      batch.map((job) => pollVideoJob(job).then((result) => ({ job, result }))),
    );

    for (const settled of results) {
      if (settled.status === "rejected") {
        failed++;
        continue;
      }
      const { job, result } = settled.value;
      if (result.status === "completed") {
        completed++;
        // If this is a clip job, mark its parent for sibling checking
        if (job.parent_job_id) {
          completedClipParents.set(job.parent_job_id, job.workspace_id);
        }
      } else if (result.status === "failed") {
        failed++;
      } else {
        processing++;
      }
    }
  }

  // After all polls: check if any parent jobs can now be stitched
  for (const [parentJobId, workspaceId] of completedClipParents) {
    await resolveParentIfReady(admin, parentJobId, workspaceId).catch((err) =>
      console.error(JSON.stringify({
        level: "error",
        event: "RESOLVE_PARENT_FAILED",
        parentJobId,
        reason: err instanceof Error ? err.message : String(err),
      })),
    );
  }

  return { checked: allJobs.length, completed, failed, processing };
}
