"use client";

import React from "react";

export type MediaShelfItem = {
  id: string;
  title: string;
  type: "image" | "video" | "story" | "audio";
  url?: string | null;
  subtitle?: string;
  status?: string;
  createdAt?: string;
  qaStatus?: "approved" | "warning" | "rejected" | "pending";
};

interface MediaShelfProps {
  items: MediaShelfItem[];
  visible: boolean;
  onToggleVisible: () => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  onOpenItem?: (item: MediaShelfItem) => void;
  onDropFiles?: (files: FileList) => void;
  rememberStateKey?: string;
}

export default function MediaShelf({ items, visible, onToggleVisible, autoScroll, onToggleAutoScroll, onOpenItem, onDropFiles, rememberStateKey }: MediaShelfProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const pausedRef = React.useRef(false);
  const [manualState, setManualState] = React.useState<"idle" | "hover" | "drag" | "playing" | "manual_scroll">("idle");

  React.useEffect(() => {
    if (!rememberStateKey || typeof window === "undefined") return;
    window.localStorage.setItem(`${rememberStateKey}:media-shelf-visible`, visible ? "1" : "0");
    window.localStorage.setItem(`${rememberStateKey}:media-shelf-autoscroll`, autoScroll ? "1" : "0");
  }, [rememberStateKey, visible, autoScroll]);

  React.useEffect(() => {
    if (!visible || !autoScroll) return;
    const node = wrapRef.current;
    if (!node) return;
    const timer = window.setInterval(() => {
      if (pausedRef.current || manualState !== "idle") return;
      node.scrollTop += 1;
      if (node.scrollTop + node.clientHeight >= node.scrollHeight - 4) {
        node.scrollTop = 0;
      }
    }, 35);
    return () => window.clearInterval(timer);
  }, [visible, autoScroll, manualState]);

  const statusLabel = !visible
    ? "Hidden"
    : autoScroll
      ? manualState === "idle"
        ? "Auto-scroll On"
        : `Paused · ${manualState.replace("_", " ")}`
      : "Manual Browse";

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(8,12,33,0.92)", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#dbeafe" }}>Media Shelf</div>
          <div style={{ fontSize: 10, color: "#64748b" }}>4-up previews · drag/drop · individually playable videos</div>
        </div>
        <div style={{ marginLeft: 8, fontSize: 10, color: "#93c5fd", border: "1px solid rgba(147,197,253,0.16)", borderRadius: 999, padding: "4px 8px" }}>{statusLabel}</div>
        <div style={{ flex: 1 }} />
        <button onClick={onToggleAutoScroll} style={btnStyle(autoScroll)}>{autoScroll ? "Auto-scroll On" : "Auto-scroll Off"}</button>
        <button onClick={onToggleVisible} style={btnStyle(visible)}>{visible ? "Hide Shelf" : "Show Shelf"}</button>
      </div>
      {visible && (
        <div
          ref={wrapRef}
          onMouseEnter={() => { pausedRef.current = true; setManualState("hover"); }}
          onMouseLeave={() => { pausedRef.current = false; setManualState("idle"); }}
          onDragOver={(e) => { e.preventDefault(); pausedRef.current = true; setManualState("drag"); }}
          onDragEnd={() => { pausedRef.current = false; setManualState("idle"); }}
          onScroll={() => { pausedRef.current = true; setManualState("manual_scroll"); window.setTimeout(() => { pausedRef.current = false; setManualState("idle"); }, 900); }}
          onDrop={(e) => { e.preventDefault(); pausedRef.current = false; setManualState("idle"); if (e.dataTransfer.files?.length) onDropFiles?.(e.dataTransfer.files); }}
          style={{ maxHeight: 300, overflowY: "auto", padding: 12 }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
            {items.map((item) => (
              <div key={item.id} draggable onDoubleClick={() => onOpenItem?.(item)} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden", minHeight: 150 }}>
                <div style={{ aspectRatio: "16/10", background: "#020617", position: "relative" }}>
                  {item.type === "video" && item.url ? (
                    <video
                      src={item.url}
                      controls
                      muted
                      playsInline
                      onPlay={() => { pausedRef.current = true; setManualState("playing"); }}
                      onPause={() => { pausedRef.current = false; setManualState("idle"); }}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : item.type === "image" && item.url ? (
                    <img src={item.url} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 12 }}>
                      {item.type.toUpperCase()}
                    </div>
                  )}
                  <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(15,23,42,0.82)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1", borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                    {item.type}
                  </div>
                  {(item.qaStatus || item.status) && (
                    <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(15,23,42,0.82)", border: `1px solid ${qaColor(item.qaStatus ?? "pending")}`, color: qaColor(item.qaStatus ?? "pending"), borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                      {(item.qaStatus ?? item.status ?? "saved").toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={{ padding: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                  <div style={{ fontSize: 10, color: "#64748b", minHeight: 14 }}>{item.subtitle ?? item.status ?? "Saved asset"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 10,
    borderRadius: 999,
    padding: "5px 10px",
    border: `1px solid ${active ? "rgba(103,232,249,0.28)" : "rgba(255,255,255,0.10)"}`,
    background: active ? "rgba(103,232,249,0.10)" : "rgba(255,255,255,0.04)",
    color: active ? "#67e8f9" : "#cbd5e1",
    cursor: "pointer",
  };
}

function qaColor(status: NonNullable<MediaShelfItem["qaStatus"]>): string {
  switch (status) {
    case "approved": return "#4ade80";
    case "warning": return "#f59e0b";
    case "rejected": return "#fb7185";
    default: return "#93c5fd";
  }
}
