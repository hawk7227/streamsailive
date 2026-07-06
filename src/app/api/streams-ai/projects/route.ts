import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProjectFile = {
  id?: string;
  assetId?: string;
  name?: string;
  kind?: string;
  mimeType?: string;
  sizeBytes?: number;
  storageUrl?: string;
  previewUrl?: string;
  url?: string;
  pdfNote?: string;
  createdAt?: string;
};

type ProjectPatchBody = {
  projectId?: string;
  name?: string;
  instructions?: string;
  files?: ProjectFile[];
  chatIds?: string[];
  moveSessionId?: string;
  removeFileId?: string;
  clearFiles?: boolean;
};

function db() {
  return streamsAISchema(createStreamsAIServiceClient());
}

function nowIso() {
  return new Date().toISOString();
}

function safeMetadata(row: any) {
  const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const projectFiles = Array.isArray(metadata.projectFiles) ? metadata.projectFiles : [];
  const chatIds = Array.isArray(metadata.chatIds) ? metadata.chatIds : [];
  return { ...metadata, projectFiles, chatIds };
}

function normalizeProject(row: any) {
  const metadata = safeMetadata(row);
  return {
    id: row?.id || "",
    name: row?.name || metadata.name || "Default STREAMS AI project",
    instructions: String(metadata.instructions || ""),
    files: metadata.projectFiles,
    chatIds: metadata.chatIds,
    storageUsedBytes: metadata.projectFiles.reduce((sum: number, file: any) => sum + Number(file?.sizeBytes || file?.size_bytes || 0), 0),
    createdAt: row?.created_at || metadata.createdAt || null,
    updatedAt: row?.updated_at || metadata.updatedAt || null,
    metadata,
  };
}

async function ensureProject(scope: Awaited<ReturnType<typeof requireStreamsAIScope>>, projectId?: string | null) {
  const targetId = projectId || scope.defaultProjectId || "";
  if (targetId) {
    const { data, error } = await db()
      .from(streamsAITables.projects)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", targetId)
      .maybeSingle();
    if (error) throw new Error(`Failed to read STREAMS AI project: ${error.message}`);
    if (data) return data;
  }

  const { data: existing, error: existingError } = await db()
    .from(streamsAITables.projects)
    .select("*")
    .eq("tenant_id", scope.tenantId)
    .eq("user_id", scope.userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(`Failed to resolve STREAMS AI project: ${existingError.message}`);
  if (existing) return existing;

  const { data: created, error: createError } = await db()
    .from(streamsAITables.projects)
    .insert({ tenant_id: scope.tenantId, user_id: scope.userId, name: "Default STREAMS AI project", metadata: { instructions: "", projectFiles: [], chatIds: [], createdAt: nowIso() } })
    .select("*")
    .single();
  if (createError || !created) throw new Error(`Failed to create STREAMS AI project: ${createError?.message || "unknown error"}`);
  return created;
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const list = request.nextUrl.searchParams.get("list") === "true";

    if (list) {
      const { data, error } = await db()
        .from(streamsAITables.projects)
        .select("*")
        .eq("tenant_id", scope.tenantId)
        .eq("user_id", scope.userId)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to list STREAMS AI projects: ${error.message}`);
      return streamsAIJson({ ok: true, projects: (data || []).map(normalizeProject), project: data?.[0] ? normalizeProject(data[0]) : null });
    }

    const project = await ensureProject(scope, projectId);
    return streamsAIJson({ ok: true, project: normalizeProject(project) });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  return PATCH(request);
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<ProjectPatchBody>(request);
    const project = await ensureProject(scope, body.projectId);
    const metadata = safeMetadata(project);

    const nextFiles = body.clearFiles
      ? []
      : body.removeFileId
        ? metadata.projectFiles.filter((file: any) => String(file?.id || file?.assetId || "") !== String(body.removeFileId))
        : Array.isArray(body.files)
          ? [...body.files, ...metadata.projectFiles].filter((file: any, index: number, all: any[]) => {
              const id = String(file?.id || file?.assetId || file?.url || file?.name || index);
              return all.findIndex((entry: any, entryIndex: number) => String(entry?.id || entry?.assetId || entry?.url || entry?.name || entryIndex) === id) === index;
            }).slice(0, 250)
          : metadata.projectFiles;

    const nextChatIds = body.moveSessionId
      ? Array.from(new Set([...(metadata.chatIds || []), body.moveSessionId]))
      : Array.isArray(body.chatIds)
        ? Array.from(new Set(body.chatIds.filter(Boolean)))
        : metadata.chatIds;

    const nextMetadata = {
      ...metadata,
      instructions: typeof body.instructions === "string" ? body.instructions : metadata.instructions || "",
      projectFiles: nextFiles,
      chatIds: nextChatIds,
      storageUsedBytes: nextFiles.reduce((sum: number, file: any) => sum + Number(file?.sizeBytes || file?.size_bytes || 0), 0),
      updatedAt: nowIso(),
    };

    const patch: Record<string, unknown> = {
      updated_at: nowIso(),
      metadata: nextMetadata,
    };
    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();

    const { data, error } = await db()
      .from(streamsAITables.projects)
      .update(patch)
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", project.id)
      .select("*")
      .single();
    if (error) throw new Error(`Failed to update STREAMS AI project: ${error.message}`);

    if (body.moveSessionId) {
      const { data: sessionRow } = await db()
        .from(streamsAITables.chatSessions)
        .select("metadata")
        .eq("tenant_id", scope.tenantId)
        .eq("user_id", scope.userId)
        .eq("id", body.moveSessionId)
        .maybeSingle();
      const sessionMetadata = sessionRow?.metadata && typeof sessionRow.metadata === "object" ? sessionRow.metadata : {};
      const { error: sessionError } = await db()
        .from(streamsAITables.chatSessions)
        .update({ project_id: project.id, updated_at: nowIso(), metadata: { ...sessionMetadata, projectId: project.id, movedToProjectAt: nowIso() } })
        .eq("tenant_id", scope.tenantId)
        .eq("user_id", scope.userId)
        .eq("id", body.moveSessionId);
      if (sessionError) throw new Error(`Failed to move chat into project: ${sessionError.message}`);
    }

    return streamsAIJson({ ok: true, project: normalizeProject(data) });
  } catch (error) {
    return streamsAIError(error);
  }
}
