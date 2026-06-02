import { NextResponse } from "next/server";
import { buildLongVideoStitchSubmitPayload } from "@/lib/admingeneration/long-video/long-video-stitch-submit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function internalUrl(request: Request, path: string) {
  return new URL(path, new URL(request.url).origin).toString();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const stitchPayload = buildLongVideoStitchSubmitPayload({
    shotStatuses: body.shotStatuses || [],
    fps: body.fps,
    aspectRatio: body.aspectRatio,
  });

  if (!stitchPayload.readyToStitch) {
    return NextResponse.json(
      {
        ok: false,
        status: "needs_clip_outputs",
        stitchPayload,
        error: "Cannot stitch until every planned shot has a real output URL or output asset ID.",
      },
      { status: 422 },
    );
  }

  const response = await fetch(internalUrl(request, "/api/streams/stitch"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(stitchPayload),
    cache: "no-store",
  });

  const result = await response.json().catch(() => null);

  return NextResponse.json({
    ok: response.ok,
    status: response.ok ? "submitted" : "failed",
    stitchPayload,
    result,
  }, { status: response.status });
}
