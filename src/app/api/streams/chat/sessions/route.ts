import { NextResponse } from "next/server";
import { resolveStreamsRouteContext } from "@/lib/streams/test-mode-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveStreamsRouteContext({ request, requireWorkspace: false, allowTestMode: true });
  if (!ctx?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = ctx.workspaceId ?? "streams-public-test";
  const { data, error } = await ctx.admin
    .from("streams_chat_sessions")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], testMode: ctx.isTestMode });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { body = {}; }

  const ctx = await resolveStreamsRouteContext({ request, body, requireWorkspace: false, allowTestMode: true });
  if (!ctx?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : ctx.workspaceId ?? "streams-public-test";
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New conversation";

  const { data, error } = await ctx.admin
    .from("streams_chat_sessions")
    .insert({
      user_id: ctx.userId,
      workspace_id: workspaceId,
      title,
      active_tab: typeof body.activeTab === "string" ? body.activeTab : "chat",
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, testMode: ctx.isTestMode }, { status: 201 });
}
