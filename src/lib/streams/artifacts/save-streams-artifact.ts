import type { createAdminClient } from "@/lib/supabase/admin";
import { decidePreviewPlacement, type StreamsArtifactType } from "@/lib/streams/artifacts/artifact-contract";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export async function saveStreamsArtifactRecord(opts: {
  admin: SupabaseAdmin;
  userId: string;
  workspaceId: string;
  sessionId?: string | null;
  type: StreamsArtifactType;
  subtype?: string | null;
  title: string;
  mime?: string | null;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  storagePath?: string | null;
  sourceTool?: string | null;
  createdByChat?: boolean;
  createdByTab?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const previewDecision = decidePreviewPlacement({
    type: opts.type,
    subtype: opts.subtype ?? null,
    mime: opts.mime ?? null,
  });

  const artifactPayload = {
    user_id: opts.userId,
    workspace_id: opts.workspaceId,
    session_id: opts.sessionId ?? null,
    type: opts.type,
    subtype: opts.subtype ?? null,
    title: opts.title,
    mime: opts.mime ?? null,
    preview_url: opts.previewUrl ?? null,
    download_url: opts.downloadUrl ?? opts.previewUrl ?? null,
    storage_path: opts.storagePath ?? null,
    source_tool: opts.sourceTool ?? null,
    created_by_chat: Boolean(opts.createdByChat),
    created_by_tab: opts.createdByTab ?? null,
    status: "ready",
    metadata: {
      ...(opts.metadata ?? {}),
      previewDecision,
    },
  };

  const { data, error } = await opts.admin
    .from("streams_artifacts")
    .insert(artifactPayload)
    .select("*")
    .single();

  if (error) {
    return { ok: false as const, error: error.message, previewDecision };
  }

  return { ok: true as const, artifact: data, previewDecision };
}
