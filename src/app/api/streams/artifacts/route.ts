import { NextResponse } from "next/server";
import { resolveStreamsRouteContext } from "@/lib/streams/test-mode-auth";
import { decidePreviewPlacement } from "@/lib/streams/artifacts/artifact-contract";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveStreamsRouteContext({ request, requireWorkspace: false, allowTestMode: true });
  if (!ctx?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId") ?? ctx.workspaceId ?? "streams-public-test";
  const sessionId = url.searchParams.get("sessionId");
  const type = url.searchParams.get("type");

  let q = ctx.admin
    .from("streams_artifacts")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (sessionId) q = q.eq("session_id", sessionId);
  if (type) q = q.eq("type", type);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [], testMode: ctx.isTestMode });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { body = {}; }

  const ctx = await resolveStreamsRouteContext({ request, body, requireWorkspace: false, allowTestMode: true });
  if (!ctx?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = typeof body.type === "string" ? body.type : null;
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
  if (!type || !title) return NextResponse.json({ error: "type and title are required" }, { status: 400 });

  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : ctx.workspaceId ?? "streams-public-test";
  const decision = decidePreviewPlacement({
    type: type as never,
    subtype: typeof body.subtype === "string" ? body.subtype : null,
    mime: typeof body.mime === "string" ? body.mime : null,
  });

  const { data, error } = await ctx.admin
    .from("streams_artifacts")
    .insert({
      user_id: ctx.userId,
      workspace_id: workspaceId,
      session_id: typeof body.sessionId === "string" ? body.sessionId : null,
      type,
      subtype: typeof body.subtype === "string" ? body.subtype : null,
      title,
      mime: typeof body.mime === "string" ? body.mime : null,
      preview_url: typeof body.previewUrl === "string" ? body.previewUrl : null,
      download_url: typeof body.downloadUrl === "string" ? body.downloadUrl : null,
      storage_path: typeof body.storagePath === "string" ? body.storagePath : null,
      source_tool: typeof body.sourceTool === "string" ? body.sourceTool : null,
      created_by_chat: Boolean(body.createdByChat),
      created_by_tab: typeof body.createdByTab === "string" ? body.createdByTab : null,
      metadata: {
        ...(typeof body.metadata === "object" && body.metadata ? body.metadata : {}),
        previewDecision: decision,
      },
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, preview: decision, testMode: ctx.isTestMode }, { status: 201 });
}
