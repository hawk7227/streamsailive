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

function inferType(source: string) {
  if (/<svg[\s>]/i.test(source)) return "svg";
  if (/export\s+default|className=|React\./.test(source)) return "react";
  return "html";
}

function asPreviewHtml(source: string) {
  const value = source.trim();
  if (/<!doctype html|<html[\s>]/i.test(value)) return value;
  if (/<svg[\s>]/i.test(value)) return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#090b12">${value}</body></html>`;
  if (/<[a-z][\s\S]*>/i.test(value) && !/export\s+default|className=/.test(value)) return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>${value}</body></html>`;
  return value;
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{ title?: string; type?: string; sessionId?: string | null; projectId?: string | null; sourceCode?: string; previewHtml?: string; status?: string; metadata?: Record<string, unknown> }>(request);
    const title = clean(body.title || "Streams Builder Preview", 180);
    const sourceCode = clean(body.sourceCode || "", 200000);
    const requestedPreviewHtml = clean(body.previewHtml || "", 240000);
    const hasRealPreview = Boolean(sourceCode.trim() || requestedPreviewHtml.trim());
    if (!hasRealPreview) return streamsAIJson({ ok: false, error: "Real preview source is required. Empty or placeholder previews are not created." }, 400);
    const previewHtml = requestedPreviewHtml.trim() ? requestedPreviewHtml : asPreviewHtml(sourceCode);
    const now = new Date().toISOString();

    const { data: preview, error } = await db().from("streams_ai_previews").insert({
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      project_id: body.projectId || scope.defaultProjectId || null,
      session_id: body.sessionId || null,
      title,
      type: clean(body.type || inferType(sourceCode || previewHtml), 40),
      source_code: sourceCode,
      preview_html: previewHtml,
      status: body.status || "ready",
      metadata: { ...(body.metadata || {}), source: "streams-ai-chat-controller", canonical: true, placeholder: false },
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
      metadata: { source: "initial-preview-create", placeholder: false },
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
