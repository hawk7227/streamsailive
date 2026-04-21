/**
 * persistence/finalizeVoiceArtifact.ts
 * Creates artifact record and marks generation + job completed.
 * Always called with a durable storage URL — never a provider URL.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export async function finalizeVoiceArtifact(args: {
  generationId: string;
  jobId: string;
  workspaceId: string;
  storageUrl: string;
  mimeType: string;
  conversationId?: string;
  /** First 200 chars of the TTS input text — shown in browse panel. */
  title?: string;
}): Promise<string> {
  const admin = createAdminClient();
  const artifactId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error: artifactError } = await admin.from("artifacts").insert({
    id: artifactId,
    generation_id: args.generationId,
    workspace_id: args.workspaceId,
    conversation_id: args.conversationId ?? null,
    type: "audio",
    media_type: "voice",
    storage_url: args.storageUrl,
    mime_type: args.mimeType,
    title: args.title ?? null,
    metadata: { jobId: args.jobId },
    created_at: now,
  });

  if (artifactError) {
    console.error(JSON.stringify({
      level: "error",
      event: "VOICE_ARTIFACT_INSERT_FAILED",
      generationId: args.generationId,
      reason: artifactError.message,
    }));
  }

  await admin.from("generations")
    .update({ status: "completed", output_url: args.storageUrl, updated_at: now })
    .eq("id", args.generationId);

  await admin.from("generation_jobs")
    .update({ status: "completed", output_url: args.storageUrl, phase: "finalize", updated_at: now })
    .eq("id", args.jobId);

  console.log(JSON.stringify({
    level: "info",
    event: "VOICE_ARTIFACT_FINALIZED",
    artifactId,
    generationId: args.generationId,
    storageUrl: args.storageUrl,
  }));

  return artifactId;
}
