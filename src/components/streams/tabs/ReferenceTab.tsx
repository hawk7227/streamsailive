"use client";
import MediaPlayer from "../VideoPlayer";

/**
 * ReferenceTab — Reference analyzer.
 * Upload · URL · YouTube → GPT-4o Vision analysis → 4 actions.
 * Mobile-first: panels stack vertically.
 * No backend — shell only. Route needed: /api/reference/analyze
 */

import { useState } from "react";
import FileUpload from "../FileUpload";
import { C, R, DUR, EASE } from "../tokens";

type Source = "Upload" | "URL" | "YouTube";
type AnalysisState = "idle" | "analyzing" | "done";
type ActionState = "idle" | "running" | "done";

const PALETTE = ["#F5A52A","#2C1A0E","#E8C87A","#8B5E3C","#F2EDE4"];
const STYLE_TAGS = ["cinematic","golden hour","photorealistic","urban"];
const SUBJECTS   = ["woman · blazer","city street","bokeh background"];

interface ReferenceTabProps {
  onSelectPrompt?: (prompt: string) => void;
}

export default function ReferenceTab({ onSelectPrompt }: ReferenceTabProps = {}) {
  const [source,       setSource]      = useState<Source>("Upload");
  const [urlInput,     setUrlInput]    = useState("");
  const [analysis,     setAnalysis]    = useState<AnalysisState>("idle");
  const [analysisData, setAnalysisData]= useState<Record<string, unknown> | null>(null);
  const [analyzeError, setAnalyzeError]= useState<string | null>(null);
  const [actions,      setActions]     = useState<Record<string, ActionState>>({} as Record<string, ActionState>);

  async function runAnalysis() {
    const url = source === "Upload" ? urlInput : urlInput.trim();
    if (!url) return;
    setAnalysis("analyzing");
    setAnalyzeError(null);
    setAnalysisData(null);
    try {
      const res  = await fetch("/api/streams/reference/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sourceType: source.toLowerCase(), sourceUrl: url }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        setAnalyzeError((data.error as string) ?? "Analysis failed");
        setAnalysis("idle");
        return;
      }
      setAnalysisData(data);
      setAnalysis("done");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
      setAnalysis("idle");
    }
  }

  const [actionResults, setActionResults] = useState<Record<string,string>>({});

  async function doAction(name: string) {
    if (!urlInput) return;
    setActions((a: Record<string, ActionState>) => ({ ...a, [name]: "running" }));
    const reconstructionPrompt = (analysisData?.reconstruction_prompt as string)
      ?? "Cinematic street portrait, woman in tailored blazer, 85mm equiv, golden hour f/1.8, warm 4200K, urban bokeh background, photorealistic";

    const promptMap: Record<string, string> = {
      "Recreate":   reconstructionPrompt,
      "Variation":  reconstructionPrompt + ", different composition, new angle",
      "Style only": reconstructionPrompt + ", different subject, same visual style",
      "Animate":    reconstructionPrompt,
    };

    try {
      const isVideo = name === "Animate";
      const route   = isVideo ? "/api/streams/video/generate" : "/api/streams/image/generate";
      const body    = isVideo
        ? { prompt: promptMap[name], duration: "5", aspectRatio: "16:9" }
        : { model: "kontext", prompt: promptMap[name], aspectRatio: "1:1" };

      const res  = await fetch(route, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
      const data = await res.json() as { outputUrl?: string; generationId?: string; error?: string };

      if (res.ok && data.outputUrl) {
        setActionResults((r:Record<string,string>) => ({ ...r, [name]: data.outputUrl! }));
        setActions((a: Record<string, ActionState>) => ({ ...a, [name]: "done" }));
      } else {
        setActions((a: Record<string, ActionState>) => ({ ...a, [name]: "idle" }));
      }
    } catch {
      setActions((a: Record<string, ActionState>) => ({ ...a, [name]: "idle" }));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "4px 12px", borderRadius: R.pill,
          border: `1px solid ${C.accBr}`, background: C.accDim,
          fontSize: 13, color: C.acc2, marginBottom: 12,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: R.pill, background: C.acc2, display: "inline-block" }} />
          GPT-4o Vision · fal pipeline · one-time analysis
        </div>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: C.t1, marginBottom: 4 }}>Reference analyzer</div>
        <div style={{ fontSize: 14, color: C.t3, marginBottom: 16, lineHeight: 1.5 }}>
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
          <div style={{ padding: "16px 16px 8px", borderBottom: `1px solid ${C.bdr}`, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>Source</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {(["Upload","URL","YouTube"] as Source[]).map(s => (
                <button key={s} onClick={() => setSource(s)} style={{
                  flex: 1, padding: "8px 0", borderRadius: R.r1, fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                  border: `1px solid ${source === s ? C.acc : C.bdr}`,
                  background: source === s ? C.acc : "transparent",
                  color: source === s ? "#fff" : C.t3,
                }}>{s}</button>
              ))}
            </div>

            {source === "Upload" && (
              <div style={{ marginBottom: 10 }}>
                <input value={urlInput} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrlInput(e.target.value)}
                  placeholder="Paste image URL or Supabase storage URL"
                  style={{ width: "100%", background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1, padding: "8px 8px", color: C.t1, fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 8 }} />
              </div>
            )}
            {source === "Upload" && (
              <FileUpload
                accept="any"
                label="Upload reference"
                sublabel="image · video · up to 500MB"
                onUpload={(url: string) => { setUrlInput(url); }}
              />
            )}
            {source === "Upload" && urlInput && (
              <button onClick={runAnalysis} style={{
                marginTop: 8, width: "100%", padding: "8px 0", borderRadius: R.r1,
                background: C.acc, border: "none", color: "#fff",
                fontSize: 14, fontFamily: "inherit", cursor: "pointer",
              }}>
                Analyze →
              </button>
            )}

            {(source === "URL" || source === "YouTube") && (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={urlInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrlInput(e.target.value)}
                  placeholder={source === "YouTube" ? "https://youtube.com/watch?v=…" : "https://…"}
                  style={{
                    flex: 1, background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1,
                    padding: "8px 8px", color: C.t1, fontSize: 14, fontFamily: "inherit", outline: "none",
                  }}
                />
                <button onClick={source === "YouTube" ? undefined : runAnalysis}
                  disabled={source === "YouTube" || !urlInput.trim()}
                  aria-label="Analyze URL"
                  style={{
                  padding: "8px 12px", borderRadius: R.r1,
                  background: (source === "YouTube" || !urlInput.trim()) ? C.bg4 : C.acc,
                  border: "none", color: (source === "YouTube" || !urlInput.trim()) ? C.t4 : "#fff",
                  fontSize: 15, cursor: (source === "YouTube" || !urlInput.trim()) ? "not-allowed" : "pointer",
                }}>→</button>
              </div>
            )}

            {source === "YouTube" && (
              <div style={{ fontSize: 12, color: C.amber, marginTop: 8, lineHeight: 1.5, padding: "8px 12px", borderRadius: R.r1, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                YouTube requires a background worker (yt-dlp → ffmpeg → Scribe). Not available in HTTP routes — coming in next release.
              </div>
            )}
          </div>

          {/* Analyzing state */}
          {analysis === "analyzing" && (
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {["Extracting frames…","Isolating audio…","Running GPT-4o Vision…","Transcribing (Scribe v2)…"].map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: C.t3 }}>
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
                <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Color palette</div>
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
                  <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>{row.label}</div>
                  <div style={{ fontSize: 14, color: C.t2, lineHeight: 1.5 }}>{row.val}</div>
                </div>
              ))}

              <div>
                <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Style</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {STYLE_TAGS.map(t => (
                    <span key={t} style={{ padding: "2px 8px", borderRadius: R.pill, background: C.surf, border: `1px solid ${C.bdr}`, fontSize: 13, color: C.t2 }}>{t}</span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Subjects</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {SUBJECTS.map(s => (
                    <span key={s} style={{ padding: "2px 8px", borderRadius: R.pill, background: C.surf, border: `1px solid ${C.bdr}`, fontSize: 13, color: C.t2 }}>{s}</span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Reconstruction prompt</div>
                <div contentEditable suppressContentEditableWarning style={{
                  background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1,
                  padding: "8px 8px", fontSize: 14, color: C.t2, lineHeight: 1.5,
                  fontFamily: "inherit", minHeight: 60, outline: "none",
                }}>
                  Cinematic street portrait, woman in tailored blazer, 85mm equiv, golden hour f/1.8, warm 4200K, urban bokeh background, photorealistic
                </div>
              </div>

              {/* Variation prompts */}
              <div>
                <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Variation prompts</div>
                {((analysisData?.variation_prompts as string[]) ?? [
                  "Cinematic street portrait, woman in bold red coat, 85mm equiv, overcast light, urban background",
                  "Same subject, dramatic low-angle, late dusk, neon reflections, shallow DOF",
                  "Wide establishing shot, woman silhouette against city skyline, golden hour backlight",
                ]).map((vp: string, i: number) => (
                  <div key={i}
                    role="button" tabIndex={onSelectPrompt ? 0 : -1}
                    onClick={() => onSelectPrompt?.(vp)}
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key==="Enter"||e.key===" ") onSelectPrompt?.(vp); }}
                    style={{ padding: "8px 8px", borderRadius: R.r1, marginBottom: 4, fontSize: 13, color: C.t3, background: C.bg4, border: `1px solid ${C.bdr}`, cursor: onSelectPrompt ? "pointer" : "default", lineHeight: 1.5, transition:`background 150ms ease` }}>
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
                  { name: "Animate",    icon: "▶", sub: "Generate motion"   },
                ].map(action => (
                  <button key={action.name} onClick={() => doAction(action.name)} style={{
                    padding: "8px 8px", borderRadius: R.r2, cursor: "pointer", fontFamily: "inherit",
                    border: `1px solid ${actions[action.name] === "done" ? C.accBr : C.bdr}`,
                    background: actions[action.name] === "done" ? C.accDim : C.surf,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    transition: `all ${DUR.fast} ${EASE}`,
                  }}>
                    {actions[action.name] === "running"
                      ? <span style={{ width: 14, height: 14, borderRadius: R.pill, border: `2px solid ${C.acc}`, borderTopColor: "transparent", display: "block", animation: "streams-spin 600ms linear infinite" }} />
                      : <span style={{ fontSize: 14, color: actions[action.name] === "done" ? C.acc2 : C.t2 }}>{action.icon}</span>
                    }
                    <span style={{ fontSize: 14, color: actions[action.name] === "done" ? C.acc2 : C.t1, fontWeight: 500 }}>{action.name}</span>
                    <span style={{ fontSize: 12, color: C.t4 }}>{action.sub}</span>
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
            {urlInput ? (
              <div style={{ width: "100%", maxWidth: "min(1180px, 100%)" }}>
                {urlInput ? (
                  <MediaPlayer
                    src={urlInput}
                    kind={urlInput.match(/\.(mp4|mov|webm)$/i) ? "video" : "image"}
                    aspectRatio="16/9"
                    showDownload
                    label="Reference"
                  />
                ) : (
                  <div style={{ aspectRatio: "16/9", background: C.bg3, borderRadius: R.r2,
                                border: `1px solid ${C.bdr}`, display: "flex",
                                alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: 13, color: C.t4, textAlign:"center" }}>
                      {analysis === "analyzing" ? "Analyzing with GPT-4o Vision…" : "Add a URL or upload to see a 4K preview"}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: C.t4 }}>
                <div style={{ fontSize: 40, opacity: .2 }}>⊞</div>
                <div style={{ fontSize: 14, letterSpacing: ".06em", textTransform: "uppercase" }}>Drop reference or click Upload</div>
              </div>
            )}
          </div>

          {/* Output grid — shows real generated results */}
          {Object.keys(actionResults).length > 0 && (
            <div className="streams-ref-scroll" style={{ flexShrink:0, borderTop:`1px solid ${C.bdr}`, background:C.bg2, padding:8, display:"flex", gap:8, overflowX:"auto" }}>
              {Object.entries(actionResults).map(([name, url]) => (
                <div key={name} style={{ minWidth:140, flexShrink:0 }}>
                  <div style={{ fontSize:12, color:C.t4, marginBottom:4 }}>{name}</div>
                  <div style={{ borderRadius:R.r1, overflow:"hidden" }}>
                    <MediaPlayer src={url as string} kind={name==="Animate"?"video":"image"} aspectRatio="1/1" showDownload label={name}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes streams-spin { to { transform: rotate(360deg); } }
        .streams-ref-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .streams-ref-scroll::-webkit-scrollbar { display: none; }
        @media (max-width: 767px) {
          .streams-root .streams-ref-shell { flex-direction: column; }
          .streams-root .streams-ref-left  { width: 100%; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.08); }
        }
      `}</style>
    </div>
  );
}
