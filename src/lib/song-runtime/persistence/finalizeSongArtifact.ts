/**
 * persistence/finalizeSongArtifact.ts
 *
 * Writes the final artifact record and marks the generation and job complete.
 * Only runs after durable storage upload is confirmed — never before.
 *
 * May write multiple artifact records:
 * - Primary: the full song mix
 * - Stems: vocals, instrumental, drums, bass, other (if provider returned them)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { UploadedStem } from "../types";

export async function finalizeSongArtifact(args: {
  generationId: string;
  jobId: string;
  workspaceId: string;
  storageUrl: string;
  mimeType: string;
  durationSeconds?: number;
  stems?: UploadedStem[];
  conversationId?: string;
}): Promise<string> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const artifactId = crypto.randomUUID();

  // Primary artifact — the full mix
  const { error: artifactError } = await admin.from("artifacts").insert({
    id: artifactId,
    generation_id: args.generationId,
    workspace_id: args.workspaceId,
    conversation_id: args.conversationId ?? null,
    type: "audio",
    storage_url: args.storageUrl,
    mime_type: args.mimeType,
    duration_seconds: args.durationSeconds ?? null,
    metadata: {
      mediaType: "song",
      jobId: args.jobId,
      stemCount: args.stems?.length ?? 0,
    },
    created_at: now,
  });

  if (artifactError) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "SONG_ARTIFACT_INSERT_FAILED",
        generationId: args.generationId,
        reason: artifactError.message,
      }),
    );
  }

  // Stem artifacts — one row per stem
  if (args.stems?.length) {
    const stemRows = args.stems.map((stem) => ({
      id: crypto.randomUUID(),
      generation_id: args.generationId,
      workspace_id: args.workspaceId,
      type: "audio",
      storage_url: stem.storageUrl,
      mime_type: stem.mimeType,
      metadata: {
        mediaType: "song_stem",
        stemKind: stem.kind,
        parentArtifactId: artifactId,
        jobId: args.jobId,
      },
      created_at: now,
    }));

    const { error: stemsError } = await admin.from("artifacts").insert(stemRows);
    if (stemsError) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "SONG_STEM_ARTIFACTS_INSERT_FAILED",
          generationId: args.generationId,
          reason: stemsError.message,
        }),
      );
    }
  }

  // Mark generation completed with durable URL
  await admin
    .from("generations")
    .update({
      status: "completed",
      output_url: args.storageUrl,
      updated_at: now,
    })
    .eq("id", args.generationId);

  // Mark job finalized
  await admin
    .from("generation_jobs")
    .update({
      status: "completed",
      output_url: args.storageUrl,
      phase: "finalize",
      updated_at: now,
    })
    .eq("id", args.jobId);

  console.log(
    JSON.stringify({
      level: "info",
      event: "SONG_ARTIFACT_FINALIZED",
      artifactId,
      generationId: args.generationId,
      storageUrl: args.storageUrl,
      stemCount: args.stems?.length ?? 0,
    }),
  );

  return artifactId;
}
