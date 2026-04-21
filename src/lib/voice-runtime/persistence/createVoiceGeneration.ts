import { createAdminClient } from "@/lib/supabase/admin";
import type { NormalizedVoiceRequest, VoicePlan } from "../types";
const SENTINEL_USER_ID = "00000000-0000-0000-0000-000000000000";
export async function createVoiceGeneration(req: NormalizedVoiceRequest, plan: VoicePlan): Promise<string> {
  const admin = createAdminClient();
  const id = crypto.randomUUID();
  const { error } = await admin.from("generations").insert({
    id, user_id: SENTINEL_USER_ID, workspace_id: req.workspaceId,
    type: "voice", prompt: req.text.slice(0, 500), status: "pending",
    provider: plan.provider, model: plan.model, mode: "assistant",
    metadata: { voice: req.voice, speed: req.speed, format: req.format, isMultiSegment: req.isMultiSegment },
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("VOICE_GENERATION_INSERT_FAILED: " + error.message);
  return id;
}
