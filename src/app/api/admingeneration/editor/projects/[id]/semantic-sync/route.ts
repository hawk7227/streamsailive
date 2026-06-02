import { NextResponse } from "next/server";
import { buildMasterTimelineSync } from "@/lib/admingeneration/editor/master-timeline-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function internalUrl(request: Request, path: string) {
  return new URL(path, new URL(request.url).origin).toString();
}

async function getJson(request: Request, path: string) {
  const response = await fetch(internalUrl(request, path), { cache: "no-store" });
  const data = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.ok ? "loaded" : "error",
    data,
  };
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

  const [timeline, intelligence, versions, providerRuns, qc] = await Promise.all([
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/timeline`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/intelligence`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/versions`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/provider-runs`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/qc`),
  ]);

  const sync = buildMasterTimelineSync({
    projectId,
    timeline: timeline.ok ? timeline.data : null,
    intelligence: intelligence.ok ? intelligence.data : null,
    versions: versions.ok ? versions.data : null,
    providerRuns: providerRuns.ok ? providerRuns.data : null,
    qc: qc.ok ? qc.data : null,
  });

  return NextResponse.json({
    ok: true,
    status: "loaded",
    projectId,
    sync,
    sourceStatus: {
      timeline: timeline.status,
      intelligence: intelligence.status,
      versions: versions.status,
      providerRuns: providerRuns.status,
      qc: qc.status,
    },
  });
}
