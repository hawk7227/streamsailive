import { NextResponse } from "next/server";
import { buildMaterializedTimeline } from "@/lib/admingeneration/editor/materialized-timeline";

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

  const [timeline, intelligence, assets] = await Promise.all([
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/timeline`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/intelligence`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/assets`),
  ]);

  const materializedTimeline = buildMaterializedTimeline({
    projectId,
    timeline,
    intelligence,
    assets: assets?.assets || assets?.items || assets || [],
  });

  return NextResponse.json({
    ok: true,
    status: "loaded",
    projectId,
    materializedTimeline,
  });
}
