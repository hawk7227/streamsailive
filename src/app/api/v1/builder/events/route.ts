import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { DurableWorkspaceStateError } from "@/lib/streams-builder/durable-workspace-state";
import { normalizeBuilderEventCursor } from "@/lib/streams-builder/versioned-builder-api-contract";
import { VersionedBuilderWorkspaceResources } from "@/lib/streams-builder/versioned-workspace-resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resources = new VersionedBuilderWorkspaceResources();

function failure(error: unknown) {
  if (error instanceof DurableWorkspaceStateError) {
    return NextResponse.json({ ok: false, apiVersion: "v1", error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown builder events error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const afterSequence = normalizeBuilderEventCursor(request.nextUrl.searchParams.get("afterSequence"));
    if (afterSequence == null) {
      return NextResponse.json({ ok: false, apiVersion: "v1", error: "afterSequence must be a non-negative number" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, apiVersion: "v1", ...(await resources.events(scope, { projectId, afterSequence })) });
  } catch (error) {
    return failure(error);
  }
}
