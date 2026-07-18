import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { DurableWorkspaceStateError, type DurableBuilderDraft } from "@/lib/streams-builder/durable-workspace-state";
import { VersionedBuilderWorkspaceResources } from "@/lib/streams-builder/versioned-workspace-resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resources = new VersionedBuilderWorkspaceResources();

function failure(error: unknown) {
  if (error instanceof DurableWorkspaceStateError) {
    return NextResponse.json({ ok: false, apiVersion: "v1", error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown builder draft error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const current = await resources.read(scope, request.nextUrl.searchParams.get("projectId"));
    return NextResponse.json({ ok: true, apiVersion: "v1", projectId: current.projectId, jobId: current.jobId, revision: current.snapshot.revision, draft: current.snapshot.draft });
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
      draft?: DurableBuilderDraft;
    };
    if (!body.draft || typeof body.draft !== "object") {
      return NextResponse.json({ ok: false, apiVersion: "v1", error: "draft is required" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, apiVersion: "v1", ...(await resources.saveDraft(scope, { projectId: body.projectId, expectedRevision: body.expectedRevision, idempotencyKey: body.idempotencyKey, draft: body.draft })) });
  } catch (error) {
    return failure(error);
  }
}
