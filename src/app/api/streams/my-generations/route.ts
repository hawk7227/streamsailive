/**
 * POST /api/streams/my-generations
 *
 * Resume session — get all incomplete generations for the current workspace.
 * Public /streams test mode is allowed only when the request explicitly uses
 * TEST_USER_ID.
 */

import { NextResponse } from "next/server";
import { resolveStreamsRouteContext, isFallbackTestWorkspace } from "@/lib/streams/test-mode-auth";

type RequestBody = {
  userId?: string;
  workspaceId?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = rawBody as RequestBody;
  const ctx = await resolveStreamsRouteContext({
    request,
    body: body as Record<string, unknown>,
    requireWorkspace: false,
    allowTestMode: true,
  });

  if (!ctx?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = body.workspaceId ?? ctx.workspaceId;
  if (!workspaceId || (ctx.isTestMode && isFallbackTestWorkspace(workspaceId))) {
    return NextResponse.json({ activeJobs: [], bulkJobs: [], testMode: ctx.isTestMode, persisted: false });
  }

  const { data: activeJobs, error: jobsError } = await ctx.admin
    .from("generation_jobs")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", workspaceId)
    .in("status", ["queued", "processing"]);

  if (jobsError) {
    return NextResponse.json({ error: "Failed to fetch active jobs" }, { status: 500 });
  }

  const { data: activeBulkJobs, error: bulkError } = await ctx.admin
    .from("bulk_jobs")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", workspaceId)
    .in("status", ["queued", "processing"]);

  if (bulkError) {
    return NextResponse.json({ error: "Failed to fetch bulk jobs" }, { status: 500 });
  }

  return NextResponse.json({
    activeJobs: activeJobs ?? [],
    bulkJobs: activeBulkJobs ?? [],
    testMode: ctx.isTestMode,
    persisted: true,
  });
}
