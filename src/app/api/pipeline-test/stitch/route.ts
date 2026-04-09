import { NextRequest, NextResponse } from "next/server";
import { stitchVideosToPublic } from "@/lib/pipeline-test/ffmpegTools";
import { StitchRequest, StitchResult } from "@/lib/pipeline-test/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as StitchRequest;
  if (!Array.isArray(body.videoUrls) || body.videoUrls.length < 2) {
    return NextResponse.json({ error: "At least two videoUrls are required" }, { status: 400 });
  }

  try {
    const stitchedVideoUrl = await stitchVideosToPublic(body.videoUrls);
    const result: StitchResult = { stitchedVideoUrl };
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown stitching error" },
      { status: 500 },
    );
  }
}
