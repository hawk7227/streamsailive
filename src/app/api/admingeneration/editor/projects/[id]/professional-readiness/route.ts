import { NextResponse } from "next/server";
import { buildProfessionalReadiness } from "@/lib/admingeneration/editor/professional-readiness";

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

  const [
    sync,
    wordSpeaker,
    subjectMotion,
    objectMaskData,
    activationGate,
    exportProof,
    providerReadiness,
  ] = await Promise.all([
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/semantic-sync`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/word-speaker-map`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/subject-motion-bindings`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/object-mask-data`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/activation-gate`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/export-proof`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/readiness`),
  ]);

  return NextResponse.json({
    ok: true,
    projectId,
    readiness: buildProfessionalReadiness({
      sync,
      wordSpeaker,
      subjectMotion,
      objectMaskData,
      activationGate,
      exportProof,
      providerReadiness,
    }),
  });
}
