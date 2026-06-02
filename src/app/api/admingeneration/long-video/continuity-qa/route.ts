import { NextResponse } from "next/server";
import { evaluateLongVideoContinuityQa } from "@/lib/admingeneration/long-video/long-video-continuity-qa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  return NextResponse.json({
    ok: true,
    status: "checked",
    continuityQa: evaluateLongVideoContinuityQa({
      shotStatuses: body.shotStatuses || [],
    }),
  });
}
