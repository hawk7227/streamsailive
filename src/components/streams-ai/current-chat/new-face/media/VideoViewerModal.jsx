"use client";

import React, { useEffect, useRef } from "react";

export default function VideoViewerModal({ video, open, onClose, onDownload }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !video?.url) return null;

  const name = video.name || "Generated video";

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={name}
        style={{
          width: "min(1040px, 100%)",
          maxHeight: "calc(100dvh - 48px)",
          borderRadius: 24,
          overflow: "hidden",
          background: "#111",
          color: "#fff",
          boxShadow: "0 32px 90px rgba(0,0,0,0.42)",
        }}
      >
        <header
          style={{
            height: 62,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 18px",
            borderBottom: "1px solid rgba(255,255,255,0.12)",
            background: "#151515",
          }}
        >
          <strong style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</strong>
          <button
            type="button"
            onClick={() => onDownload?.(video)}
            style={{ border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#fff", borderRadius: 999, padding: "8px 14px" }}
          >
            Download
          </button>
          <button
            type="button"
            aria-label="Close video"
            onClick={onClose}
            style={{ width: 38, height: 38, border: 0, background: "transparent", color: "#fff", borderRadius: 999, fontSize: 28, lineHeight: 1 }}
          >
            ×
          </button>
        </header>

        <div style={{ padding: 18 }}>
          <video
            src={video.url}
            controls
            autoPlay
            playsInline
            style={{ width: "100%", maxHeight: "calc(100dvh - 160px)", display: "block", borderRadius: 18, background: "#000" }}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </section>
    </div>
  );
}
