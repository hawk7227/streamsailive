"use client";

import React from "react";

export default function InlineAssistantVideoCard({ video, onOpen, onDownload, onCopyUrl }) {
  const url = video?.url || video?.generatedVideoUrl || "";
  if (!url) return null;

  return (
    <article
      style={{
        width: "min(820px, 100%)",
        border: "1px solid #e5e5e5",
        borderRadius: 22,
        background: "#fff",
        overflow: "hidden",
        boxShadow: "0 18px 48px rgba(0,0,0,0.08)",
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        style={{
          width: "100%",
          border: 0,
          padding: 0,
          display: "block",
          background: "#000",
          cursor: "pointer",
        }}
        aria-label="Open generated video"
      >
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          style={{
            width: "100%",
            maxHeight: 520,
            display: "block",
            background: "#000",
          }}
        >
          Your browser does not support the video tag.
        </video>
      </button>

      <footer
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderTop: "1px solid #eeeeee",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 14 }}>{video?.name || "Generated video"}</strong>
          <span style={{ display: "block", color: "#777", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {video?.generationId || url}
          </span>
        </div>
        <button type="button" onClick={onCopyUrl} style={{ border: "1px solid #ddd", borderRadius: 999, background: "#fff", padding: "8px 12px" }}>
          Copy URL
        </button>
        <button type="button" onClick={onDownload} style={{ border: 0, borderRadius: 999, background: "#050505", color: "#fff", padding: "9px 14px", fontWeight: 800 }}>
          Download
        </button>
      </footer>
    </article>
  );
}
