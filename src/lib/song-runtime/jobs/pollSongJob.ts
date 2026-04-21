/**
 * jobs/pollSongJob.ts
 *
 * Polls a song job for real completion status.
 * When completed: uploads final audio artifact, uploads stems if present,
 * creates artifact records, finalizes generation record.
 * When failed: persists failure. When processing: updates status truthfully.
 *
 * Rules:
 * - Never marks complete without a real durable storage URL
 * - Never exposes temporary provider URLs as canonical artifacts
 * - Partial stem failure does not abort finalization of the primary artifact
 */

import { updateSongJob } from "../persistence/updateSongJob";
import { finalizeSongArtifact } from "../persistence/finalizeSongArtifact";
import { uploadSongArtifact } from "../storage/uploadSongArtifact";
import { uploadStemArtifacts } from "../storage/uploadStemArtifacts";
import { pollSunoSong } from "../providers/suno";
import { pollUdioSong } from "../providers/udio";
import type { SongJobRow, SongJobStatus, SongProviderStatusResult } from "../types";

async function dispatchPoll(job: SongJobRow): Promise<SongProviderStatusResult> {
  if (!job.provider_job_id) {
    return {
      provider: job.provider,
      providerJobId: "",
      status: "failed",
      raw: "No provider_job_id recorded on job",
    };
  }

  if (job.provider === "suno") return pollSunoSong(job.provider_job_id);
  if (job.provider === "udio") return pollUdioSong(job.provider_job_id);

  return {
    provider: job.provider,
    providerJobId: job.provider_job_id,
    status: "failed",
    raw: `Unknown provider: ${job.provider}`,
  };
}

export async function pollSongJob(
  job: SongJobRow,
): Promise<{ status: SongJobStatus; artifactUrl?: string }> {
  if (!job.provider_job_id) {
    await updateSongJob(job.id, {
      status: "failed",
      error: "Cannot poll: no provider_job_id on job record",
    });
    return { status: "failed" };
  }

  const statusResult = await dispatchPoll(job);

  // Still in progress
  if (statusResult.status === "queued" || statusResult.status === "processing") {
    await updateSongJob(job.id, {
      status: "processing",
      responsePayload: statusResult.raw as Record<string, unknown>,
    });
    return { status: "processing" };
  }

  // Provider reported failure
  if (statusResult.status === "failed" || !statusResult.outputUrl) {
    await updateSongJob(job.id, {
      status: "failed",
      error: "Provider reported failure or returned no output URL",
      responsePayload: statusResult.raw as Record<string, unknown>,
    });
    return { status: "failed" };
  }

  // Completed — upload to durable storage before finalizing
  let storageUrl: string;
  let mimeType: string;
  try {
    const uploaded = await uploadSongArtifact(statusResult.outputUrl, job.workspace_id);
    storageUrl = uploaded.storageUrl;
    mimeType = uploaded.mimeType;
  } catch (uploadErr) {
    const reason = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
    await updateSongJob(job.id, {
      status: "failed",
      error: `Storage upload failed: ${reason}`,
      responsePayload: statusResult.raw as Record<string, unknown>,
    });
    return { status: "failed" };
  }

  // Upload stems if provider returned them
  const stems = statusResult.stemUrls?.length
    ? await uploadStemArtifacts(statusResult.stemUrls, job.workspace_id)
    : [];

  // Fetch conversation_id and prompt from generation record for artifact linkage
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminInst = createAdminClient();
  const { data: genRow } = await adminInst
    .from("generations")
    .select("conversation_id, prompt")
    .eq("id", job.generation_id)
    .single();

  const songGenRow = genRow as { conversation_id?: string | null; prompt?: string | null } | null;

  // Finalize — creates artifact records and marks generation+job complete
  await finalizeSongArtifact({
    generationId: job.generation_id,
    jobId: job.id,
    workspaceId: job.workspace_id,
    storageUrl,
    mimeType,
    stems: stems.length > 0 ? stems : undefined,
    conversationId: songGenRow?.conversation_id ?? undefined,
    title: songGenRow?.prompt ? songGenRow.prompt.slice(0, 200) : undefined,
  });

  return { status: "completed", artifactUrl: storageUrl };
}
