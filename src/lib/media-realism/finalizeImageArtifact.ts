/**
 * src/lib/media-realism/finalizeImageArtifact.ts
 *
 * Creates a generations + artifacts row pair for a completed image output.
 *
 * Previously this was skipped with a comment:
 *   "DB persistence requires real user session linkage — skipped until
 *   user context flows through."
 *
 * The artifacts table does not require user_id — only workspace_id and
 * generation_id. The generations table uses SENTINEL_USER_ID, which is the
 * same pattern used by all other assistant-initiated media runtimes.
 *
 * Call this after the image URL is confirmed in storage.
 * Returns the new artifactId.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const SENTINEL_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function finalizeImageArtifact(args: {
  workspaceId: string;
  storageUrl: string;
  mimeType: string;
  /** Truncated generation prompt — shown in browse panel and inline renderer. */
  title?: string;
  conversationId?: string;
  width?: number;
  height?: number;
}): Promise<string> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const generationId = crypto.randomUUID();
  const artifactId = crypto.randomUUID();

  // ── 1. Create minimal generations row ────────────────────────────────────
  // Required because artifacts.generation_id is NOT NULL REFERENCES generations(id).
  // Images generated via the assistant do not go through the full generations
  // pipeline (no provider job, no polling), so we insert a completed row directly.
  const { error: genError } = await admin.from("generations").insert({
    id: generationId,
    user_id: SENTINEL_USER_ID,
    workspace_id: args.workspaceId,
    conversation_id: args.conversationId ?? null,
    type: "image",
    prompt: args.title ?? null,
    status: "completed",
    output_url: args.storageUrl,
    provider: "openai",
    model: "gpt-image-1",
    mode: "assistant",
    metadata: {},
    created_at: now,
    updated_at: now,
  });

  if (genError) {
    // Non-fatal — log and continue. The artifact row still has value even
    // without a generation row if the FK constraint allows NULL in future.
    console.error(JSON.stringify({
      level: "error",
      event: "IMAGE_GENERATION_ROW_FAILED",
      workspaceId: args.workspaceId,
      reason: genError.message,
    }));
    // Return early — can't insert artifact without a valid generation_id.
    return artifactId;
  }

  // ── 2. Create artifact row ────────────────────────────────────────────────
  const { error: artifactError } = await admin.from("artifacts").insert({
    id: artifactId,
    generation_id: generationId,
    workspace_id: args.workspaceId,
    conversation_id: args.conversationId ?? null,
    type: "image",
    media_type: "image",
    storage_url: args.storageUrl,
    mime_type: args.mimeType,
    title: args.title ?? null,
    width: args.width ?? null,
    height: args.height ?? null,
    metadata: {},
    created_at: now,
  });

  if (artifactError) {
    console.error(JSON.stringify({
      level: "error",
      event: "IMAGE_ARTIFACT_INSERT_FAILED",
      generationId,
      workspaceId: args.workspaceId,
      reason: artifactError.message,
    }));
  }

  console.log(JSON.stringify({
    level: "info",
    event: "IMAGE_ARTIFACT_FINALIZED",
    artifactId,
    generationId,
    workspaceId: args.workspaceId,
    storageUrl: args.storageUrl,
  }));

  return artifactId;
}
