/**
 * persistence/createVideoJob.ts
 * Creates a video_jobs row before provider submission.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export async function createVideoJob(args: {
  generationId: string;
  parentJobId?: string;
  workspaceId: string;
  provider: string;
  model: string | null;
  clipIndex?: number;
  requestPayload: Record<string, unknown>;
}): Promise<string> {
  const admin = createAdminClient();
  const id = crypto.randomUUID();
  const { error } = await admin.from("video_jobs").insert({
    id,
    generation_id: args.generationId,
    parent_job_id: args.parentJobId ?? null,
    workspace_id: args.workspaceId,
    provider: args.provider,
    model: args.model,
    clip_index: args.clipIndex ?? null,
    phase: "submit",
    status: "pending",
    request_payload: args.requestPayload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("VIDEO_JOB_INSERT_FAILED: " + error.message);
  return id;
}
