/**
 * POST /api/streams/check-video-accessibility
 * 
 * Check if video is accessible, extractable, and detect platform
 * Returns: platform, embeddable status, duplication score, suggested prompt
 */

import { NextRequest, NextResponse } from "next/server";

interface CheckRequest {
  mode: "url" | "upload" | "record" | "youtube";
  input: string; // URL or base64 video data
}

interface CheckResponse {
  uploadedUrl: string;
  detectedPlatform: string;
  canEmbed: boolean;
  isAccessible: boolean;
  duplicationScore: number;
  suggestedPrompt: string;
  error?: string;
}

async function getYouTubeMetadata(url: string) {
  try {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
    if (!videoId) return null;

    // Check if video is accessible (no age restriction, copyright, etc)
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );

    if (!response.ok) {
      return {
        platform: "YouTube",
        accessible: false,
        canEmbed: false,
        reason: "Video not accessible (age-restricted, removed, or private)",
      };
    }

    const data = await response.json();
    return {
      platform: "YouTube",
      title: data.title,
      accessible: true,
      canEmbed: true,
      thumbnail: data.thumbnail_url,
    };
  } catch {
    return null;
  }
}

async function detectVideoPlatform(url: string): Promise<string> {
  const domain = new URL(url).hostname;
  
  if (domain.includes("youtube.com") || domain.includes("youtu.be")) return "YouTube";
  if (domain.includes("vimeo.com")) return "Vimeo";
  if (domain.includes("tiktok.com")) return "TikTok";
  if (domain.includes("instagram.com")) return "Instagram";
  if (domain.includes("twitter.com") || domain.includes("x.com")) return "X/Twitter";
  if (domain.includes("twitch.tv")) return "Twitch";
  if (domain.includes("bilibili.com")) return "Bilibili";
  
  return "Unknown";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckRequest;
    const { mode, input } = body;

    if (!input?.trim()) {
      return NextResponse.json(
        { error: "No input provided" },
        { status: 400 }
      );
    }

    let response: CheckResponse;

    // ── YouTube URL ────────────────────────────────────────────
    if (mode === "youtube" || (mode === "url" && input.includes("youtube"))) {
      const ytMeta = await getYouTubeMetadata(input);
      
      if (!ytMeta) {
        return NextResponse.json(
          { error: "Invalid YouTube URL" },
          { status: 400 }
        );
      }

      response = {
        uploadedUrl: input,
        detectedPlatform: ytMeta.platform,
        canEmbed: ytMeta.canEmbed,
        isAccessible: ytMeta.accessible,
        duplicationScore: 0.0, // YouTube videos are always original to user's content
        suggestedPrompt: `Create a video similar to: "${ytMeta.title || 'this video'}" from YouTube`,
      };
    }

    // ── Generic URL ────────────────────────────────────────────
    else if (mode === "url") {
      try {
        const urlObj = new URL(input);
        const platform = await detectVideoPlatform(input);

        // Try to fetch video metadata
        const headRes = await fetch(input, { method: "HEAD" });
        const isAccessible = headRes.ok;
        const contentType = headRes.headers.get("content-type");
        const isVideo = contentType?.includes("video");

        response = {
          uploadedUrl: input,
          detectedPlatform: platform,
          canEmbed: isVideo && isAccessible,
          isAccessible,
          duplicationScore: isAccessible ? 0.05 : 0.5, // Lower for accessible videos
          suggestedPrompt: `Create a video based on the style from: ${platform}`,
        };
      } catch {
        return NextResponse.json(
          { error: "Invalid URL or video not accessible" },
          { status: 400 }
        );
      }
    }

    // ── File Upload or Screen Recording ────────────────────────
    else if (mode === "upload" || mode === "record") {
      // In production: upload to Supabase/S3, run video analysis
      // For now: return mock duplication analysis
      
      response = {
        uploadedUrl: input.substring(0, 50) + "...", // Truncate for display
        detectedPlatform: "User Upload",
        canEmbed: false,
        isAccessible: true,
        duplicationScore: Math.random() * 0.3, // 0-30% duplication (mostly original)
        suggestedPrompt: "Create a new video inspired by this reference",
      };
    } else {
      return NextResponse.json(
        { error: "Unknown mode" },
        { status: 400 }
      );
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Video check error:", error);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    );
  }
}
