import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeUrl(value = "") {
  try {
    const parsed = new URL(String(value || "").trim());
    return /^https?:$/.test(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
}

function detectPlatform(url) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname || "";
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.endsWith("facebook.com") || host.endsWith("fb.watch")) return "facebook";
  if (host.endsWith("tiktok.com")) return "tiktok";
  if (host.endsWith("x.com") || host.endsWith("twitter.com")) return "twitter";
  if (/\.(mp4|mov|webm|m4v|mp3|wav|m4a|pdf|docx|txt|csv|json)$/i.test(path)) return "direct_file";
  return "web";
}

function youtubeVideoId(url) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
  if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/").filter(Boolean)[1] || "";
  return url.searchParams.get("v") || "";
}

function titleFor(platform) {
  return ({ youtube: "YouTube video link", instagram: "Instagram link", facebook: "Facebook link", tiktok: "TikTok link", twitter: "X / Twitter link", direct_file: "Direct file link", web: "Web link" })[platform] || "Web link";
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = safeUrl(body.url);
    if (!parsed) return NextResponse.json({ ok: false, error: "A valid http(s) URL is required." }, { status: 400 });

    const platform = detectPlatform(parsed);
    const videoId = platform === "youtube" ? youtubeVideoId(parsed) : "";
    const now = new Date().toISOString();
    const asset = {
      id: `link_${platform}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      kind: platform === "youtube" ? "link_video" : platform === "direct_file" ? "link_file" : platform === "web" ? "link" : "social_link",
      source: "link",
      platform,
      name: titleFor(platform),
      title: titleFor(platform),
      sourceUrl: parsed.toString(),
      url: parsed.toString(),
      previewUrl: platform === "youtube" && videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "",
      thumbnailUrl: platform === "youtube" && videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "",
      videoId,
      intent: body.intent || "analyze",
      status: "ready_for_analysis",
      requiresCapture: ["instagram", "facebook", "tiktok", "twitter"].includes(platform),
      createdAt: now,
      updatedAt: now,
    };

    return NextResponse.json({ ok: true, asset, platform, videoId, summary: `${asset.name} added to chat library.` });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || "Link ingest failed." }, { status: 500 });
  }
}
