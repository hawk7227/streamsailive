"use client";

/**
 * PersonTab — Person editing pipeline.
 * Ingest pipeline status + 6 edit operations.
 * Mobile-first: cards stack vertically.
 * No backend — shell only.
 */

import { useState, useRef } from "react";
import MediaPlayer from "../VideoPlayer";
import FileUpload from "../FileUpload";
import { useToast } from "../Toast";
import { C, R, DUR, EASE } from "../tokens";

type EditOp = "voice" | "body" | "motion" | "dub" | "emotion" | "multishot";
type IngestState = "idle" | "uploading" | "processing" | "done" | "failed";

interface PersonTabProps {
  onIngestComplete?: (data: { analysisId: string; genLogId: string; voiceId?: string | null }) => void;
  videoUrl?:         string | null;
}
type OpState = "idle" | "running" | "done";

const INGEST_STEPS = [
  { label: "Extract audio from video",                               done: true  },
  { label: "Isolate voice and ambient audio",                        done: true  },
  { label: "Extract frames at 1 per 2s",                            done: true  },
  { label: "Analyse each frame for person details",                  done: true  },
  { label: "Identify best frame · appearance description",           done: true  },
  { label: "Transcribe speech · word-level timestamps",              done: true  },
  { label: "Clone voice profile · store voice ID",                   done: true  },
  { label: "Write person profile · all fields populated",            done: true  },
];

const EDIT_OPS: {
  id: EditOp; title: string; sub: string;
  endpoints: string[]; cost: string; costColor: string;
}[] = [
  {
    id: "voice", title: "Voice / word edit",
    sub: "User changes transcript text → TTS → duration check → trim segment → Streams Lipsync redraws mouth region → compose back at timestamp.",
    endpoints: ["Streams TTS · voice synthesis","Streams Lipsync · mouth re-draw","Streams Compose · timeline merge"],
    cost: "~$0.18 · 3.6s segment", costColor: C.green,
  },
  {
    id: "body", title: "Full body reaction",
    sub: "Stored face frame + new audio → Streams Body drives entire upper body. Audio rhythm controls posture, gestures, expressions. Single-person only.",
    endpoints: ["Streams Body · upper body animation","Streams Merge · audio + video"],
    cost: "$0.16/sec · from stored frame", costColor: C.amber,
  },
  {
    id: "motion", title: "Motion style change",
    sub: "User uploads motion reference video. Appearance description auto-fills character prompt. Motion control transfers the movement style.",
    endpoints: ["Streams Motion · style transfer","Streams Compose · timeline merge"],
    cost: "~$0.56 · 5s shot only", costColor: C.acc2,
  },
  {
    id: "dub", title: "Language dub",
    sub: "One-click re-voice entire video in any language. Streams Dub handles translation + voice synthesis + lipsync in one call. Writes new video version.",
    endpoints: ["Streams Dub · translate + lipsync"],
    cost: "$0.90/min · full video", costColor: C.amber,
  },
  {
    id: "emotion", title: "Expression / emotion",
    sub: "Change emotional delivery of existing footage. Controls: emotion, head mode, temperature. Zero retraining. Modifies existing video — no regeneration.",
    endpoints: ["Streams Emotion · expression control"],
    cost: "low cost · modifies existing", costColor: C.green,
  },
  {
    id: "multishot", title: "Multi-shot motion",
    sub: "Multi-prompt — N shots in one call. No stitch needed. Each prompt maps to an editable motion beat immediately.",
    endpoints: ["Streams Motion · multi-prompt","multi_prompt: [{prompt, duration}]"],
    cost: "one call · no stitching", costColor: C.acc2,
  },
];

export default function PersonTab({ onIngestComplete, videoUrl: propVideoUrl }: PersonTabProps = {}) {
  const { toast } = useToast();
  const [ingestState,  setIngestState]  = useState<IngestState>("idle");
  type LibItem = { id:string; output_url:string; generation_type:string; created_at:string; cost_usd?:number|null };
  const [libItems,    setLibItems]    = useState<LibItem[]>([]);
  const [libLoading,  setLibLoading]  = useState(false);
  const [libLoaded,   setLibLoaded]   = useState(false);
  const [ingestVideoUrl, setIngestVideoUrl] = useState<string|null>(null);

  async function loadLibrary() {
    if (libLoaded) return;
    setLibLoading(true);
    try {
      const res  = await fetch("/api/streams/library?type=video&status=done&limit=20");
      const data = await res.json() as { items?: LibItem[] };
      setLibItems(data.items ?? []);
      setLibLoaded(true);
    } catch { /* non-fatal */ }
    finally { setLibLoading(false); }
  }
  const [analysisId,   setAnalysisId]   = useState<string | null>(null);
  const [genLogId,     setGenLogId]     = useState<string | null>(null);
  const [ingestError,  setIngestError]  = useState<string | null>(null);
  const [pollCount,    setPollCount]    = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function handleIngest(videoUrl: string) {
    setIngestVideoUrl(videoUrl);
    setIngestState("uploading");
    setIngestError(null);
    try {
      const res  = await fetch("/api/streams/video/ingest", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ videoUrl }),
      });
      const data = await res.json() as { analysisId?: string; error?: string };
      if (!res.ok || !data.analysisId) {
        setIngestError(data.error ?? "Ingest failed");
        setIngestState("failed");
        return;
      }
      setAnalysisId(data.analysisId);
      // genLogId: use generationLogId if ingest route returns it, else analysisId as fallback
      // The ingest route creates a generation_log row and returns its ID
      setGenLogId((data as Record<string,unknown>).generationLogId as string ?? data.analysisId);
      setIngestState("processing");

      // Poll ingest/status every 8s
      pollRef.current = setInterval(async () => {
        setPollCount((n: number) => n + 1);
        const statusRes  = await fetch("/api/streams/video/ingest/status", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ analysisId: data.analysisId }),
        });
        const statusData = await statusRes.json() as { status?: string };
        if (statusData.status === "done") {
          clearInterval(pollRef.current!);
          setIngestState("done");
          // Notify StreamsPanel so VideoEditorTab can load transcript
          onIngestComplete?.({
            analysisId: data.analysisId ?? "",
            genLogId:   data.analysisId ?? "", // analysisId used as genLogId until real link
            voiceId:    null,             // populated after IVC step completes
          });
        } else if (statusData.status === "failed") {
          clearInterval(pollRef.current!);
          setIngestError("Ingest pipeline failed");
          setIngestState("failed");
        }
      }, 8000);
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : "Ingest failed");
      setIngestState("failed");
    }
  }

  const [opResults, setOpResults] = useState<Record<string,string>>({});
  const [opStates, setOpStates] = useState<Record<EditOp, OpState>>(
    Object.fromEntries(EDIT_OPS.map(op => [op.id, "idle"])) as Record<EditOp, OpState>
  );

  async function runOp(id: EditOp) {
    setOpStates((s: Record<EditOp, OpState>) => ({ ...s, [id]: "running" }));

    // Route map — each op calls its real API route
    const ROUTES: Partial<Record<EditOp, string>> = {
      "voice":     "/api/streams/video/edit-voice",
      "body":      "/api/streams/video/edit-body",
      "motion":    "/api/streams/video/edit-motion",
      "dub":       "/api/streams/video/dub",
      "emotion":   "/api/streams/video/edit-emotion",
      "multishot": "/api/streams/video/generate",
    };

    const route = ROUTES[id];
    if (!route) {
      setOpStates((s: Record<EditOp, OpState>) => ({ ...s, [id]: "idle" }));
      return;
    }

    if (!analysisId || !genLogId) {
      toast.warn("Ingest a video first — upload in the box above to enable editing");
      setOpStates((s: Record<EditOp, OpState>) => ({ ...s, [id]: "idle" }));
      return;
    }

    try {
      // propVideoUrl from StreamsPanel.sharedVideoUrl — all ops need source video
      const srcVideo = propVideoUrl ?? "";
      const bodyMap: Record<string, Record<string, unknown>> = {
        "voice":    { generationLogId: genLogId, analysisId, originalText: "", newText: "edited text", startMs: 1000, endMs: 2000, videoUrl: srcVideo },
        "body":     { generationLogId: genLogId, analysisId, newText: "New dialogue for full body reaction", audioUrl: undefined },
        "motion":   { generationLogId: genLogId, firstFrameUrl: srcVideo, newPrompt: "new motion style", startMs: 0, endMs: 5000, videoUrl: srcVideo },
        "dub":      { generationLogId: genLogId, videoUrl: srcVideo, targetLanguage: "es" },
        "emotion":  { generationLogId: genLogId, videoUrl: srcVideo, emotion: "happy" },
        "multishot":{ prompt: "continue the scene", duration: "5", aspectRatio: "16:9" },
      };

      const res  = await fetch(route, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(bodyMap[id] ?? {}),
      });
      const data = await res.json() as { error?: string; status?: string; responseUrl?: string; generationId?: string };

      if (!res.ok) {
        console.error(`${id} op failed:`, data.error);
        setOpStates((s: Record<EditOp, OpState>) => ({ ...s, [id]: "idle" }));
        return;
      }

      // OmniHuman (body) returns a fal responseUrl — poll status route for completion
      if (id === "body" && data.responseUrl && data.generationId) {
        const omniInterval = setInterval(async () => {
          const sr = await fetch("/api/streams/video/status", {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ generationId: data.generationId, responseUrl: data.responseUrl }),
          });
          const sd = await sr.json() as { status?:string; artifactUrl?:string };
          if (sd.status === "done" || sd.status === "completed") {
            clearInterval(omniInterval);
            setOpStates((s: Record<EditOp, OpState>) => ({ ...s, [id]: "done" }));
            if (sd.artifactUrl) {
              setOpResults((prev: Record<string,string>) => ({ ...prev, [id]: sd.artifactUrl as string }));
            }
          } else if (sd.status === "failed") {
            clearInterval(omniInterval);
            setOpStates((s: Record<EditOp, OpState>) => ({ ...s, [id]: "idle" }));
          }
        }, 8000);
        // Timeout after 5 min (OmniHuman can be slow)
        setTimeout(() => clearInterval(omniInterval), 300_000);
      } else {
        setOpStates((s: Record<EditOp, OpState>) => ({ ...s, [id]: "done" }));
      }
    } catch (err) {
      console.error(`${id} op error:`, err);
      setOpStates((s: Record<EditOp, OpState>) => ({ ...s, [id]: "idle" }));
    }
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "20px" }} className="streams-person-scroll">
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Video selector */}
        <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: R.r3, padding: 16 }}>
          <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>Select video to edit</div>

          {/* Upload zone — shows FileUpload when idle/failed, MediaPlayer when done */}
          {ingestState === "done" && ingestVideoUrl ? (
            <div style={{ borderRadius: R.r2, overflow: "hidden", marginBottom: 12 }}>
              <MediaPlayer
                src={ingestVideoUrl}
                kind="video"
                aspectRatio="16/9"
                showDownload
                label="Ingested video"
              />
              <div style={{ padding: "8px 14px", background: "rgba(16,185,129,0.08)",
                            border: `1px solid rgba(16,185,129,0.25)`,
                            borderTop: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: C.green, fontWeight: 500 }}>✓ Ingest complete</span>
                <span style={{ fontSize: 12, color: C.t4, marginLeft: "auto" }}>
                  {analysisId?.slice(0,8)}…
                </span>
                <button onClick={() => { setIngestState("idle"); setIngestVideoUrl(null); setAnalysisId(null); }}
                  style={{ fontSize: 12, color: C.t4, background: "none", border: "none",
                           cursor: "pointer", fontFamily: "inherit" }}>
                  Change
                </button>
              </div>
            </div>
          ) : ingestState === "processing" ? (
            <div style={{ padding: "20px 16px", borderRadius: R.r2, background: C.bg3,
                          border: `1px solid ${C.acc}`, textAlign: "center", marginBottom: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%",
                            border: `2px solid ${C.acc}`, borderTopColor: "transparent",
                            animation: "streams-spin 700ms linear infinite",
                            margin: "0 auto 10px" }} />
              <div style={{ fontSize: 13, color: C.acc2, fontWeight: 500 }}>
                Processing… ({pollCount} polls)
              </div>
              <div style={{ fontSize: 12, color: C.t4, marginTop: 4 }}>8-step pipeline running</div>
            </div>
          ) : (
            <FileUpload
              accept="video"
              label={ingestState === "failed" ? "Retry — upload video" : "Upload video"}
              sublabel="mp4 · mov · webm · up to 500MB — triggers 8-step ingest"
              onUpload={(url: string) => handleIngest(url)}
              onError={(msg: string) => toast.error(msg)}
            />
          )}

          {/* Library picker */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".06em",
                          textTransform: "uppercase", marginBottom: 8 }}>From Library</div>
            {!libLoaded && !libLoading && (
              <button onClick={loadLibrary}
                style={{ fontSize: 13, color: C.acc2, background: "none", border: "none",
                         cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                Load recent videos →
              </button>
            )}
            {libLoading && (
              <div style={{ display:"flex", flexDirection:"column", gap:6, padding:"4px 0" }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8,
                    padding:"8px 8px", borderRadius:R.r1,
                    border:`1px solid ${C.bdr}`, background:C.bg4 }}>
                    <div style={{ width:22, height:22, borderRadius:"50%", flexShrink:0,
                      background:`linear-gradient(90deg, ${C.bg3} 25%, ${C.bg4} 50%, ${C.bg3} 75%)`,
                      backgroundSize:"200% 100%", animation:`streams-shimmer ${1.2+i*0.15}s ease infinite` }} />
                    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:4 }}>
                      <div style={{ height:12, borderRadius:R.r1, width:"55%",
                        background:`linear-gradient(90deg, ${C.bg3} 25%, ${C.bg4} 50%, ${C.bg3} 75%)`,
                        backgroundSize:"200% 100%", animation:`streams-shimmer ${1.3+i*0.1}s ease infinite` }} />
                      <div style={{ height:10, borderRadius:R.r1, width:"35%",
                        background:`linear-gradient(90deg, ${C.bg3} 25%, ${C.bg4} 50%, ${C.bg3} 75%)`,
                        backgroundSize:"200% 100%", animation:`streams-shimmer ${1.5+i*0.1}s ease infinite` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {libItems.map((item: LibItem) => (
              <div key={item.id} onClick={() => handleIngest(item.output_url)}
                style={{ padding: "8px 8px", borderRadius: R.r1, cursor: "pointer",
                         marginBottom: 4, background: C.bg4, border: `1px solid ${C.bdr}`,
                         display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15 }}>
                  {item.generation_type === "image" ? "🖼" : item.generation_type === "music" ? "🎵" : "🎬"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: C.t2, overflow: "hidden",
                                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.generation_type.replace("_"," ")}
                  </div>
                  <div style={{ fontSize: 12, color: C.t4, display:"flex", gap:8 }}>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    {item.cost_usd != null && (
                      <span style={{ color:"rgba(245,158,11,0.8)" }}>${item.cost_usd.toFixed(3)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 1 — Ingest pipeline */}
        <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: R.r3, overflow: "hidden" }}>
          <div style={{
            padding: "16px 18px", borderBottom: `1px solid ${C.bdr}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: C.t1 }}>
              Ingest pipeline — runs once on video creation
            </div>
            <span style={{ fontSize: 12, padding: "4px 8px", borderRadius: R.pill, background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.25)", color: C.green }}>
              auto-runs on every video
            </span>
          </div>
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            {INGEST_STEPS.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: R.pill, flexShrink: 0,
                  background: step.done ? C.green : C.t4,
                  boxShadow: step.done ? `0 0 6px ${C.green}` : "none",
                }} />
                <span style={{ fontSize: 14, color: step.done ? C.t2 : C.t4, lineHeight: 1.4 }}>{step.label}</span>
              </div>
            ))}
          </div>

          {/* Stored data summary */}
          <div style={{
            margin: "0 18px 16px", padding: "12px 16px",
            background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r2,
            fontSize: 14, color: C.t3, lineHeight: 1.7,
          }}>
            Stored once:{" "}
            {["voice.mp3","ambient.mp3","silent_video.mp4","transcript.json","frames[]","face_reference.jpg","appearance_description","voice_id","speakingSegments[]"].map((item, i) => (
              <span key={item}>
                <span style={{ color: C.acc2 }}>{item}</span>
                {i < 8 && <span style={{ color: C.t4 }}> · </span>}
              </span>
            ))}
            <br />
            <span style={{ color: C.t4 }}>All edit operations read from this. GPT-4o Vision never runs again for this video.</span>
          </div>
        </div>

        {/* Card 2 — Edit operations */}
        <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: R.r3, overflow: "hidden" }}>
          <div style={{
            padding: "16px 18px", borderBottom: `1px solid ${C.bdr}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: C.t1 }}>
              Edit operations — each is a single fal API call
            </div>
            <span style={{ fontSize: 12, padding: "4px 8px", borderRadius: R.pill, background: C.accDim, border: `1px solid ${C.accBr}`, color: C.acc2 }}>
              API key only
            </span>
          </div>

          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }} className="streams-ops-grid">
            {EDIT_OPS.map(op => (
              <div key={op.id} style={{
                background: opStates[op.id] === "done" ? C.accDim : C.bg3,
                border: `1px solid ${opStates[op.id] === "done" ? C.accBr : C.bdr}`,
                borderRadius: R.r2, padding: "16px",
                transition: `all ${DUR.base} ${EASE}`,
              }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: C.t1, marginBottom: 6 }}>{op.title}</div>
                <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.55, marginBottom: 10 }}>{op.sub}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                  {op.endpoints.map(ep => (
                    <div key={ep} style={{
                      fontSize: 12, padding: "4px 8px", borderRadius: R.r1,
                      background: C.bg4, border: `1px solid ${C.bdr}`,
                      color: C.t3, fontFamily: "inherit",
                    }}>{ep}</div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: op.costColor, fontWeight: 500 }}>{op.cost}</span>
                  <button
                    onClick={() => runOp(op.id)}
                    disabled={opStates[op.id] === "running"}
                    style={{
                      padding: "4px 12px", borderRadius: R.r1, fontSize: 13, cursor: "pointer",
                      fontFamily: "inherit", border: "none",
                      background: opStates[op.id] === "done" ? C.green : C.acc,
                      color: "#fff",
                      display: "flex", alignItems: "center", gap: 6,
                      transition: `background ${DUR.fast} ${EASE}`,
                    }}
                  >
                    {opStates[op.id] === "running" && (
                      <span style={{ width: 10, height: 10, borderRadius: R.pill, border: "1.5px solid rgba(255,255,255,.3)", borderTopColor: "#fff", display: "block", animation: "streams-spin 600ms linear infinite" }} />
                    )}
                    {opStates[op.id] === "done" ? "✓ Done" : opStates[op.id] === "running" ? "Running…" : "Run"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Op result previews */}
      {Object.entries(opResults).length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {Object.entries(opResults).map(([opId, url]) => (
            <div key={opId} style={{ borderRadius:R.r2, overflow:"hidden", border:`1px solid ${C.bdr}` }}>
              <MediaPlayer src={url as string} kind="video" aspectRatio="16/9" showDownload label={opId}/>
            </div>
          ))}
        </div>
      )}

      {/* Backend note */}
        <div style={{
          padding: "12px 16px", borderRadius: R.r2,
          border: `1px solid ${C.bdr}`, background: C.bg3,
          fontSize: 13, color: C.t4, lineHeight: 1.6,
        }}>
          Backend routes required: <span style={{ color: C.t3 }}>/api/streams/video/ingest · /api/streams/video/edit-voice · /api/streams/video/edit-body · /api/streams/video/edit-motion · /api/streams/video/dub · /api/streams/video/emotion</span>
        </div>
      </div>

      <style>{`
        @keyframes streams-spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .streams-ops-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
