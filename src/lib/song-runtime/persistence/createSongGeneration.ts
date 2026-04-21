/**
 * persistence/createSongGeneration.ts
 *
 * Creates the top-level generation record before any provider call.
 * Persistence-first: if this write fails, no job is submitted.
 * Stores the normalized request and plan as metadata for traceability.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { NormalizedSongRequest, SongPlan } from "../types";

const SENTINEL_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function createSongGeneration(
  req: NormalizedSongRequest,
  plan: SongPlan,
): Promise<string> {
  const admin = createAdminClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error } = await admin.from("generations").insert({
    id,
    user_id: SENTINEL_USER_ID,
    workspace_id: req.workspaceId,
    conversation_id: req.conversationId ?? null,
    type: "song",
    prompt: req.prompt.slice(0, 500),
    status: "pending",
    provider: plan.provider,
    model: plan.model,
    mode: "assistant",
    metadata: {
      normalizedRequest: {
        instrumental: req.instrumental,
        durationSeconds: req.durationSeconds,
        genre: req.genre,
        mood: req.mood,
        tempo: req.tempo,
        outputFormat: req.outputFormat,
        requireStems: req.requireStems,
        voiceStyle: req.voiceStyle,
      },
      plan: {
        mode: plan.mode,
        styleSummary: plan.styleSummary,
        sectionCount: plan.sections.length,
        requireStems: plan.requireStems,
      },
    },
    created_at: now,
    updated_at: now,
  });

  if (error) {
    throw new Error(`SONG_GENERATION_INSERT_FAILED: ${error.message}`);
  }

  console.log(
    JSON.stringify({
      level: "info",
      event: "SONG_GENERATION_CREATED",
      generationId: id,
      provider: plan.provider,
      mode: plan.mode,
      durationSeconds: plan.durationSeconds,
    }),
  );

  return id;
}
