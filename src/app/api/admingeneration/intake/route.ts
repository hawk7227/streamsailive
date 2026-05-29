import { NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const YT_PATTERNS = [
  /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

function extractVideoId(url: string): string | null {
  for (const pattern of YT_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function isYoutube(url: string) {
  return /youtube\.com|youtu\.be/i.test(url);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = String(body?.url || body?.youtubeUrl || "").trim();

    if (!url) {
      return NextResponse.json({ ok: false, error: "url is required" }, { status: 400 });
    }

    if (!isYoutube(url)) {
      return NextResponse.json({
        ok: false,
        route: "admingeneration-intake",
        error: "Only YouTube intake is wired in this protected-free analyzer slice.",
      }, { status: 422 });
    }

    const videoId = extractVideoId(url);

    if (!videoId) {
      return NextResponse.json({ ok: false, error: "Could not extract YouTube video ID" }, { status: 400 });
    }

    let title = "";
    let channelName = "";
    let thumbnailUrl = "";

    try {
      const oEmbed = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { signal: AbortSignal.timeout(8000), cache: "no-store" }
      );

      if (oEmbed.ok) {
        const data = await oEmbed.json();
        title = data?.title || "";
        channelName = data?.author_name || "";
        thumbnailUrl = data?.thumbnail_url || "";
      }
    } catch {}

    let transcript = "";
    let transcriptSnippet = "";

    try {
      const segments = await YoutubeTranscript.fetchTranscript(videoId);
      transcript = segments.map((segment) => segment.text).join(" ").replace(/\s+/g, " ").trim();
      transcriptSnippet = transcript.slice(0, 700);
    } catch {
      transcriptSnippet = "[Transcript unavailable for this video]";
    }

    const keyMessages = transcript
      .split(/[.!?]+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 20)
      .slice(0, 8);

    return NextResponse.json({
      ok: true,
      route: "admingeneration-intake",
      type: "youtube",
      videoId,
      url,
      title,
      channelName,
      thumbnailUrl,
      transcript: transcript.slice(0, 20000),
      transcriptSnippet,
      wordCount: transcript ? transcript.split(/\s+/).filter(Boolean).length : 0,
      keyMessages,
      summary: title
        ? `YouTube reference analyzed: ${title}`
        : "YouTube reference analyzed.",
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      route: "admingeneration-intake",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
