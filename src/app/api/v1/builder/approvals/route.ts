import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { DurableWorkspaceStateError } from "@/lib/streams-builder/durable-workspace-state";
import { VersionedBuilderWorkspaceResources, type BuilderApprovalState } from "@/lib/streams-builder/versioned-workspace-resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resources = new VersionedBuilderWorkspaceResources();

function failure(error: unknown) {
  if (error instanceof DurableWorkspaceStateError) {
    return NextResponse.json({ ok: false, apiVersion: "v1", error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown builder approval error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const current = await resources.read(scope, request.nextUrl.searchParams.get("projectId"));
    return NextResponse.json({
      ok: true,
      apiVersion: "v1",
      projectId: current.projectId,
      jobId: current.jobId,
      revision: current.snapshot.revision,
      approval: current.snapshot.proof?.approval || { status: "not_requested" },
    });
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
    const body = await request.json().catch(() => ({})) as {
      projectId?: string;
      expectedRevision?: number;
      idempotencyKey?: string;
      approval?: Partial<BuilderApprovalState> & { status?: BuilderApprovalState["status"] };
    };
    const status = body.approval?.status;
    if (!status || !["not_requested", "requested", "approved", "rejected"].includes(status)) {
      return NextResponse.json({ ok: false, apiVersion: "v1", error: "approval.status must be not_requested, requested, approved, or rejected" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, apiVersion: "v1", ...(await resources.saveApproval(scope, { projectId: body.projectId, expectedRevision: body.expectedRevision, idempotencyKey: body.idempotencyKey, approval: { ...body.approval, status } })) });
  } catch (error) {
    return failure(error);
  }
}
