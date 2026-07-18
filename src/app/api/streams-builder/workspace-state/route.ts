import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import {
  DurableBuilderWorkspaceStateRepository,
  DurableWorkspaceStateError,
  type SaveDurableBuilderWorkspaceInput,
} from "@/lib/streams-builder/durable-workspace-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const workspaceState = new DurableBuilderWorkspaceStateRepository();

function workspaceStateError(error: unknown) {
  if (error instanceof DurableWorkspaceStateError) {
    return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
  }
  return streamsAIError(error);
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const result = await workspaceState.read(scope, projectId);
    return streamsAIJson({ ok: true, ...result });
  } catch (error) {
    return workspaceStateError(error);
  }
}

export async function POST(request: NextRequest) {
  return PATCH(request);
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = (await request.json().catch(() => ({}))) as SaveDurableBuilderWorkspaceInput;
    const result = await workspaceState.save(scope, body);
    return streamsAIJson({ ok: true, ...result });
  } catch (error) {
    return workspaceStateError(error);
  }
}
