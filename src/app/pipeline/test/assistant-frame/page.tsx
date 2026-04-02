"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type AssistantMessage = {
  type?: string;
  payload?: {
    context?: Record<string, unknown>;
    proactiveMessage?: { text?: string } | null;
  };
};

type ActionType =
  | "PLAN_IMAGE"
  | "PLAN_VIDEO"
  | "PLAN_LONG_VIDEO"
  | "REGENERATE_REALISM"
  | "SEND_TO_SCREEN"
  | "SEND_TO_SHELF";

function postToParent(action: ActionType, payload?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.parent.postMessage({ type: "PIPELINE_ASSISTANT_ACTION", action, payload }, window.location.origin);
}

function makeAmbientArt(label: string, palette: [string, string, string]) {
  const [a, b, c] = palette;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="0.56" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="900" height="1200" fill="url(#g)"/><circle cx="660" cy="200" r="160" fill="rgba(255,255,255,0.16)"/><circle cx="230" cy="930" r="220" fill="rgba(255,255,255,0.08)"/><path d="M0 930 C 180 800, 340 1090, 500 960 S 720 790, 900 920 V1200 H0 Z" fill="rgba(5,10,18,0.28)"/><rect x="52" y="58" rx="22" ry="22" width="320" height="74" fill="rgba(9,12,25,0.22)" stroke="rgba(255,255,255,0.18)"/><text x="84" y="106" font-size="38" font-family="Arial, sans-serif" fill="white" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const GALLERY = [
  makeAmbientArt("Plan Image", ["#b9c9d8", "#8295ab", "#425164"]),
  makeAmbientArt("Plan Video", ["#d0c4b4", "#907967", "#4e413f"]),
  makeAmbientArt("Long Video", ["#bdd6cf", "#6e8d84", "#33444a"]),
];

export default function PipelineAssistantFramePage() {
  const [context, setContext] = useState<Record<string, unknown> | null>(null);
  const [proactiveText, setProactiveText] = useState<string>("");
  const [query, setQuery] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [messages, setMessages] = useState<Array<{ role: "assistant" | "user"; text: string }>>([
    { role: "assistant", text: "Hi. I’m STREAMS. Ask once — I’ll plan images, videos, or long-form production automatically." },
  ]);

  useEffect(() => {
    window.parent.postMessage({ type: "PIPELINE_ASSISTANT_READY" }, window.location.origin);
    const onMessage = (event: MessageEvent<AssistantMessage>) => {
      if (event.origin !== window.location.origin) return;
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "PIPELINE_ASSISTANT_INIT" || msg.type === "PIPELINE_ASSISTANT_CONTEXT") {
        setContext(msg.payload?.context ?? null);
      }
      if (msg.type === "PIPELINE_ASSISTANT_PROACTIVE") {
        setProactiveText(msg.payload?.proactiveMessage?.text ?? "");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setCurrentIdx((i) => (i + 1) % GALLERY.length), 5200);
    return () => window.clearInterval(id);
  }, []);

  const liveState = useMemo(() => {
    const op = context?.operatorStatus as Record<string, unknown> | undefined;
    if (op?.stage && typeof op.stage === "string" && op.stage !== "idle") {
      const scene = typeof op.scene === "number" ? op.scene : 0;
      const totalScenes = typeof op.totalScenes === "number" ? op.totalScenes : 0;
      const clip = typeof op.clip === "number" ? op.clip : 0;
      const totalClips = typeof op.totalClips === "number" ? op.totalClips : 0;
      if (op.stage === "stitching") return "stitching";
      if (clip && totalClips) return `rendering clip ${clip}/${totalClips}`;
      if (scene && totalScenes) return `generating scene ${scene}/${totalScenes}`;
      return String(op.stage);
    }
    const summary = context?.liveEventsSummary;
    if (typeof summary === "string" && summary.trim()) return summary;
    return "Watching prompts, screens, shelf, and generation state.";
  }, [context]);

  const activePlan = useMemo(() => {
    if (!query.trim()) return "PLAN_IMAGE";
    if (/(hour|hr|chapter|scene|clip|long)/i.test(query)) return "PLAN_LONG_VIDEO";
    if (/video|film|movie/i.test(query)) return "PLAN_VIDEO";
    return "PLAN_IMAGE";
  }, [query]);

  const submit = () => {
    const value = query.trim();
    if (!value) return;
    setMessages((prev) => [...prev, { role: "user", text: value }]);
    const nextAction = /(hour|hr|chapter|scene|clip|long)/i.test(value)
      ? "PLAN_LONG_VIDEO"
      : /video|film|movie/i.test(value)
        ? "PLAN_VIDEO"
        : "PLAN_IMAGE";
    const echo = nextAction === "PLAN_LONG_VIDEO"
      ? "I’m planning chapters, scenes, clips, continuity, and background stitching."
      : nextAction === "PLAN_VIDEO"
        ? "I’m building the video plan and routing it through the pipeline."
        : "I’m compiling a realism-safe image plan and sending it to generation.";
    setMessages((prev) => [...prev, { role: "assistant", text: echo }]);
    postToParent(nextAction, { prompt: value, target: "center" });
    setQuery("");
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #15284a 0%, #0f1b32 50%, #0a1326 100%)", color: "#e2e8f0", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes ambientCycle { 0%,24% { opacity: 0; } 8%,18% { opacity: 1; } 30%,100% { opacity: 0; } }
        @keyframes ambientKenBurns { 0%,100% { transform: scale(1.02) translate3d(0,0,0); } 50% { transform: scale(1.06) translate3d(0,-8px,0); } }
      `}</style>
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#7dd3fc" }}>Streams Chat</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>Chat Brain</div>
        </div>
        <div style={{ fontSize: 11, color: "rgba(226,232,240,0.7)", textAlign: "right" }}>
          <div>{String(context?.currentStepId ?? "strategy")}</div>
          <div>{String(context?.generationQueueSummary ? "live system" : "ready")}</div>
        </div>
      </div>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>
        <div style={{ position: "relative", height: 184, overflow: "hidden", borderRadius: 20, border: "1px solid rgba(148,163,184,0.16)", background: "linear-gradient(180deg, rgba(17,27,50,0.96), rgba(10,17,31,0.94))", boxShadow: "0 18px 44px rgba(2,6,23,.2)" }}>
          {GALLERY.map((src, idx) => (
            <div key={src} style={{ position: "absolute", inset: 0, opacity: currentIdx === idx ? 1 : 0, transition: "opacity 900ms ease" }}>
              <img src={src} alt="" aria-hidden style={{ width: "100%", height: "100%", objectFit: "cover", transform: currentIdx === idx ? "scale(1.05)" : "scale(1.02)", transition: "transform 5.2s ease" }} />
            </div>
          ))}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(7,12,22,0.08), rgba(7,12,22,0.66))" }} />
          <div style={{ position: "absolute", left: 16, right: 16, bottom: 14, display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ alignSelf: "flex-start", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7dd3fc", background: "rgba(15,23,42,0.55)", border: "1px solid rgba(125,211,252,0.28)", borderRadius: 999, padding: "4px 8px" }}>{activePlan}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>One input controls the whole workspace</span>
            <span style={{ fontSize: 12, lineHeight: 1.5, color: "rgba(226,232,240,0.82)" }}>Image planning, long-video segmentation, continuity, and routing are handled automatically.</span>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, overflowY: "auto", minHeight: 0 }}>
          {messages.map((message, idx) => (
            <div key={idx} style={{ alignSelf: message.role === "user" ? "flex-end" : "stretch", maxWidth: message.role === "user" ? "85%" : "100%", padding: "13px 14px", borderRadius: 18, border: "1px solid rgba(148,163,184,0.16)", background: message.role === "user" ? "linear-gradient(180deg, rgba(91,102,255,.18), rgba(141,99,255,.12))" : "rgba(255,255,255,0.04)", lineHeight: 1.45 }}>
              {message.text}
            </div>
          ))}
          {proactiveText ? (
            <div style={{ padding: "12px 14px", borderRadius: 16, border: "1px solid rgba(46,231,182,.24)", background: "rgba(46,231,182,.08)", fontSize: 13 }}>
              {proactiveText}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,0.1)", display: "grid", gap: 10 }}>
        <div style={{ padding: "12px 14px", borderRadius: 16, border: "1px solid rgba(46,231,182,.24)", background: "rgba(46,231,182,.08)", fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#34d399" }} />
            <strong>Live system state</strong>
          </div>
          <div style={{ color: "rgba(226,232,240,0.82)" }}>{liveState}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => postToParent("PLAN_IMAGE", { prompt: "Generate a realism-first image", target: "center" })} style={{ flex: 1, padding: "11px 12px", borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.04)", color: "#e2e8f0", fontWeight: 700, cursor: "pointer" }}>Plan Image</button>
          <button onClick={() => postToParent("PLAN_VIDEO", { prompt: "Generate a realism-first video", target: "center" })} style={{ flex: 1, padding: "11px 12px", borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.04)", color: "#e2e8f0", fontWeight: 700, cursor: "pointer" }}>Plan Video</button>
          <button onClick={() => postToParent("PLAN_LONG_VIDEO", { prompt: "Plan a 60 minute video", target: "center" })} style={{ flex: 1, padding: "11px 12px", borderRadius: 14, border: "1px solid rgba(125,211,252,0.24)", background: "linear-gradient(90deg, rgba(84,214,255,.16), rgba(141,99,255,.16))", color: "#f8fafc", fontWeight: 700, cursor: "pointer" }}>Plan Long Video</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Ask once — image, video, or long-form production" style={{ flex: 1, borderRadius: 16, border: "1px solid rgba(148,163,184,0.16)", background: "rgba(255,255,255,0.04)", color: "#e2e8f0", padding: "12px 14px", outline: "none" }} />
          <button onClick={submit} style={{ padding: "0 18px", borderRadius: 16, border: "1px solid rgba(125,211,252,0.24)", background: "linear-gradient(90deg, rgba(84,214,255,.16), rgba(141,99,255,.16))", color: "#f8fafc", fontWeight: 700, cursor: "pointer" }}>Send</button>
        </div>
      </div>
    </div>
  );
}
