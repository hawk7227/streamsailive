import { NextResponse } from "next/server";
import { buildLongVideoPlan } from "@/lib/admingeneration/long-video/long-video-contract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function internalUrl(request: Request, path: string) {
  return new URL(path, new URL(request.url).origin).toString();
}

async function getJson(request: Request, path: string) {
  const response = await fetch(internalUrl(request, path), { cache: "no-store" });
  return response.json().catch(() => null);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await context.params;
  const projectId = params.id;
  const body = await request.json().catch(() => ({}));

  const [timeline, intelligence] = await Promise.all([
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/timeline`),
    getJson(request, `/api/admingeneration/editor/projects/${projectId}/intelligence`),
  ]);

  const plan = buildLongVideoPlan({
    projectId,
    instruction: body.instruction,
    targetDurationSec: body.targetDurationSec,
    maxShotDurationSec: body.maxShotDurationSec,
    fps: body.fps,
    aspectRatio: body.aspectRatio,
    timeline,
    intelligence,
  });

  return NextResponse.json({
    ok: true,
    status: "planned",
    projectId,
    plan,
  });
}
