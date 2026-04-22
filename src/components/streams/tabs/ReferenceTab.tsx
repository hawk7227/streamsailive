"use client";

/**
 * ReferenceTab — Reference analyzer.
 * Upload · URL · YouTube → GPT-4o Vision analysis → 4 actions.
 * Mobile-first: panels stack vertically.
 * No backend — shell only. Route needed: /api/reference/analyze
 */

import { useState } from "react";
import { C, R, DUR, EASE } from "../tokens";

type Source = "Upload" | "URL" | "YouTube";
type AnalysisState = "idle" | "analyzing" | "done";
type ActionState = "idle" | "running" | "done";

const PALETTE = ["#F5A52A","#2C1A0E","#E8C87A","#8B5E3C","#F2EDE4"];
const STYLE_TAGS = ["cinematic","golden hour","photorealistic","urban"];
const SUBJECTS   = ["woman · blazer","city street","bokeh background"];

export default function ReferenceTab() {
  const [source,   setSource]   = useState<Source>("Upload");
  const [urlInput, setUrlInput] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisState>("idle");
  const [actions,  setActions]  = useState<Record<string, ActionState>>({} as Record<string, ActionState>);

  function runAnalysis() {
    setAnalysis("analyzing");
    setTimeout(() => setAnalysis("done"), 3200);
  }

  function doAction(name: string) {
    setActions((a: Record<string, ActionState>) => ({ ...a, [name]: "running" }));
    setTimeout(() => setActions((a: Record<string, ActionState>) => ({ ...a, [name]: "done" })), 2400);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "14px 20px 0", flexShrink: 0 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "4px 12px", borderRadius: R.pill,
          border: `1px solid ${C.accBr}`, background: C.accDim,
          fontSize: 10, color: C.acc2, marginBottom: 12,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: R.pill, background: C.acc2, display: "inline-block" }} />
          GPT-4o Vision · fal pipeline · one-time analysis
        </div>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: C.t1, marginBottom: 4 }}>Reference analyzer</div>
        <div style={{ fontSize: 11, color: C.t3, marginBottom: 16, lineHeight: 1.5 }}>
          Upload image, video, or paste a YouTube URL. GPT-4o Vision analyzes in micro detail. Recreate, vary, style-transfer, or animate from any reference.
        </div>
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }} className="streams-ref-shell">

        {/* Left panel */}
        <div style={{
          width: 280, flexShrink: 0, borderRight: `1px solid ${C.bdr}`,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }} className="streams-ref-left">

          {/* Source selector */}
          <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${C.bdr}`, flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>Source</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {(["Upload","URL","YouTube"] as Source[]).map(s => (
                <button key={s} onClick={() => setSource(s)} style={{
                  flex: 1, padding: "6px 0", borderRadius: R.r1, fontSize: 10, fontFamily: "inherit", cursor: "pointer",
                  border: `1px solid ${source === s ? C.acc : C.bdr}`,
                  background: source === s ? C.acc : "transparent",
                  color: source === s ? "#fff" : C.t3,
                }}>{s}</button>
              ))}
            </div>

            {source === "Upload" && (
              <div onClick={runAnalysis} style={{
                border: `1px dashed ${C.bdr2}`, borderRadius: R.r2,
                padding: "24px 14px", textAlign: "center", cursor: "pointer",
                background: C.bg3, transition: `border-color ${DUR.fast} ${EASE}`,
              }}>
                <div style={{ fontSize: 24, color: C.t4, marginBottom: 8, opacity: .5 }}>↑</div>
                <div style={{ fontSize: 12, color: C.t2, fontWeight: 500 }}>Drop file or click</div>
                <div style={{ fontSize: 10, color: C.t4, marginTop: 4 }}>image · video · up to 2GB</div>
              </div>
            )}

            {(source === "URL" || source === "YouTube") && (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={urlInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrlInput(e.target.value)}
                  placeholder={source === "YouTube" ? "https://youtube.com/watch?v=…" : "https://…"}
                  style={{
                    flex: 1, background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1,
                    padding: "8px 10px", color: C.t1, fontSize: 11, fontFamily: "inherit", outline: "none",
                  }}
                />
                <button onClick={runAnalysis} style={{
                  padding: "8px 12px", borderRadius: R.r1, background: C.acc,
                  border: "none", color: "#fff", fontSize: 12, cursor: "pointer",
                }}>→</button>
              </div>
            )}

            {source === "YouTube" && (
              <div style={{ fontSize: 9, color: C.t4, marginTop: 8, lineHeight: 1.5 }}>
                Server-side: yt-dlp → ffmpeg frame extract → audio isolation → Scribe v2 → GPT-4o Vision. 60–90s. Worker job — not HTTP route.
              </div>
            )}
          </div>

          {/* Analyzing state */}
          {analysis === "analyzing" && (
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {["Extracting frames…","Isolating audio…","Running GPT-4o Vision…","Transcribing (Scribe v2)…"].map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: C.t3 }}>
                  <span style={{ width: 16, height: 16, borderRadius: R.pill, border: `1.5px solid ${C.acc}`, borderTopColor: "transparent", display: "block", animation: "streams-spin 600ms linear infinite", flexShrink: 0 }} />
                  {step}
                </div>
              ))}
            </div>
          )}

          {/* Analysis output */}
          {analysis === "done" && (
            <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Color palette */}
              <div>
                <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Color palette</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {PALETTE.map(hex => (
                    <div key={hex} title={hex} style={{ width: 28, height: 28, borderRadius: R.r1, background: hex, border: `1px solid ${C.bdr}`, cursor: "pointer", flexShrink: 0 }} />
                  ))}
                </div>
              </div>

              {[
                { label: "Lighting",     val: "Golden hour. Hard directional, warm ~4200K. Long shadows right." },
                { label: "Composition",  val: "Subject left third, negative space right. f/1.8 est. Shallow DOF." },
                { label: "Camera",       val: "~85mm equiv. Shallow DOF, handheld feel. Low chromatic aberration." },
              ].map(row => (
                <div key={row.label}>
                  <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>{row.label}</div>
                  <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.5 }}>{row.val}</div>
                </div>
              ))}

              <div>
                <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Style</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {STYLE_TAGS.map(t => (
                    <span key={t} style={{ padding: "2px 8px", borderRadius: R.pill, background: C.surf, border: `1px solid ${C.bdr}`, fontSize: 10, color: C.t2 }}>{t}</span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Subjects</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {SUBJECTS.map(s => (
                    <span key={s} style={{ padding: "2px 8px", borderRadius: R.pill, background: C.surf, border: `1px solid ${C.bdr}`, fontSize: 10, color: C.t2 }}>{s}</span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Reconstruction prompt</div>
                <div contentEditable suppressContentEditableWarning style={{
                  background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1,
                  padding: "8px 10px", fontSize: 11, color: C.t2, lineHeight: 1.5,
                  fontFamily: "inherit", minHeight: 60, outline: "none",
                }}>
                  Cinematic street portrait, woman in tailored blazer, 85mm equiv, golden hour f/1.8, warm 4200K, urban bokeh background, photorealistic
                </div>
              </div>

              {/* Variation prompts */}
              <div>
                <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Variation prompts</div>
                {[
                  "Cinematic street portrait, woman in bold red coat, 85mm equiv, overcast light, urban background",
                  "Same subject, dramatic low-angle, late dusk, neon reflections, shallow DOF",
                  "Wide establishing shot, woman silhouette against city skyline, golden hour backlight",
                ].map((vp, i) => (
                  <div key={i} onClick={() => {}} style={{ padding: "6px 10px", borderRadius: R.r1, marginBottom: 4, fontSize: 10, color: C.t3, background: C.bg4, border: `1px solid ${C.bdr}`, cursor: "pointer", lineHeight: 1.5 }}>
                    {vp}
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[
                  { name: "Recreate",   icon: "✦", sub: "exact match"      },
                  { name: "Variation",  icon: "↻", sub: "new composition"  },
                  { name: "Style only", icon: "◉", sub: "new subject"      },
                  { name: "Animate",    icon: "▶", sub: "Kling / Veo I2V"  },
                ].map(action => (
                  <button key={action.name} onClick={() => doAction(action.name)} style={{
                    padding: "10px 8px", borderRadius: R.r2, cursor: "pointer", fontFamily: "inherit",
                    border: `1px solid ${actions[action.name] === "done" ? C.accBr : C.bdr}`,
                    background: actions[action.name] === "done" ? C.accDim : C.surf,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    transition: `all ${DUR.fast} ${EASE}`,
                  }}>
                    {actions[action.name] === "running"
                      ? <span style={{ width: 14, height: 14, borderRadius: R.pill, border: `2px solid ${C.acc}`, borderTopColor: "transparent", display: "block", animation: "streams-spin 600ms linear infinite" }} />
                      : <span style={{ fontSize: 14, color: actions[action.name] === "done" ? C.acc2 : C.t2 }}>{action.icon}</span>
                    }
                    <span style={{ fontSize: 11, color: actions[action.name] === "done" ? C.acc2 : C.t1, fontWeight: 500 }}>{action.name}</span>
                    <span style={{ fontSize: 9, color: C.t4 }}>{action.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — preview + outputs */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Preview area */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", padding: 20 }}>
            {analysis === "done" ? (
              <div style={{ width: "100%", maxWidth: 480, aspectRatio: "16/9", borderRadius: R.r2, background: C.bg3, border: `1px solid ${C.bdr}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <svg width="44" height="44" viewBox="0 0 36 36" fill="none"><rect x="2" y="2" width="32" height="32" rx="5" stroke="#3D2E8A" strokeWidth="1.5"/><path d="M2 25l9-9 6 6 6-8 11 11" stroke="#3D2E8A" strokeWidth="1.5" strokeLinecap="round"/><circle cx="11" cy="12" r="3" fill="#3D2E8A"/></svg>
                <div style={{ fontSize: 10, color: C.t4 }}>Reference analyzed · GPT-4o Vision</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: C.t4 }}>
                <div style={{ fontSize: 40, opacity: .2 }}>⊞</div>
                <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase" }}>Drop reference or click Upload</div>
              </div>
            )}
          </div>

          {/* Output grid */}
          <div style={{ height: 100, flexShrink: 0, borderTop: `1px solid ${C.bdr}`, background: C.bg2, display: "flex", gap: 0 }}>
            {["output_01","output_02","output_03"].map((label, i) => (
              <div key={label} style={{
                flex: 1, borderRight: i < 2 ? `1px solid ${C.bdr}` : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 6,
                background: actions[["Recreate","Variation","Style only"][i]] === "done" ? C.accDim : "transparent",
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: R.r1, background: C.bg3, border: `1px solid ${C.bdr}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {actions[["Recreate","Variation","Style only"][i]] === "running"
                    ? <span style={{ width: 14, height: 14, borderRadius: R.pill, border: `2px solid ${C.acc}`, borderTopColor: "transparent", display: "block", animation: "streams-spin 600ms linear infinite" }} />
                    : <span style={{ fontSize: 12, color: C.t4 }}>□</span>
                  }
                </div>
                <div style={{ fontSize: 9, color: C.t4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes streams-spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .streams-ref-shell { flex-direction: column !important; }
          .streams-ref-left  { width: 100% !important; border-right: none !important; border-bottom: 1px solid ${C.bdr}; }
        }
      `}</style>
    </div>
  );
}
