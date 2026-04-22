"use client";

/**
 * PersonTab — Person editing pipeline.
 * Ingest pipeline status + 6 edit operations.
 * Mobile-first: cards stack vertically.
 * No backend — shell only.
 */

import { useState } from "react";
import { C, R, DUR, EASE } from "../tokens";

type EditOp = "voice" | "body" | "motion" | "dub" | "emotion" | "multishot";
type OpState = "idle" | "running" | "done";

const INGEST_STEPS = [
  { label: "fal ffmpeg-api · extract audio",                        done: true  },
  { label: "elevenlabs/audio-isolation → voice.mp3 + ambient.mp3", done: true  },
  { label: "ffmpeg-api · frame extraction · 1 per 2s",             done: true  },
  { label: "GPT-4o Vision · frame-by-frame person analysis",        done: true  },
  { label: "GPT-4o Vision · appearance_description (best frame)",   done: true  },
  { label: "elevenlabs/speech-to-text (Scribe v2) · word timestamps", done: true },
  { label: "ElevenLabs IVC → voice_id stored",                      done: true  },
  { label: "Write person_analysis row · all fields populated",       done: true  },
];

const EDIT_OPS: {
  id: EditOp; title: string; sub: string;
  endpoints: string[]; cost: string; costColor: string;
}[] = [
  {
    id: "voice", title: "Voice / word edit",
    sub: "User changes transcript text → TTS → duration check → trim segment → Sync Lipsync v2 redraws mouth region → ffmpeg compose back at timestamp.",
    endpoints: ["fal-ai/elevenlabs/tts/eleven-v3","fal-ai/sync-lipsync/v2","fal-ai/ffmpeg-api/compose"],
    cost: "~$0.18 · 3.6s segment", costColor: C.green,
  },
  {
    id: "body", title: "Full body reaction",
    sub: "Stored face frame + new audio → OmniHuman v1.5 drives entire upper body. Audio rhythm controls posture, gestures, expressions. Single-person only.",
    endpoints: ["fal-ai/bytedance/omnihuman/v1.5","fal-ai/ffmpeg-api/merge-audio-video"],
    cost: "$0.16/sec · from stored frame", costColor: C.amber,
  },
  {
    id: "motion", title: "Motion style change",
    sub: "User uploads motion reference video. appearance_description auto-fills character prompt (NOT image_url — motion-control takes text only). Motion control transfers the movement style.",
    endpoints: ["fal-ai/kling-video/v3/standard/motion-control","fal-ai/ffmpeg-api/compose"],
    cost: "~$0.56 · 5s shot only", costColor: C.acc2,
  },
  {
    id: "dub", title: "Language dub",
    sub: "One-click re-voice entire video in any language. ElevenLabs dubbing handles translation + voice synthesis + lipsync in one call. Writes new video_versions row.",
    endpoints: ["fal-ai/elevenlabs/dubbing"],
    cost: "$0.90/min · full video", costColor: C.amber,
  },
  {
    id: "emotion", title: "Expression / emotion",
    sub: "Change emotional delivery of existing footage. React-1 controls: emotion param, head mode, temperature. Zero retraining. Modifies existing video — no regeneration.",
    endpoints: ["fal-ai/sync-lipsync/react-1"],
    cost: "low cost · modifies existing", costColor: C.green,
  },
  {
    id: "multishot", title: "Multi-shot motion",
    sub: "Multi-prompt — N shots in one call. No stitch needed. Each prompt maps to an editable motion beat immediately.",
    endpoints: ["fal-ai/kling-video/v3/standard/text-to-video","multi_prompt: [{prompt, duration}]"],
    cost: "one call · no stitching", costColor: C.acc2,
  },
];

export default function PersonTab() {
  const [opStates, setOpStates] = useState<Record<EditOp, OpState>>(
    Object.fromEntries(EDIT_OPS.map(op => [op.id, "idle"])) as Record<EditOp, OpState>
  );

  function runOp(id: EditOp) {
    setOpStates((s: Record<EditOp, OpState>) => ({ ...s, [id]: "running" }));
    setTimeout(() => setOpStates((s: Record<EditOp, OpState>) => ({ ...s, [id]: "done" })), 2200);
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "20px" }} className="streams-person-scroll">
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Video selector */}
        <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: R.r3, padding: 16 }}>
          <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Select video to edit</div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, border: `1px dashed ${C.bdr2}`, borderRadius: R.r2, padding: "20px 14px", textAlign: "center", cursor: "pointer", background: C.bg3 }}>
              <div style={{ fontSize: 20, color: C.t4, marginBottom: 6, opacity: .4 }}>↑</div>
              <div style={{ fontSize: 15, color: C.t2, fontWeight: 500 }}>Upload video</div>
              <div style={{ fontSize: 13, color: C.t4, marginTop: 4 }}>mp4 · mov · triggers 8-step ingest automatically</div>
            </div>
            <div style={{ flex: 1, background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r2, padding: 12 }}>
              <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>From Library</div>
              {["Video lady walking city","Generate brand assets"].map(t => (
                <div key={t} style={{ padding: "6px 8px", borderRadius: R.r1, cursor: "pointer", fontSize: 14, color: C.t3, marginBottom: 4, background: C.bg4, border: `1px solid ${C.bdr}` }}>{t}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 1 — Ingest pipeline */}
        <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: R.r3, overflow: "hidden" }}>
          <div style={{
            padding: "14px 18px", borderBottom: `1px solid ${C.bdr}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: C.t1 }}>
              Ingest pipeline — runs once on video creation
            </div>
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: R.pill, background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.25)", color: C.green }}>
              auto-runs on every video
            </span>
          </div>
          <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
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
            margin: "0 18px 16px", padding: "12px 14px",
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
            padding: "14px 18px", borderBottom: `1px solid ${C.bdr}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: C.t1 }}>
              Edit operations — each is a single fal API call
            </div>
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: R.pill, background: C.accDim, border: `1px solid ${C.accBr}`, color: C.acc2 }}>
              FAL_KEY only
            </span>
          </div>

          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }} className="streams-ops-grid">
            {EDIT_OPS.map(op => (
              <div key={op.id} style={{
                background: opStates[op.id] === "done" ? C.accDim : C.bg3,
                border: `1px solid ${opStates[op.id] === "done" ? C.accBr : C.bdr}`,
                borderRadius: R.r2, padding: "14px",
                transition: `all ${DUR.base} ${EASE}`,
              }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: C.t1, marginBottom: 6 }}>{op.title}</div>
                <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.55, marginBottom: 10 }}>{op.sub}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                  {op.endpoints.map(ep => (
                    <div key={ep} style={{
                      fontSize: 12, padding: "3px 8px", borderRadius: R.r1,
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
                      padding: "5px 12px", borderRadius: R.r1, fontSize: 13, cursor: "pointer",
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
