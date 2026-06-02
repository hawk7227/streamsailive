import { NextResponse } from "next/server";
import { buildWordSpeakerMap } from "@/lib/admingeneration/editor/word-speaker-map";

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

  const [timeline, intelligence] = await Promise.all([
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/timeline`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/intelligence`),
  ]);

  return NextResponse.json({
    ok: true,
    projectId,
    map: buildWordSpeakerMap({ timeline, intelligence }),
  });
}
