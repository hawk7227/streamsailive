/**
 * POST /api/intake/youtube
 *
 * Extracts YouTube video metadata + transcript, analyzes for creative direction.
 * Returns: title, description, transcript snippet, suggested image prompt,
 * suggested video direction, detected style, and design tokens.
 *
 * No YouTube API key required — uses public oEmbed + transcript extraction.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { YoutubeTranscript } from "youtube-transcript";

export const maxDuration = 60;

function extractVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchVideoMeta(videoId: string): Promise<{ title: string; description: string; thumbnailUrl: string; channelName: string }> {
  // Use oEmbed — no API key required
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`YouTube oEmbed failed: ${res.status}`);
  const data = await res.json() as { title?: string; author_name?: string; thumbnail_url?: string };
  return {
    title: data.title ?? "",
    description: "",
    thumbnailUrl: data.thumbnail_url ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    channelName: data.author_name ?? "",
  };
}

async function fetchTranscript(videoId: string): Promise<string> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    // Take first ~2000 chars of transcript
    return segments
      .map(s => s.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);
  } catch {
    return ""; // Transcript unavailable — proceed with metadata only
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });

  let body: { url?: string };
  try { body = await req.json() as { url?: string }; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { url } = body;
  if (!url?.trim()) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const videoId = extractVideoId(url.trim());
  if (!videoId) return NextResponse.json({ error: "Could not extract YouTube video ID from URL. Supported: youtube.com/watch?v=, youtu.be/, shorts/" }, { status: 400 });

  // Fetch metadata + transcript in parallel
  let meta: { title: string; description: string; thumbnailUrl: string; channelName: string };
  let transcript: string;

  try {
    [meta, transcript] = await Promise.all([
      fetchVideoMeta(videoId),
      fetchTranscript(videoId),
    ]);
  } catch (err) {
    return NextResponse.json({ error: `YouTube fetch failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  const sourceContent = [
    meta.title ? `Title: ${meta.title}` : "",
    meta.channelName ? `Channel: ${meta.channelName}` : "",
    transcript ? `Transcript (first 2000 chars): ${transcript}` : "[No transcript available]",
  ].filter(Boolean).join("\n\n");

  // GPT-4o analysis
  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: `You analyze YouTube videos to extract creative direction for advertising content.
Return ONLY valid JSON (no markdown):
{
  "analysisResult": "2-3 sentences: what this video is about, tone, audience",
  "detectedStyle": "one of: educational, promotional, testimonial, lifestyle, documentary, entertainment",
  "suggestedImagePrompt": "Under 50 words. Real, unpolished scene inspired by the video content. No cinematic language.",
  "suggestedVideoDirection": "Under 40 words. Motion direction for a 5s clip inspired by the video. Motion only.",
  "suggestedCopy": { "headline": "under 8 words", "cta": "under 4 words" },
  "keyMessages": ["message 1", "message 2", "message 3"],
  "targetAudience": "brief description of who this video targets"
}`,
        },
        { role: "user", content: `Analyze this YouTube video:\n\n${sourceContent}` },
      ],
    }),
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    return NextResponse.json({ error: `Analysis failed: ${err}` }, { status: 500 });
  }

  const aiData = await aiRes.json() as { choices: Array<{ message: { content: string } }> };
  const raw = aiData.choices[0]?.message?.content ?? "{}";
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  let analysis: Record<string, unknown>;
  try { analysis = JSON.parse(clean) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "AI returned invalid JSON", raw }, { status: 500 }); }

  return NextResponse.json({
    ok: true,
    videoId,
    thumbnailUrl: meta.thumbnailUrl,
    title: meta.title,
    channelName: meta.channelName,
    hasTranscript: transcript.length > 0,
    transcriptSnippet: transcript.slice(0, 300),
    ...analysis,
  });
}
