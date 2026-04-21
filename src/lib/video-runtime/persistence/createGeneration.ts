/**
 * persistence/createGeneration.ts
 * Creates the user-visible generation record before provider execution.
 * Persistence-first: if this fails, no provider job is submitted.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { NormalizedVideoRequest, VideoPlan } from "../types";

const SENTINEL_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function createGenerationRecord(
  req: NormalizedVideoRequest,
  plan: VideoPlan,
): Promise<string> {
  const admin = createAdminClient();
  const id = crypto.randomUUID();
  const { error } = await admin.from("generations").insert({
    id,
    user_id: SENTINEL_USER_ID,
    workspace_id: req.workspaceId,
    type: req.mode === "image_to_video" ? "i2v" : "video",
    prompt: req.prompt,
    status: "pending",
    provider: plan.provider,
    model: plan.model,
    mode: "assistant",
    conversation_id: req.conversationId ?? null,
    metadata: {
      normalizedRequest: req,
      clipCount: plan.clips.length,
      requiresStitching: plan.requiresStitching,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("GENERATION_INSERT_FAILED: " + error.message);
  console.log(JSON.stringify({ level: "info", event: "GENERATION_CREATED", generationId: id, mode: req.mode, provider: plan.provider, clipCount: plan.clips.length }));
  return id;
}
