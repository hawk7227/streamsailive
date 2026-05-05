import { NextResponse } from "next/server";
import { resolveStreamsRouteContext } from "@/lib/streams/test-mode-auth";
import { decidePreviewPlacement } from "@/lib/streams/artifacts/artifact-contract";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { body = {}; }

  const ctx = await resolveStreamsRouteContext({ request, body, requireWorkspace: false, allowTestMode: true });
  if (!ctx?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const artifactType = typeof body.type === "string" ? body.type : "document";
  const decision = decidePreviewPlacement({
    type: artifactType as never,
    subtype: typeof body.subtype === "string" ? body.subtype : null,
    mime: typeof body.mime === "string" ? body.mime : null,
  });

  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : ctx.workspaceId ?? "streams-public-test";

  const { data, error } = await ctx.admin
    .from("streams_preview_state")
    .insert({
      user_id: ctx.userId,
      workspace_id: workspaceId,
      session_id: typeof body.sessionId === "string" ? body.sessionId : null,
      artifact_id: typeof body.artifactId === "string" ? body.artifactId : null,
      placement: decision.placement,
      active_tab: decision.activeTab,
      reason: decision.reason,
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, preview: decision, testMode: ctx.isTestMode }, { status: 201 });
}
