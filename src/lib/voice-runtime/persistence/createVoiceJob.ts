import { createAdminClient } from "@/lib/supabase/admin";
export async function createVoiceJob(args: { generationId: string; workspaceId: string; provider: string; model: string | null; requestPayload: Record<string, unknown> }): Promise<string> {
  const admin = createAdminClient();
  const id = crypto.randomUUID();
  const { error } = await admin.from("generation_jobs").insert({
    id, generation_id: args.generationId, workspace_id: args.workspaceId,
    media_type: "voice", provider: args.provider, model: args.model,
    phase: "submit", status: "pending", request_payload: args.requestPayload,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("VOICE_JOB_INSERT_FAILED: " + error.message);
  return id;
}
