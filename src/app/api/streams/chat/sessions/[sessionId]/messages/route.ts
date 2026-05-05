import { NextResponse } from "next/server";
import { resolveStreamsRouteContext } from "@/lib/streams/test-mode-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(request: Request, context: Params): Promise<NextResponse> {
  const { sessionId } = await context.params;
  const ctx = await resolveStreamsRouteContext({ request, requireWorkspace: false, allowTestMode: true });
  if (!ctx?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("streams_chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], testMode: ctx.isTestMode });
}

export async function POST(request: Request, context: Params): Promise<NextResponse> {
  const { sessionId } = await context.params;

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { body = {}; }

  const ctx = await resolveStreamsRouteContext({ request, body, requireWorkspace: false, allowTestMode: true });
  if (!ctx?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : ctx.workspaceId ?? "streams-public-test";
  const role = typeof body.role === "string" ? body.role : "user";
  const content = typeof body.content === "string" ? body.content : "";

  const { data, error } = await ctx.admin
    .from("streams_chat_messages")
    .insert({
      session_id: sessionId,
      user_id: ctx.userId,
      workspace_id: workspaceId,
      role,
      content,
      artifact_ids: Array.isArray(body.artifactIds) ? body.artifactIds : [],
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await ctx.admin
    .from("streams_chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", ctx.userId);

  return NextResponse.json({ data, testMode: ctx.isTestMode }, { status: 201 });
}
