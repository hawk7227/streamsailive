import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";
import { sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "@/lib/streams-ai/protected-reasoning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  return streamsAISchema(createStreamsAIServiceClient());
}

function metadata(row: any) {
  const value = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    ...value,
    projectFiles: Array.isArray(value.projectFiles) ? value.projectFiles : [],
    chatIds: Array.isArray(value.chatIds) ? value.chatIds : [],
  };
}

function normalize(row: any) {
  const meta = metadata(row);
  return {
    id: String(row?.id || ""),
    name: String(row?.name || meta.name || "Default STREAMS AI project"),
    instructions: String(meta.instructions || ""),
    files: meta.projectFiles,
    chatIds: meta.chatIds,
    storageUsedBytes: meta.projectFiles.reduce((sum: number, file: any) => sum + Number(file?.sizeBytes || file?.size_bytes || 0), 0),
    builderWorkspaceSummary: meta.builderWorkspaceSummary || null,
    builderWorkspaceRevision: Number(meta.builderWorkspaceRevision || 0),
    createdAt: row?.created_at || meta.createdAt || null,
    updatedAt: row?.updated_at || meta.updatedAt || null,
    metadata: meta,
  };
}

async function ownedProject(scope: Awaited<ReturnType<typeof requireStreamsAIScope>>, projectId: string) {
  const { data, error } = await db().from(streamsAITables.projects).select("*")
    .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", projectId).maybeSingle();
  if (error) throw new Error(`Failed to read STREAMS AI project: ${error.message}`);
  return data || null;
}

function failure(error: unknown, status = 500) {
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown projects error" }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (projectId) {
      const project = await ownedProject(scope, projectId);
      if (!project) return failure(new Error("Project not found"), 404);
      return NextResponse.json({ ok: true, apiVersion: "v1", project: normalize(project) });
    }
    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 50)));
    const { data, error } = await db().from(streamsAITables.projects).select("*")
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId)
      .order("updated_at", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
    if (error) throw new Error(`Failed to list STREAMS AI projects: ${error.message}`);
    return NextResponse.json({ ok: true, apiVersion: "v1", projects: (data || []).map(normalize), nextCursor: null });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({})) as { name?: string; instructions?: string; metadata?: Record<string, unknown> };
    const name = sanitizeStreamsAIText(String(body.name || "Untitled StreamsAI project"), 200).trim();
    const now = new Date().toISOString();
    const nextMetadata = sanitizeStreamsAIPayload({
      ...(body.metadata || {}),
      instructions: sanitizeStreamsAIText(String(body.instructions || ""), 8000),
      projectFiles: [],
      chatIds: [],
      createdAt: now,
      updatedAt: now,
    });
    const { data, error } = await db().from(streamsAITables.projects).insert({
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      name,
      metadata: nextMetadata,
      updated_at: now,
    }).select("*").single();
    if (error) throw new Error(`Failed to create STREAMS AI project: ${error.message}`);
    return NextResponse.json({ ok: true, apiVersion: "v1", project: normalize(data) }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({})) as { projectId?: string; name?: string; instructions?: string; metadata?: Record<string, unknown> };
    const projectId = String(body.projectId || scope.defaultProjectId || "").trim();
    if (!projectId) return failure(new Error("projectId is required"), 400);
    const current = await ownedProject(scope, projectId);
    if (!current) return failure(new Error("Project not found"), 404);
    const now = new Date().toISOString();
    const currentMetadata = metadata(current);
    const patch: Record<string, unknown> = {
      metadata: sanitizeStreamsAIPayload({
        ...currentMetadata,
        ...(body.metadata || {}),
        ...(typeof body.instructions === "string" ? { instructions: sanitizeStreamsAIText(body.instructions, 8000) } : {}),
        updatedAt: now,
      }),
      updated_at: now,
    };
    if (body.name?.trim()) patch.name = sanitizeStreamsAIText(body.name, 200).trim();
    const { data, error } = await db().from(streamsAITables.projects).update(patch)
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", projectId).select("*").single();
    if (error) throw new Error(`Failed to update STREAMS AI project: ${error.message}`);
    return NextResponse.json({ ok: true, apiVersion: "v1", project: normalize(data) });
  } catch (error) {
    return failure(error);
  }
}
