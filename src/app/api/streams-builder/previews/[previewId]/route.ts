import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { createStreamsAIServiceClient, streamsAISchema } from "@/lib/streams-ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serviceClient() { return createStreamsAIServiceClient(); }
function db() { return streamsAISchema(serviceClient()); }
function clean(value: unknown, max = 240000) { return String(value || "").slice(0, max); }

async function signedUrl(asset: Record<string, any>) {
  const bucket = asset.storage_bucket || asset.storageBucket;
  const path = asset.storage_path || asset.storagePath;
  if (!bucket || !path) return asset.public_url || asset.publicUrl || asset.url || "";
  try {
    const { data } = await serviceClient().storage.from(bucket).createSignedUrl(path, 60 * 60);
    return data?.signedUrl || asset.public_url || asset.publicUrl || "";
  } catch {
    return asset.public_url || asset.publicUrl || "";
  }
}

async function loadPreviewAssets(scope: Awaited<ReturnType<typeof requireStreamsAIScope>>, previewId: string) {
  const { data: links, error } = await db().from("streams_ai_preview_assets").select("*").eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("preview_id", previewId).order("created_at", { ascending: false });
  if (error) throw error;
  const assetIds = (links || []).map((row) => row.asset_id).filter(Boolean);
  if (!assetIds.length) return [];
  const { data: assets } = await db().from("streams_ai_assets").select("*").eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).in("id", assetIds);
  const byId = new Map((assets || []).map((asset) => [asset.id, asset]));
  return Promise.all((links || []).map(async (link) => {
    const asset = byId.get(link.asset_id) || null;
    const url = asset ? await signedUrl(asset) : "";
    return { ...link, asset: asset ? { ...asset, signedUrl: url, previewUrl: url, url } : null };
  }));
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ previewId: string }> }) {
  try {
    const scope = await requireStreamsAIScope(request);
    const { previewId } = await params;
    const { data: preview, error } = await db().from("streams_ai_previews").select("*").eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", previewId).maybeSingle();
    if (error) throw error;
    if (!preview) return streamsAIJson({ ok: false, error: "Preview not found" }, 404);
    const assets = await loadPreviewAssets(scope, previewId);
    const { data: versions } = await db().from("streams_ai_preview_versions").select("*").eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("preview_id", previewId).order("version_number", { ascending: false }).limit(25);
    return streamsAIJson({ ok: true, preview, assets, versions: versions || [], previewUrl: `/streams-builder/preview/${previewId}` });
  } catch (error) { return streamsAIError(error); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ previewId: string }> }) {
  try {
    const scope = await requireStreamsAIScope(request);
    const { previewId } = await params;
    const body = await readJsonBody<{ title?: string; sourceCode?: string; previewHtml?: string; status?: string; metadata?: Record<string, unknown>; type?: string }>(request);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updated_at: now };
    if (body.title !== undefined) patch.title = clean(body.title, 180);
    if (body.type !== undefined) patch.type = clean(body.type, 40);
    if (body.status !== undefined) patch.status = clean(body.status, 40);
    if (body.sourceCode !== undefined) patch.source_code = clean(body.sourceCode);
    if (body.previewHtml !== undefined) patch.preview_html = clean(body.previewHtml);
    if (body.metadata !== undefined) patch.metadata = body.metadata;

    const { data: preview, error } = await db().from("streams_ai_previews").update(patch).eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", previewId).select("*").single();
    if (error) throw error;

    const { data: latest } = await db().from("streams_ai_preview_versions").select("version_number").eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("preview_id", previewId).order("version_number", { ascending: false }).limit(1).maybeSingle();
    const versionNumber = Number(latest?.version_number || 0) + 1;
    const { data: version } = await db().from("streams_ai_preview_versions").insert({ tenant_id: scope.tenantId, user_id: scope.userId, preview_id: previewId, version_number: versionNumber, source_code: preview.source_code || "", preview_html: preview.preview_html || "", metadata: { source: "preview-patch" }, created_at: now }).select("*").single();
    if (version?.id) await db().from("streams_ai_previews").update({ active_version_id: version.id }).eq("id", previewId);
    return streamsAIJson({ ok: true, preview: { ...preview, active_version_id: version?.id || preview.active_version_id }, version, previewUrl: `/streams-builder/preview/${previewId}` });
  } catch (error) { return streamsAIError(error); }
}
