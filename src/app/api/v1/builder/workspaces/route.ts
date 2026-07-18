import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import {
  DurableBuilderWorkspaceStateRepository,
  DurableWorkspaceStateError,
  type SaveDurableBuilderWorkspaceInput,
} from "@/lib/streams-builder/durable-workspace-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const workspaces = new DurableBuilderWorkspaceStateRepository();

function failure(error: unknown) {
  if (error instanceof DurableWorkspaceStateError) {
    return NextResponse.json({ ok: false, apiVersion: "v1", error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown builder workspace error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    return NextResponse.json({ ok: true, apiVersion: "v1", ...(await workspaces.read(scope, projectId)) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  return PATCH(request);
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({})) as SaveDurableBuilderWorkspaceInput;
    return NextResponse.json({ ok: true, apiVersion: "v1", ...(await workspaces.save(scope, body)) });
  } catch (error) {
    return failure(error);
  }
}
