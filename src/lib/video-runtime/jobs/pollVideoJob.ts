import { createAdminClient } from "@/lib/supabase/admin";
/**
 * jobs/pollVideoJob.ts
 *
 * Polls a single provider clip job for completion.
 *
 * Critical long-form rule:
 * - A child clip job can complete and store its durable clip URL.
 * - Only the parent stitch job is allowed to mark the user-visible generation
 *   completed with the final stitched movie URL.
 */

import { updateVideoJob } from "../persistence/updateVideoJob";
import { finalizeVideoArtifact } from "../persistence/finalizeVideoArtifact";
import { uploadVideoArtifact } from "../storage/uploadVideoArtifact";
import { pollFalVideo } from "../providers/fal";
import { pollKlingVideo } from "../providers/kling";
import { pollRunwayVideo } from "../providers/runway";
import { pollVeoVideo } from "../providers/veo";
import { isExternalVideoProvider, pollExternalConfiguredVideo } from "../providers/externalConfigured";
import type { VideoJobRow, VideoJobStatus, VideoProviderStatusResult } from "../types";

async function dispatchPoll(job: VideoJobRow): Promise<VideoProviderStatusResult> {
  const id = job.provider_job_id;
  if (!id) {
    return { provider: job.provider, providerJobId: "", status: "failed", raw: "missing provider_job_id" };
  }

  if (job.provider === "fal") return pollFalVideo(id);
  if (job.provider === "kling") {
    const genType = job.request_payload?.mode === "image_to_video" ? "i2v" : "video";
    return pollKlingVideo(id, genType);
  }
  if (job.provider === "runway") return pollRunwayVideo(id);
  if (job.provider === "veo") return pollVeoVideo(id);
  if (isExternalVideoProvider(job.provider)) return pollExternalConfiguredVideo(job.provider, id);

  return { provider: job.provider, providerJobId: id, status: "failed", raw: "unknown provider" };
}

async function createClipArtifact(args: {
  generationId: string;
  jobId: string;
  parentJobId: string;
  workspaceId: string;
  storageUrl: string;
  mimeType: string;
  clipIndex: number | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("artifacts").insert({
    id: crypto.randomUUID(),
    generation_id: args.generationId,
    workspace_id: args.workspaceId,
    type: "video",
    media_type: "video_clip",
    storage_url: args.storageUrl,
    mime_type: args.mimeType,
    metadata: {
      jobId: args.jobId,
      parentJobId: args.parentJobId,
      clipIndex: args.clipIndex,
      role: "longform_clip",
    },
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "CLIP_ARTIFACT_INSERT_FAILED",
      generationId: args.generationId,
      jobId: args.jobId,
      reason: error.message,
    }));
  }
}

export async function pollVideoJob(
  job: VideoJobRow,
): Promise<{ status: VideoJobStatus; outputUrl?: string }> {
  if (!job.provider_job_id) {
    await updateVideoJob(job.id, { status: "failed", error: "No provider_job_id — cannot poll" });
    return { status: "failed" };
  }

  const statusResult = await dispatchPoll(job);
  const raw = (statusResult.raw && typeof statusResult.raw === "object")
    ? (statusResult.raw as Record<string, unknown>)
    : { raw: statusResult.raw };

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

  if (job.parent_job_id) {
    await createClipArtifact({
      generationId: job.generation_id,
      jobId: job.id,
      parentJobId: job.parent_job_id,
      workspaceId: job.workspace_id,
      storageUrl,
      mimeType,
      clipIndex: job.clip_index,
    });
    await updateVideoJob(job.id, {
      status: "completed",
      phase: "finalize",
      outputUrl: storageUrl,
      responsePayload: raw,
    });
    return { status: "completed", outputUrl: storageUrl };
  }

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
