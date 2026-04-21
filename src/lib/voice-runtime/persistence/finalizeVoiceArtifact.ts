import { createAdminClient } from "@/lib/supabase/admin";
export async function finalizeVoiceArtifact(args: { generationId: string; jobId: string; workspaceId: string; storageUrl: string; mimeType: string; conversationId?: string }): Promise<string> {
  const admin = createAdminClient();
  const artifactId = crypto.randomUUID();
  await admin.from("artifacts").insert({
    id: artifactId, generation_id: args.generationId, workspace_id: args.workspaceId,
    conversation_id: args.conversationId ?? null,
    type: "audio", storage_url: args.storageUrl, mime_type: args.mimeType,
    metadata: { jobId: args.jobId }, created_at: new Date().toISOString(),
  }).then(() => {});
  await admin.from("generations").update({ status: "completed", output_url: args.storageUrl, updated_at: new Date().toISOString() }).eq("id", args.generationId);
  await admin.from("generation_jobs").update({ status: "completed", output_url: args.storageUrl, phase: "finalize", updated_at: new Date().toISOString() }).eq("id", args.jobId);
  return artifactId;
}
