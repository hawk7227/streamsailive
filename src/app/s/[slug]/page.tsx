/**
 * /s/[slug] — public share page
 *
 * Resolves slug → generation_log output_url.
 * Shows video/image/audio player with "Made with Streams" watermark
 * (unless disabled in workspace_settings).
 * Increments view_count on load.
 * No auth required for public links.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";

interface Props { params: { slug: string } }

export default async function SharePage({ params }: Props) {
  const { slug } = params;
  const admin = createAdminClient();

  // Resolve slug
  const { data: link } = await admin
    .from("share_links")
    .select("id, title, is_public, expires_at, generation_log_id, view_count")
    .eq("slug", slug)
    .single();

  if (!link || !link.is_public) return notFound();

  // Increment view_count — fire and forget (non-blocking)
  admin
    .from("share_links")
    .update({ view_count: (link.view_count ?? 0) + 1 })
    .eq("id", link.id)
    .then(() => {}, () => {});

  // Check expiry
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return (
      <div style={{ minHeight: "100vh", background: "#080C1E", display: "flex", alignItems: "center", justifyContent: "center", color: "#9BA3C9", fontFamily: "monospace" }}>
        This link has expired.
      </div>
    );
  }

  // Load generation output URL
  const { data: gen } = await admin
    .from("generation_log")
    .select("output_url, generation_type, input_params")
    .eq("id", link.generation_log_id)
    .single();

  if (!gen?.output_url) return notFound();

  // Increment view count (non-blocking)
  void admin.from("share_links").update({ view_count: (link.view_count ?? 0) + 1 }).eq("id", link.id);

  const isVideo = gen.generation_type?.startsWith("video");
  const isAudio = gen.generation_type === "voice" || gen.generation_type === "music";
  const title   = link.title ?? "Streams";

  return (
    <div style={{ minHeight: "100vh", background: "#080C1E", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px", fontFamily: "'IBM Plex Mono', monospace" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap" />

      <div style={{ maxWidth: 680, width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, color: "#F0F2FF", fontWeight: 500 }}>{title}</div>

        {isVideo && (
          <video
            src={gen.output_url}
            controls
            autoPlay
            loop
            playsInline
            style={{ width: "100%", borderRadius: 12, background: "#000" }}
          />
        )}
        {isAudio && (
          <audio src={gen.output_url} controls style={{ width: "100%" }} />
        )}
        {!isVideo && !isAudio && (
          <img src={gen.output_url} alt={title} style={{ width: "100%", borderRadius: 12 }} />
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "#5A6390" }}>
            streamsailive.vercel.app/s/{slug}
          </span>
          <a
            href={gen.output_url}
            download
            style={{ fontSize: 12, color: "#7C3AED", textDecoration: "none", padding: "6px 14px", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 8 }}
          >
            ↓ Download
          </a>
        </div>

        <div style={{ fontSize: 10, color: "#323A60", textAlign: "center" }}>
          Made with Streams
        </div>
      </div>
    </div>
  );
}
