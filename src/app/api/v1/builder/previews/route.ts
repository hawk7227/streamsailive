import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { DurableWorkspaceStateError } from "@/lib/streams-builder/durable-workspace-state";
import { VersionedBuilderWorkspaceResources } from "@/lib/streams-builder/versioned-workspace-resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resources = new VersionedBuilderWorkspaceResources();
const PREVIEW_STATES = ["queued", "building", "succeeded", "failed"] as const;

function safePreviewUrl(value?: string | null) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname.endsWith(".vercel.app") || url.hostname.endsWith("streamsailive.com") || url.hostname.endsWith("streams.ai"));
  } catch {
    return false;
  }
}

function failure(error: unknown) {
  if (error instanceof DurableWorkspaceStateError) {
    return NextResponse.json({ ok: false, apiVersion: "v1", error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown builder preview error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const current = await resources.read(scope, request.nextUrl.searchParams.get("projectId"));
    const draft = current.snapshot.draft;
    return NextResponse.json({
      ok: true,
      apiVersion: "v1",
      projectId: current.projectId,
      jobId: current.jobId,
      revision: current.snapshot.revision,
      preview: draft
        ? {
            previewId: draft.previewId || null,
            status: draft.previewBuildState || null,
            previewUrl: draft.previewUrl || null,
            previewBranch: draft.previewBranch || null,
            deploymentId: draft.deploymentId || null,
            deploymentUrl: draft.deploymentUrl || null,
            checkpointId: draft.checkpointId || null,
            lastError: draft.lastError || null,
          }
        : null,
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
      preview?: {
        previewId?: string;
        status?: typeof PREVIEW_STATES[number];
        previewUrl?: string;
        previewBranch?: string;
        deploymentId?: string;
        deploymentUrl?: string;
        checkpointId?: string;
        lastError?: string;
      };
    };
    if (!body.preview || typeof body.preview !== "object") {
      return NextResponse.json({ ok: false, apiVersion: "v1", error: "preview is required" }, { status: 400 });
    }
    if (body.preview.status && !PREVIEW_STATES.includes(body.preview.status)) {
      return NextResponse.json({ ok: false, apiVersion: "v1", error: `preview.status must be ${PREVIEW_STATES.join(", ")}` }, { status: 400 });
    }
    if (!safePreviewUrl(body.preview.previewUrl) || !safePreviewUrl(body.preview.deploymentUrl)) {
      return NextResponse.json({ ok: false, apiVersion: "v1", error: "preview URLs must be approved HTTPS preview hosts" }, { status: 400 });
    }
    const current = await resources.read(scope, body.projectId);
    const saved = await resources.saveDraft(scope, {
      projectId: current.projectId,
      expectedRevision: body.expectedRevision ?? current.snapshot.revision,
      idempotencyKey: body.idempotencyKey,
      draft: {
        ...(current.snapshot.draft || {}),
        previewId: body.preview.previewId,
        previewBuildState: body.preview.status,
        previewUrl: body.preview.previewUrl,
        previewBranch: body.preview.previewBranch,
        deploymentId: body.preview.deploymentId,
        deploymentUrl: body.preview.deploymentUrl,
        checkpointId: body.preview.checkpointId,
        lastError: body.preview.lastError,
      },
    });
    return NextResponse.json({ ok: true, apiVersion: "v1", ...saved });
  } catch (error) {
    return failure(error);
  }
}
