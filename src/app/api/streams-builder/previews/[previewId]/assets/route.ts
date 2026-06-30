import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { createStreamsAIServiceClient, streamsAISchema } from "@/lib/streams-ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() { return streamsAISchema(createStreamsAIServiceClient()); }
function clean(value: unknown, max = 200) { return String(value || "").slice(0, max); }

async function withAssets(scope: Awaited<ReturnType<typeof requireStreamsAIScope>>, links: Record<string, any>[]) {
  const ids = links.map((link) => link.asset_id).filter(Boolean);
  if (!ids.length) return links.map((link) => ({ ...link, asset: null }));
  const { data } = await db().from("streams_ai_assets").select("*").eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).in("id", ids);
  const byId = new Map((data || []).map((asset) => [asset.id, asset]));
  return links.map((link) => ({ ...link, asset: byId.get(link.asset_id) || null }));
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ previewId: string }> }) {
  try {
    const scope = await requireStreamsAIScope(request);
    const { previewId } = await params;
    const { data, error } = await db().from("streams_ai_preview_assets").select("*").eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("preview_id", previewId).order("created_at", { ascending: false });
    if (error) throw error;
    return streamsAIJson({ ok: true, assets: await withAssets(scope, data || []) });
  } catch (error) { return streamsAIError(error); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ previewId: string }> }) {
  try {
    const scope = await requireStreamsAIScope(request);
    const { previewId } = await params;
    const body = await readJsonBody<{ assetId?: string; sessionId?: string | null; projectId?: string | null; builderRunId?: string | null; workspaceId?: string | null; role?: string; metadata?: Record<string, unknown> }>(request);
    if (!body.assetId) return streamsAIJson({ ok: false, error: "assetId is required" }, 400);
    const { data, error } = await db().from("streams_ai_preview_assets").upsert({
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      project_id: body.projectId || scope.defaultProjectId || null,
      session_id: body.sessionId || null,
      preview_id: previewId,
      builder_run_id: body.builderRunId || null,
      workspace_id: body.workspaceId || scope.workspaceId || null,
      asset_id: body.assetId,
      role: clean(body.role || "reference", 60),
      metadata: body.metadata || {},
    }, { onConflict: "tenant_id,user_id,preview_id,asset_id" }).select("*").single();
    if (error) throw error;
    const [previewAsset] = await withAssets(scope, [data]);
    return streamsAIJson({ ok: true, previewAsset }, 201);
  } catch (error) { return streamsAIError(error); }
}
