import { NextResponse } from "next/server";
import { evaluateQaActivationGate } from "@/lib/admingeneration/editor/qa-activation-gate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function internalUrl(request: Request, path: string) {
  return new URL(path, new URL(request.url).origin).toString();
}

async function getJson(request: Request, path: string) {
  const response = await fetch(internalUrl(request, path), { cache: "no-store" });
  return response.json().catch(() => null);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await context.params;
  const projectId = params.id;

  if (!projectId) {
    return NextResponse.json({ ok: false, error: "Missing editor project id." }, { status: 400 });
  }

  const [qc, providerRuns, versions] = await Promise.all([
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/qc`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/provider-runs`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/versions`),
  ]);

  const gate = evaluateQaActivationGate({
    qc,
    providerRuns,
    version: versions?.activeVersion || null,
  });

  return NextResponse.json({
    ok: true,
    projectId,
    gate,
  });
}
