import { NextRequest, NextResponse } from "next/server";
import { separateAudioWithDemucs } from "@/lib/pipeline-test/demucs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { audioUrl?: string };
  if (!body.audioUrl) {
    return NextResponse.json({ error: "audioUrl is required" }, { status: 400 });
  }

  try {
    const result = await separateAudioWithDemucs(body.audioUrl);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown audio separation error" },
      { status: 500 },
    );
  }
}
