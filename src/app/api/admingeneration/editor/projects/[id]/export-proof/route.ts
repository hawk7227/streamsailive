import { NextResponse } from "next/server";
import { evaluateExportProof } from "@/lib/admingeneration/editor/export-proof";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function internalUrl(request: Request, path: string) {
  return new URL(path, new URL(request.url).origin).toString();
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

  const response = await fetch(internalUrl(request, `/api/admingeneration/editor/projects/${projectId}/exports`), {
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  const latestExport = data?.exports?.[0] || data?.items?.[0] || data;
  const proof = evaluateExportProof(latestExport);

  return NextResponse.json({
    ok: true,
    projectId,
    proof,
  });
}
