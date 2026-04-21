/**
 * jobs/submitSongJob.ts
 *
 * Submits the song generation job to the resolved provider.
 * Reads the job and plan from DB, calls the correct provider transport,
 * and persists the provider's response before returning.
 *
 * Responsibilities:
 * - Dispatch to the correct provider transport based on plan.provider
 * - Persist provider job ID and initial status
 * - Return normalized submit result
 *
 * Does NOT:
 * - Choose the provider (resolveVideoProvider owns that)
 * - Upload artifacts
 * - Finalize the generation record
 * - Mark completion without a real artifact
 */

import { updateSongJob } from "../persistence/updateSongJob";
import { submitSunoSong } from "../providers/suno";
import { submitUdioSong } from "../providers/udio";
import type {
  NormalizedSongRequest,
  SongPlan,
  SongProviderSubmitResult,
} from "../types";

export async function submitSongJob(args: {
  jobId: string;
  generationId: string;
  req: NormalizedSongRequest;
  plan: SongPlan;
}): Promise<SongProviderSubmitResult> {
  const { jobId, generationId, req, plan } = args;

  // Mark job as queued before calling provider — ensures state is persisted
  // even if the provider call hangs or the process restarts
  await updateSongJob(jobId, { status: "queued", phase: "submit" });

  let submitResult: SongProviderSubmitResult;

  if (plan.provider === "udio") {
    submitResult = await submitUdioSong(req);
  } else if (plan.provider === "suno") {
    submitResult = await submitSunoSong(req);
  } else {
    // Unknown provider — fail the job immediately, do not leave it pending
    const errMsg = `Unknown song provider: "${plan.provider}"`;
    await updateSongJob(jobId, {
      status: "failed",
      error: errMsg,
      responsePayload: { provider: plan.provider },
    });
    return {
      accepted: false,
      provider: plan.provider,
      providerJobId: null,
      status: "failed",
      raw: errMsg,
    };
  }

  // Persist the provider's response
  if (!submitResult.accepted) {
    await updateSongJob(jobId, {
      status: "failed",
      error: "Provider rejected submission",
      responsePayload: submitResult.raw as Record<string, unknown>,
    });

    console.error(
      JSON.stringify({
        level: "error",
        event: "SONG_JOB_SUBMIT_FAILED",
        jobId,
        generationId,
        provider: plan.provider,
        reason: submitResult.raw,
      }),
    );

    return submitResult;
  }

  // Provider accepted the job
  await updateSongJob(jobId, {
    status: submitResult.status === "completed" ? "completed" : "processing",
    phase: "poll",
    ...(submitResult.providerJobId ? { providerJobId: submitResult.providerJobId } : {}),
    responsePayload: submitResult.raw as Record<string, unknown>,
    // Only set outputUrl if truly completed AND has a real URL
    ...(submitResult.status === "completed" && submitResult.outputUrl
      ? { outputUrl: submitResult.outputUrl }
      : {}),
  });

  console.log(
    JSON.stringify({
      level: "info",
      event: "SONG_JOB_SUBMITTED",
      jobId,
      generationId,
      provider: plan.provider,
      providerJobId: submitResult.providerJobId,
      status: submitResult.status,
    }),
  );

  return submitResult;
}
