import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { createStreamsAIServiceClient, streamsAISchema } from "@/lib/streams-ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  return streamsAISchema(createStreamsAIServiceClient());
}

function clean(value: unknown, max = 20000) {
  return String(value || "").slice(0, max);
}

function defaultPreviewHtml(title = "Streams Preview") {
  const safeTitle = clean(title, 120).replace(/[&<>]/g, "");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Inter,system-ui;background:#070b18;color:#f8fbff}main{width:min(760px,calc(100vw - 40px));border:1px solid rgba(255,255,255,.14);border-radius:28px;background:rgba(255,255,255,.08);padding:34px}h1{margin:0 0 10px;font-size:52px;line-height:.94}p{color:#a9b8d9;line-height:1.55}</style></head><body><main><h1>${safeTitle}</h1><p>Streams Builder preview is ready.</p></main></body></html>`;
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{ title?: string; type?: string; sessionId?: string | null; projectId?: string | null; sourceCode?: string; previewHtml?: string; status?: string; metadata?: Record<string, unknown> }>(request);
    const title = clean(body.title || "Streams Builder Preview", 180);
    const sourceCode = clean(body.sourceCode || body.previewHtml || "", 200000);
    const previewHtml = clean(body.previewHtml || body.sourceCode || defaultPreviewHtml(title), 240000);
    const now = new Date().toISOString();

    const { data: preview, error } = await db().from("streams_ai_previews").insert({
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      project_id: body.projectId || scope.defaultProjectId || null,
      session_id: body.sessionId || null,
      title,
      type: clean(body.type || "html", 40),
      source_code: sourceCode,
      preview_html: previewHtml,
      status: body.status || "ready",
      metadata: { ...(body.metadata || {}), source: "streams-ai-chat-controller" },
      created_at: now,
      updated_at: now,
    }).select("*").single();
    if (error) throw error;

    const { data: version, error: versionError } = await db().from("streams_ai_preview_versions").insert({
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      preview_id: preview.id,
      version_number: 1,
      source_code: sourceCode,
      preview_html: previewHtml,
      metadata: { source: "initial-preview-create" },
      created_at: now,
    }).select("*").single();
    if (versionError) throw versionError;
    await db().from("streams_ai_previews").update({ active_version_id: version.id }).eq("id", preview.id);

    return streamsAIJson({ ok: true, preview: { ...preview, active_version_id: version.id }, version, previewUrl: `/streams-builder/preview/${preview.id}` }, 201);
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    let query = db().from("streams_ai_previews").select("*").eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).order("updated_at", { ascending: false }).limit(20);
    if (sessionId) query = query.eq("session_id", sessionId);
    const { data, error } = await query;
    if (error) throw error;
    return streamsAIJson({ ok: true, previews: data || [] });
  } catch (error) {
    return streamsAIError(error);
  }
}
