import { NextRequest, NextResponse } from "next/server";
import { extractAudioAndSilentVideoToPublic } from "@/lib/pipeline-test/ffmpegTools";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { videoUrl?: string };
  if (!body.videoUrl) {
    return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
  }

  try {
    const result = await extractAudioAndSilentVideoToPublic(body.videoUrl);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown audio extraction error" },
      { status: 500 },
    );
  }
}
