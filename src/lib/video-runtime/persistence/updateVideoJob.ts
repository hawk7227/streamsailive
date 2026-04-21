/**
 * persistence/updateVideoJob.ts
 * Updates a video_jobs row. Logs failures — does not throw.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { VideoJobStatus, VideoJobPhase } from "../types";

export async function updateVideoJob(
  jobId: string,
  update: {
    status?: VideoJobStatus;
    phase?: VideoJobPhase;
    providerJobId?: string;
    responsePayload?: Record<string, unknown>;
    outputUrl?: string;
    error?: string;
  },
): Promise<void> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.status !== undefined) patch.status = update.status;
  if (update.phase !== undefined) patch.phase = update.phase;
  if (update.providerJobId !== undefined) patch.provider_job_id = update.providerJobId;
  if (update.responsePayload !== undefined) patch.response_payload = update.responsePayload;
  if (update.outputUrl !== undefined) patch.output_url = update.outputUrl;
  if (update.error !== undefined) patch.error = update.error;

  const { error } = await admin.from("video_jobs").update(patch).eq("id", jobId);
  if (error) {
    console.error(JSON.stringify({ level: "error", event: "VIDEO_JOB_UPDATE_FAILED", jobId, reason: error.message }));
  }
}
