import { NextRequest, NextResponse } from "next/server";
import { stitchVideosToPublic } from "@/lib/pipeline-test/ffmpegTools";
import type { StitchRequest, StitchResult } from "@/lib/pipeline-test/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as StitchRequest;

  if (!Array.isArray(body.inputUrls) || body.inputUrls.length < 2) {
    return NextResponse.json(
      { error: "At least two inputUrls are required" },
      { status: 400 }
    );
  }

  try {
    const outputUrl = await stitchVideosToPublic(
      body.inputUrls,
      body.outputFileName
    );

    const result: StitchResult = {
      success: true,
      outputUrl,
      error: null,
    };

    return NextResponse.json(result);
  } catch (error) {
    const result: StitchResult = {
      success: false,
      outputUrl: null,
      error: error instanceof Error ? error.message : "Unknown stitch error",
    };

    return NextResponse.json(result, { status: 500 });
  }
}
