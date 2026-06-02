import { NextResponse } from "next/server";
import { buildVersionGraph } from "@/lib/admingeneration/editor/version-graph";

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

  const response = await fetch(internalUrl(request, `/api/admingeneration/editor/projects/${projectId}/versions`), {
    cache: "no-store",
  });

  const versions = await response.json().catch(() => null);
  const graph = buildVersionGraph(versions);

  return NextResponse.json({
    ok: response.ok,
    projectId,
    graph,
  }, { status: response.ok ? 200 : response.status });
}
