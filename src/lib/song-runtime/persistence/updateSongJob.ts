/**
 * persistence/updateSongJob.ts
 *
 * Updates a generation_jobs row at each lifecycle transition.
 * Called at: submit → queued → processing → completed/failed.
 *
 * Rules:
 * - Never marks a job completed unless a real artifact exists (outputUrl required)
 * - Logs update failures but does not throw — partial state is better than crash
 * - All updates set updated_at to now
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { SongJobStatus, SongJobPhase } from "../types";

export async function updateSongJob(
  jobId: string,
  update: {
    status?: SongJobStatus;
    phase?: SongJobPhase;
    providerJobId?: string;
    responsePayload?: Record<string, unknown>;
    outputUrl?: string;
    error?: string;
  },
): Promise<void> {
  // Guard: completed status requires an output URL
  if (update.status === "completed" && !update.outputUrl) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "SONG_JOB_INVALID_COMPLETE",
        jobId,
        reason: "Cannot mark job completed without outputUrl",
      }),
    );
    // Downgrade to failed to avoid false completion
    update.status = "failed";
    update.error = update.error ?? "Completion attempted without a real artifact URL";
  }

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (update.status !== undefined) patch.status = update.status;
  if (update.phase !== undefined) patch.phase = update.phase;
  if (update.providerJobId !== undefined) patch.provider_job_id = update.providerJobId;
  if (update.responsePayload !== undefined) patch.response_payload = update.responsePayload;
  if (update.outputUrl !== undefined) patch.output_url = update.outputUrl;
  if (update.error !== undefined) patch.error = update.error;

  const { error } = await admin
    .from("generation_jobs")
    .update(patch)
    .eq("id", jobId);

  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "SONG_JOB_UPDATE_FAILED",
        jobId,
        reason: error.message,
        attempted: update,
      }),
    );
  }
}
