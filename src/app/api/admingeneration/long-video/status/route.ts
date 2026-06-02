import { NextResponse } from "next/server";
import { buildLongVideoStatus } from "@/lib/admingeneration/long-video/long-video-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  return NextResponse.json({
    ok: true,
    status: "loaded",
    longVideoStatus: buildLongVideoStatus({
      shots: body.shots || body.productionPlan?.shots || [],
      providerRuns: body.providerRuns || [],
    }),
  });
}
