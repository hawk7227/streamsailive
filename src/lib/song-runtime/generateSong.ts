/**
 * src/lib/song-runtime/generateSong.ts
 *
 * THE single public gate for all song generation.
 *
 * Every song entrypoint must call this function:
 * - assistant tools (generate_song)
 * - /api/audio/generate-song route
 * - pipeline/test controls
 * - any future song generation UI
 *
 * Flow:
 *   input
 *   → normalizeSongRequest()
 *   → resolveSongProvider()        — throws if no provider configured
 *   → validateSongRequest()        — throws SongRuntimeError on violation
 *   → buildSongPlan()
 *   → createSongGeneration()       — persistence-first: generation record
 *   → createSongJob()              — persistence-first: job record
 *   → submitSongJob()              — dispatches to provider transport
 *   → if synchronous completion:
 *       pollSongJob()              — uploads artifact, finalizes records
 *   → return GenerateSongResult
 *
 * Sync vs async providers:
 * - Suno and Udio may return the audio URL immediately or queue the job.
 * - If the submit result is "completed" with an output URL, pollSongJob is called
 *   immediately to upload and finalize.
 * - If the result is "queued" or "processing", the gate returns status: "queued"
 *   and the cron (check-videos route calling processSongPendingJobs) handles completion.
 *
 * This function does NOT:
 * - Contain provider-specific transport logic
 * - Directly upload artifacts (storage layer owns that)
 * - Directly write artifact records (persistence layer owns that)
 * - Return fake completed statuses
 * - Invent provider job IDs
 */

import { normalizeSongRequest } from "./normalizeSongRequest";
import { validateSongRequest } from "./validateSongRequest";
import { buildSongPlan } from "./buildSongPlan";
import { resolveSongProvider } from "./resolveSongProvider";
import { createSongGeneration } from "./persistence/createSongGeneration";
import { createSongJob } from "./persistence/createSongJob";
import { updateSongJob } from "./persistence/updateSongJob";
import { submitSongJob } from "./jobs/submitSongJob";
import { pollSongJob } from "./jobs/pollSongJob";
import type { GenerateSongInput, GenerateSongResult, SongJobRow } from "./types";
import { createAdminClient } from "@/lib/supabase/admin";

export { SongRuntimeError } from "./types";

async function markGenerationFailed(generationId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from("generations")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", generationId);
  } catch {
    // Ignore — best effort
  }
}

export async function generateSong(
  input: GenerateSongInput,
): Promise<GenerateSongResult> {
  // 1. Normalize — clean, typed request
  const req = normalizeSongRequest(input);

  // 2. Resolve provider — throws SongRuntimeError if no provider is configured
  const resolved = resolveSongProvider(req);
  const normalizedReq = { ...req, provider: resolved.provider, model: resolved.model };

  // 3. Validate — throws SongRuntimeError on any governance violation
  validateSongRequest(normalizedReq);

  // 4. Build a structured song plan
  const plan = buildSongPlan(normalizedReq);

  // 5. Create generation record (persistence-first)
  let generationId: string;
  try {
    generationId = await createSongGeneration(normalizedReq, plan);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({ level: "error", event: "SONG_GENERATION_RECORD_FAILED", reason }),
    );
    return {
      ok: false,
      generationId: "",
      jobId: "",
      status: "failed",
      provider: resolved.provider,
      model: resolved.model,
      error: reason,
    };
  }

  // 6. Create job record (persistence-first)
  let jobId: string;
  try {
    jobId = await createSongJob({
      generationId,
      workspaceId: normalizedReq.workspaceId,
      plan,
      requestPayload: {
        prompt: normalizedReq.prompt,
        instrumental: normalizedReq.instrumental,
        genre: normalizedReq.genre,
        mood: normalizedReq.mood,
        tempo: normalizedReq.tempo,
        outputFormat: normalizedReq.outputFormat,
        requireStems: normalizedReq.requireStems,
      },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({ level: "error", event: "SONG_JOB_RECORD_FAILED", generationId, reason }),
    );
    await markGenerationFailed(generationId);
    return {
      ok: false,
      generationId,
      jobId: "",
      status: "failed",
      provider: resolved.provider,
      model: resolved.model,
      error: reason,
    };
  }

  // 7. Submit job to provider transport (via jobs layer, not directly)
  const submitResult = await submitSongJob({ jobId, generationId, req: normalizedReq, plan });

  if (!submitResult.accepted) {
    await markGenerationFailed(generationId);
    return {
      ok: false,
      generationId,
      jobId,
      status: "failed",
      provider: resolved.provider,
      model: resolved.model,
      externalJobId: submitResult.providerJobId ?? undefined,
      error: "Provider rejected job submission",
    };
  }

  // 8. If the provider completed synchronously (returned audio URL immediately),
  //    run poll immediately to upload to durable storage and finalize records.
  if (submitResult.status === "completed" && submitResult.outputUrl) {
    // Build a minimal SongJobRow to pass to pollSongJob
    const syntheticJobRow: SongJobRow = {
      id: jobId,
      generation_id: generationId,
      workspace_id: normalizedReq.workspaceId,
      media_type: "song",
      provider: resolved.provider,
      model: resolved.model,
      provider_job_id: submitResult.providerJobId,
      phase: "poll",
      status: "processing",
      request_payload: {},
      response_payload: submitResult.raw as Record<string, unknown>,
      output_url: submitResult.outputUrl,
      error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const pollResult = await pollSongJob(syntheticJobRow);

    return {
      ok: pollResult.status === "completed",
      generationId,
      jobId,
      status: pollResult.status === "completed" ? "completed" : "failed",
      provider: resolved.provider,
      model: resolved.model,
      artifactUrl: pollResult.artifactUrl,
      externalJobId: submitResult.providerJobId ?? undefined,
    };
  }

  // 9. Provider returned queued/processing — return accepted status.
  //    The cron (processSongPendingJobs) will complete this job.
  return {
    ok: true,
    generationId,
    jobId,
    status: submitResult.status === "queued" ? "queued" : "processing",
    provider: resolved.provider,
    model: resolved.model,
    externalJobId: submitResult.providerJobId ?? undefined,
  };
}
