import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { DurableWorkspaceStateError } from "@/lib/streams-builder/durable-workspace-state";
import { applyLinePatchRequest, type LinePatchOperation } from "@/lib/streams-builder/line-patch-model";
import { RepositoryActionService, repositoryActionError } from "@/lib/streams-builder/repository-action-service";
import { VersionedBuilderWorkspaceResources } from "@/lib/streams-builder/versioned-workspace-resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const repositories = new RepositoryActionService();
const resources = new VersionedBuilderWorkspaceResources();

function failure(error: unknown) {
  if (error instanceof DurableWorkspaceStateError) {
    return NextResponse.json({ ok: false, apiVersion: "v1", error: error.message, code: error.code }, { status: error.status });
  }
  const resolved = repositoryActionError(error);
  return NextResponse.json({ apiVersion: "v1", ...resolved.body }, { status: resolved.status });
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
      patch: current.snapshot.draft
        ? {
            patchState: current.snapshot.draft.patchState || null,
            checkpointId: current.snapshot.draft.checkpointId || null,
            baseSha: current.snapshot.draft.baseSha || null,
            filePath: current.snapshot.draft.filePath || null,
            content: current.snapshot.draft.content || null,
          }
        : null,
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
      repository?: string;
      branch?: string;
      filePath?: string;
      operations?: LinePatchOperation[];
      sourceTruthId?: string;
      checkpointId?: string;
      allowLargeReplacement?: boolean;
    };
    if (!body.repository || !body.branch || !body.filePath || !Array.isArray(body.operations)) {
      return NextResponse.json({ ok: false, apiVersion: "v1", error: "repository, branch, filePath, and operations are required" }, { status: 400 });
    }

    const realFile = await repositories.readFile({ repo: body.repository, branch: body.branch, path: body.filePath });
    const patch = applyLinePatchRequest({
      repository: body.repository,
      branch: body.branch,
      filePath: body.filePath,
      originalContent: realFile.content,
      operations: body.operations,
      sourceTruthId: body.sourceTruthId,
      checkpointId: body.checkpointId,
      allowLargeReplacement: body.allowLargeReplacement,
    });
    if (!patch.ok) {
      return NextResponse.json({ ok: false, apiVersion: "v1", patch }, { status: 409 });
    }

    const saved = await resources.saveDraft(scope, {
      projectId: body.projectId,
      expectedRevision: body.expectedRevision,
      idempotencyKey: body.idempotencyKey,
      draft: {
        repo: body.repository,
        branch: body.branch,
        filePath: body.filePath,
        baseSha: realFile.sha,
        route: realFile.frontendRoute,
        content: patch.nextContent,
        checkpointId: body.checkpointId,
        patchState: "generated",
      },
    });

    return NextResponse.json({
      ok: true,
      apiVersion: "v1",
      projectId: saved.projectId,
      jobId: saved.jobId,
      revision: saved.snapshot?.revision || null,
      baseSha: realFile.sha,
      patch,
    });
  } catch (error) {
    return failure(error);
  }
}
