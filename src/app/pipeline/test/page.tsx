"use client";

import React, { useState } from "react";

type GenerationResult = {
  id?: string;
  type: string;
  status: string;
  output?: string;
  outputUrl?: string;
  error?: string;
};

const TELEHEALTH_PROMPT = "A calm, premium telehealth consultation scene. A professional female doctor in a clean white coat sits at a modern minimal desk with soft natural light. She looks reassuringly at the camera. Dark background with subtle blue gradient. No text. Leave negative space on the left for overlay.";

const VIDEO_PROMPT = "Premium telehealth brand video. A confident, calm doctor in a bright minimal clinic setting. Soft camera push-in. Reassuring atmosphere. High-end cinematic quality. 5 seconds.";

const SCRIPT_PROMPT = "Write a 30-second video script for a telehealth brand ad. Tone: premium, calm, reassuring. Key facts: secure online intake, licensed provider review, fast next steps. End with CTA: Start Your Visit. Format: [HOOK] [BODY] [CTA]";

export default function PipelineTestPage() {
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [pollingId, setPollingId] = useState<string | null>(null);

  const addResult = (r: GenerationResult) => {
    setResults(prev => [r, ...prev]);
  };

  const setLoadingKey = (key: string, val: boolean) => {
    setLoading(prev => ({ ...prev, [key]: val }));
  };

  const runGeneration = async (type: "script" | "image" | "video", key: string, prompt: string) => {
    setLoadingKey(key, true);
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          prompt,
          aspectRatio: "16:9",
          duration: type === "video" ? "5s" : undefined,
          quality: type === "video" ? "1080p" : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      const gen = data.data;
      addResult({
        id: gen.id,
        type,
        status: gen.status,
        output: gen.prompt,
        outputUrl: gen.output_url,
      });

      // If video is pending, start polling
      if (type === "video" && gen.status === "pending" && gen.external_id) {
        setPollingId(gen.id);
        pollGeneration(gen.id, key);
      }
    } catch (e: any) {
      addResult({ type, status: "error", error: e.message });
    } finally {
      setLoadingKey(key, false);
    }
  };

  const pollGeneration = async (genId: string, key: string) => {
    let attempts = 0;
    const maxAttempts = 40; // 40 x 15s = 10 minutes
    const poll = async () => {
      if (attempts >= maxAttempts) {
        setResults(prev => prev.map(r => r.id === genId ? { ...r, status: "timeout", error: "Generation timed out. Check Library." } : r));
        setPollingId(null);
        return;
      }
      attempts++;
      try {
        const res = await fetch(`/api/generations/${genId}`);
        // GET by ID not available, use list and filter
        const listRes = await fetch(`/api/generations?type=video&limit=10`);
        const listData = await listRes.json();
        const gen = listData.data?.find((g: any) => g.id === genId);
        if (gen?.status === "completed" && gen?.output_url) {
          setResults(prev => prev.map(r => r.id === genId ? { ...r, status: "completed", outputUrl: gen.output_url } : r));
          setPollingId(null);
          return;
        }
        if (gen?.status === "failed") {
          setResults(prev => prev.map(r => r.id === genId ? { ...r, status: "failed", error: "Generation failed" } : r));
          setPollingId(null);
          return;
        }
      } catch {}
      setTimeout(poll, 15000);
    };
    setTimeout(poll, 15000);
  };

  const btn = (label: string, key: string, onClick: () => void, color = "#4f46e5") => (
    <button
      onClick={onClick}
      disabled={!!loading[key]}
      style={{
        padding: "12px 20px",
        background: loading[key] ? "rgba(255,255,255,0.1)" : color,
        border: "none",
        borderRadius: 10,
        color: "#fff",
        fontWeight: 700,
        fontSize: 14,
        cursor: loading[key] ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        transition: "opacity 150ms",
        opacity: loading[key] ? 0.6 : 1,
        fontFamily: "inherit",
      }}
    >
      {loading[key] ? (
        <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      ) : null}
      {loading[key] ? "Generating..." : label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#050816 0%,#070b1a 100%)", color: "#fff", padding: "20px 24px", fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: "#67e8f9", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", marginBottom: 6 }}>StreamsAI — Live Generation Test</div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Real GPT · Image · Video</h1>
        <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Each button fires a real API call. Results appear below in real time.</p>
      </div>

      {/* 3 Generation Buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>

        {/* GPT Script */}
        <div style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>GPT-4o Script</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 16, lineHeight: 1.5 }}>{SCRIPT_PROMPT.slice(0, 100)}...</div>
          {btn("Generate Script", "script", () => runGeneration("script", "script", SCRIPT_PROMPT), "#4f46e5")}
        </div>

        {/* DALL-E Image */}
        <div style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>DALL-E 3 Image</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 16, lineHeight: 1.5 }}>{TELEHEALTH_PROMPT.slice(0, 100)}...</div>
          {btn("Generate Image", "image", () => runGeneration("image", "image", TELEHEALTH_PROMPT), "#7c3aed")}
        </div>

        {/* Kling Video */}
        <div style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Kling Video (text2video)</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 16, lineHeight: 1.5 }}>{VIDEO_PROMPT.slice(0, 100)}...</div>
          {btn("Generate Video", "video", () => runGeneration("video", "video", VIDEO_PROMPT), "#0891b2")}
          {pollingId && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#67e8f9", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#67e8f9", animation: "pulse 1.5s ease-in-out infinite" }} />
              Polling for completion every 15s...
            </div>
          )}
        </div>
      </div>

      {/* Run All */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => {
            runGeneration("script", "script", SCRIPT_PROMPT);
            runGeneration("image", "image", TELEHEALTH_PROMPT);
            runGeneration("video", "video", VIDEO_PROMPT);
          }}
          disabled={Object.values(loading).some(Boolean)}
          style={{ padding: "14px 28px", background: "linear-gradient(90deg,#4f46e5,#7c3aed,#0891b2)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}
        >
          ▶ Run All Three Now
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>Results</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {results.map((r, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${r.status === "completed" ? "rgba(16,185,129,0.4)" : r.status === "error" || r.status === "failed" ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: r.type === "script" ? "rgba(99,102,241,0.2)" : r.type === "image" ? "rgba(168,85,247,0.2)" : "rgba(6,182,212,0.2)", color: r.type === "script" ? "#a5b4fc" : r.type === "image" ? "#c084fc" : "#67e8f9" }}>{r.type.toUpperCase()}</span>
                  <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: r.status === "completed" ? "rgba(16,185,129,0.15)" : r.status === "pending" ? "rgba(245,158,11,0.15)" : r.status === "error" || r.status === "failed" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)", color: r.status === "completed" ? "#6ee7b7" : r.status === "pending" ? "#fcd34d" : r.status === "error" || r.status === "failed" ? "#fca5a5" : "#ccc" }}>{r.status}</span>
                  {r.id && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>id: {r.id.slice(0, 8)}...</span>}
                </div>

                {/* Script output */}
                {r.type === "script" && r.output && (
                  <pre style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap", lineHeight: 1.7, background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 8 }}>{r.output}</pre>
                )}

                {/* Image output */}
                {r.type === "image" && r.outputUrl && (
                  <div>
                    <img src={r.outputUrl} alt="Generated" style={{ width: "100%", maxWidth: 480, borderRadius: 10, display: "block" }} />
                    <a href={r.outputUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "#67e8f9" }}>Open full size ↗</a>
                  </div>
                )}

                {/* Video output */}
                {r.type === "video" && r.outputUrl && (
                  <div>
                    <video src={r.outputUrl} controls style={{ width: "100%", maxWidth: 640, borderRadius: 10, display: "block" }} />
                    <a href={r.outputUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "#67e8f9" }}>Download video ↗</a>
                  </div>
                )}

                {/* Pending video */}
                {r.type === "video" && r.status === "pending" && !r.outputUrl && (
                  <div style={{ fontSize: 13, color: "#fcd34d" }}>Video is being generated by Kling. Polling automatically. Usually 2–5 minutes.</div>
                )}

                {/* Error */}
                {r.error && (
                  <div style={{ fontSize: 13, color: "#fca5a5", marginTop: 4 }}>Error: {r.error}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
