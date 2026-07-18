import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { DurableWorkspaceStateError } from "@/lib/streams-builder/durable-workspace-state";
import { VersionedBuilderWorkspaceResources } from "@/lib/streams-builder/versioned-workspace-resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resources = new VersionedBuilderWorkspaceResources();

function failure(error: unknown) {
  if (error instanceof DurableWorkspaceStateError) {
    return NextResponse.json({ ok: false, apiVersion: "v1", error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown builder checkpoint error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const current = await resources.read(scope, request.nextUrl.searchParams.get("projectId"));
    const checkpoints = Array.isArray(current.snapshot.workspace.checkpoints)
      ? current.snapshot.workspace.checkpoints
      : [];
    return NextResponse.json({
      ok: true,
      apiVersion: "v1",
      projectId: current.projectId,
      jobId: current.jobId,
      revision: current.snapshot.revision,
      activeCheckpointId: current.snapshot.workspace.activeCheckpointId || current.snapshot.draft?.checkpointId || null,
      checkpoints,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({})) as {
      projectId?: string;
      expectedRevision?: number;
      idempotencyKey?: string;
      checkpointId?: string;
      verificationJobId?: string;
    };
    return NextResponse.json({ ok: true, apiVersion: "v1", ...(await resources.createCheckpoint(scope, body)) });
  } catch (error) {
    return failure(error);
  }
}
