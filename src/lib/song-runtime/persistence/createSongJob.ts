/**
 * persistence/createSongJob.ts
 *
 * Creates a generation_jobs row before provider submission.
 * Persistence-first: job record exists before any network call.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { SongPlan } from "../types";

export async function createSongJob(args: {
  generationId: string;
  workspaceId: string;
  plan: SongPlan;
  requestPayload: Record<string, unknown>;
}): Promise<string> {
  const admin = createAdminClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error } = await admin.from("generation_jobs").insert({
    id,
    generation_id: args.generationId,
    workspace_id: args.workspaceId,
    media_type: "song",
    provider: args.plan.provider,
    model: args.plan.model,
    phase: "submit",
    status: "pending",
    request_payload: {
      ...args.requestPayload,
      mode: args.plan.mode,
      durationSeconds: args.plan.durationSeconds,
      outputFormat: args.plan.outputFormat,
      requireStems: args.plan.requireStems,
      sectionCount: args.plan.sections.length,
    },
    created_at: now,
    updated_at: now,
  });

  if (error) {
    throw new Error(`SONG_JOB_INSERT_FAILED: ${error.message}`);
  }

  return id;
}
