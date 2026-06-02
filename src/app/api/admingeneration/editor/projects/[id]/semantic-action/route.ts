import { NextResponse } from "next/server";
import {
  type SemanticEditAction,
  type SemanticEditTarget,
  resolveSemanticEditPlan,
} from "@/lib/admingeneration/editor/semantic-edit-contract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type SemanticActionBody = {
  action?: SemanticEditAction;
  instruction?: string;
  selectedTarget?: SemanticEditTarget | null;
  analysisId?: string | null;
  versionId?: string | null;
};

function internalUrl(request: Request, path: string) {
  return new URL(path, new URL(request.url).origin).toString();
}

async function readBody(response: Response) {
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) return response.json().catch(() => null);
  const text = await response.text().catch(() => "");
  return text ? { text } : null;
}

async function forwardJson(request: Request, path: string, body: unknown) {
  const response = await fetch(internalUrl(request, path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const result = await readBody(response);

  return NextResponse.json(
    {
      ok: response.ok,
      status: response.ok ? "submitted" : "failed",
      routedTo: path,
      result,
    },
    { status: response.status },
  );
}

async function forwardGet(request: Request, path: string) {
  const response = await fetch(internalUrl(request, path), { cache: "no-store" });
  const result = await readBody(response);

  return NextResponse.json(
    {
      ok: response.ok,
      status: response.ok ? "loaded" : "failed",
      routedTo: path,
      result,
    },
    { status: response.status },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await context.params;
  const projectId = params.id;

  if (!projectId) {
    return NextResponse.json({ ok: false, error: "Missing editor project id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as SemanticActionBody | null;

  if (!body?.action) {
    return NextResponse.json({ ok: false, error: "Missing semantic edit action." }, { status: 400 });
  }

  const plan = resolveSemanticEditPlan(projectId, body.action);
  const selectedTarget = body.selectedTarget || null;

  if (plan.requiresSelectedTarget && !selectedTarget) {
    return NextResponse.json(
      {
        ok: false,
        status: "needs_selected_target",
        error: `Action '${body.action}' requires a selected scene, shot, frame, transcript, word, speaker, subject, object, audio, or motion target.`,
        plan,
      },
      { status: 422 },
    );
  }

  if (plan.routeKind === "qa") {
    return forwardGet(request, plan.backendPath);
  }

  if (plan.routeKind === "version_action") {
    const versionAction = body.action.replace("version_", "");
    return forwardJson(request, plan.backendPath, {
      action: versionAction,
      versionId: body.versionId || null,
      selectedTarget,
      analysisId: body.analysisId || null,
      preserveOriginal: true,
      source: "semantic-action-router",
    });
  }

  if (plan.routeKind === "export") {
    return forwardJson(request, plan.backendPath, {
      exportType: "mp4",
      settings: {
        selectedTarget,
        analysisId: body.analysisId || null,
        preserveOriginal: true,
        source: "semantic-action-router",
      },
    });
  }

  if (plan.routeKind === "transcript_edit") {
    return forwardJson(request, plan.backendPath, {
      editedText: body.instruction || selectedTarget?.label || "",
      originalText: selectedTarget?.label || "",
      segmentId: selectedTarget?.segmentId || selectedTarget?.id || null,
      speakerId: selectedTarget?.speakerId || null,
      startSec: selectedTarget?.startSec ?? null,
      endSec: selectedTarget?.endSec ?? null,
      metadata: {
        selectedTarget,
        analysisId: body.analysisId || null,
        preserveOriginal: true,
        providerIntent: plan.providerIntent,
        source: "semantic-action-router",
      },
    });
  }

  return forwardJson(request, plan.backendPath, {
    instruction:
      body.instruction ||
      (plan.fullVideoRegeneration
        ? "Regenerate the entire video as a new full version using saved analysis and intelligence."
        : `Run ${body.action} on the selected target.`),
    action: body.action,
    targetType: plan.fullVideoRegeneration ? "full_video" : selectedTarget?.targetType || selectedTarget?.layer || plan.scope,
    targetId: plan.fullVideoRegeneration
      ? body.analysisId || projectId
      : selectedTarget?.id || selectedTarget?.segmentId || selectedTarget?.frameId || null,
    selected: plan.fullVideoRegeneration ? null : selectedTarget,
    analysisId: body.analysisId || null,
    semanticFullEditor: true,
    fullVideoRegeneration: plan.fullVideoRegeneration,
    preserveOriginal: true,
    providerIntent: plan.providerIntent,
    source: "semantic-action-router",
  });
}
