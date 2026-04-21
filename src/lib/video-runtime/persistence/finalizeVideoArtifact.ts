/**
 * persistence/finalizeVideoArtifact.ts
 * Creates artifact record and marks generation + job completed.
 * Always called with a durable storage URL — never a provider URL.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export async function finalizeVideoArtifact(args: {
  generationId: string;
  jobId: string;
  workspaceId: string;
  storageUrl: string;
  mimeType: string;
  conversationId?: string;
}): Promise<string> {
  const admin = createAdminClient();
  const artifactId = crypto.randomUUID();

  const { error: artifactError } = await admin.from("artifacts").insert({
    id: artifactId,
    generation_id: args.generationId,
    workspace_id: args.workspaceId,
    conversation_id: args.conversationId ?? null,
    type: "video",
    storage_url: args.storageUrl,
    mime_type: args.mimeType,
    metadata: { jobId: args.jobId },
    created_at: new Date().toISOString(),
  });
  if (artifactError) {
    console.error(JSON.stringify({ level: "error", event: "ARTIFACT_INSERT_FAILED", generationId: args.generationId, reason: artifactError.message }));
  }

  // Update generation to completed
  await admin.from("generations").update({
    status: "completed",
    output_url: args.storageUrl,
    updated_at: new Date().toISOString(),
  }).eq("id", args.generationId);

  // Update job to completed
  await admin.from("video_jobs").update({
    status: "completed",
    output_url: args.storageUrl,
    phase: "finalize",
    updated_at: new Date().toISOString(),
  }).eq("id", args.jobId);

  console.log(JSON.stringify({ level: "info", event: "ARTIFACT_FINALIZED", artifactId, generationId: args.generationId, storageUrl: args.storageUrl }));
  return artifactId;
}
