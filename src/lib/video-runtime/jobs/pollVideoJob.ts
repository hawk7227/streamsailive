import { createAdminClient } from "@/lib/supabase/admin";
/**
 * jobs/pollVideoJob.ts
 *
 * Polls a single video_jobs row for completion.
 * On success: uploads to Supabase storage, creates artifact, finalizes records.
 * Returns the job's new status.
 */

import { updateVideoJob } from "../persistence/updateVideoJob";
import { finalizeVideoArtifact } from "../persistence/finalizeVideoArtifact";
import { uploadVideoArtifact } from "../storage/uploadVideoArtifact";
import { pollFalVideo } from "../providers/fal";
import { pollKlingVideo } from "../providers/kling";
import { pollRunwayVideo } from "../providers/runway";
import type { VideoJobRow, VideoJobStatus, VideoProviderStatusResult } from "../types";

async function dispatchPoll(job: VideoJobRow): Promise<VideoProviderStatusResult> {
  const id = job.provider_job_id;
  // provider_job_id is checked by caller before this runs
  if (!id) {
    return { provider: job.provider, providerJobId: "", status: "failed", raw: "missing provider_job_id" };
  }

  if (job.provider === "fal") return pollFalVideo(id);
  if (job.provider === "kling") {
    const genType = job.clip_index !== null ? "video" : "i2v";
    return pollKlingVideo(id, genType);
  }
  if (job.provider === "runway") return pollRunwayVideo(id);

  return { provider: job.provider, providerJobId: id, status: "failed", raw: "unknown provider" };
}

export async function pollVideoJob(
  job: VideoJobRow,
): Promise<{ status: VideoJobStatus; outputUrl?: string }> {
  if (!job.provider_job_id) {
    await updateVideoJob(job.id, { status: "failed", error: "No provider_job_id — cannot poll" });
    return { status: "failed" };
  }

  const statusResult = await dispatchPoll(job);
  const raw = statusResult.raw as Record<string, unknown>;

  if (statusResult.status === "processing" || statusResult.status === "queued") {
    await updateVideoJob(job.id, { status: "processing", responsePayload: raw });
    return { status: "processing" };
  }

  if (statusResult.status === "failed" || !statusResult.outputUrl) {
    await updateVideoJob(job.id, {
      status: "failed",
      error: "Provider reported failure or returned no output URL",
      responsePayload: raw,
    });
    return { status: "failed" };
  }

  // Upload to durable storage
  let storageUrl: string;
  let mimeType: string;
  try {
    const uploaded = await uploadVideoArtifact(statusResult.outputUrl, job.workspace_id);
    storageUrl = uploaded.storageUrl;
    mimeType = uploaded.mimeType;
  } catch (uploadErr) {
    const reason = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
    await updateVideoJob(job.id, { status: "failed", error: reason });
    return { status: "failed" };
  }

  // Fetch conversation_id and prompt from generation record for artifact linkage
  const admin2 = createAdminClient();
  const { data: genRow } = await admin2
    .from("generations")
    .select("conversation_id, prompt, type")
    .eq("id", job.generation_id)
    .single();

  const genRowTyped = genRow as {
    conversation_id?: string | null;
    prompt?: string | null;
    type?: string | null;
  } | null;

  // Create artifact record and finalize generation
  await finalizeVideoArtifact({
    generationId: job.generation_id,
    jobId: job.id,
    workspaceId: job.workspace_id,
    storageUrl,
    mimeType,
    conversationId: genRowTyped?.conversation_id ?? undefined,
    title: genRowTyped?.prompt ? genRowTyped.prompt.slice(0, 200) : undefined,
    mediaType: genRowTyped?.type === "i2v" ? "i2v" : "video",
  });

  return { status: "completed", outputUrl: storageUrl };
}
