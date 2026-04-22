"use client";

/**
 * VideoEditorTab — locked to Image 1 spec.
 *
 * Layout:
 *   Desktop: [Shot panel | Preview 1920×1080 | Transcript panel]
 *            [────────────── Timeline 3 tracks ──────────────────]
 *            [────────────── Word chip edit bar ─────────────────]
 *   Mobile:  stacked, shot panel collapses
 *
 * All data is shell/mock — no backend.
 * Backend required: /api/streams/video/ingest, /api/streams/video/edit-voice
 */

import { useState } from "react";
import { C, R, DUR, EASE } from "../tokens";

const SHOTS = [
  { id: "s1", num: "01", time: "0–3s",   prompt: "Woman walks along city street, golden hour, slow push-in camera" },
  { id: "s2", num: "02", time: "3–7s",   prompt: "Close on her face, wind in hair, soft bokeh background" },
  { id: "s3", num: "03", time: "7–10s",  prompt: "Wide shot, crowds blur past, she crosses intersection" },
];

const TRANSCRIPT = [
  { speaker: "Speaker A", time: "0.0s", words: ["The","city","never","sleeps","—","and","neither","does","she."] },
  { speaker: "Speaker A", time: "3.2s", words: ["Every","step","purposeful,","every","glance","forward."] },
  { speaker: "Speaker A", time: "6.8s", words: ["This","is","her","city.","Her","moment.","Her","story."] },
];

export default function VideoEditorTab() {
  const [activeShot,    setActiveShot]    = useState("s1");
  const [shotPrompts,   setShotPrompts]   = useState(Object.fromEntries(SHOTS.map(s => [s.id, s.prompt])));
  const [selectedWord,  setSelectedWord]  = useState<string | null>(null);
  const [editText,      setEditText]      = useState("");
  const [playing,       setPlaying]       = useState(false);
  const [playhead,      setPlayhead]      = useState(0);

  function selectWord(w: string) {
    setSelectedWord(w);
    setEditText(w);
  }

  function handleReVoice() {
    if (!editText.trim()) return;
    alert(`Re-voice: "${editText}" → fal-ai/elevenlabs/tts/eleven-v3 → Sync Lipsync v2 → ffmpeg compose`);
  }

  const activeShotData = SHOTS.find(s => s.id === activeShot)!;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Sub-tabs */}
      <div style={{
        display: "flex", height: 40, flexShrink: 0,
        borderBottom: `1px solid ${C.bdr}`,
        background: C.bg2, padding: "0 16px", gap: 0,
        overflowX: "auto",
      }}>
        {["Motion","Transcript","Audio","Export"].map(t => (
          <button key={t} style={{
            height: 40, padding: "0 14px", border: "none",
            borderBottom: t === "Motion" ? `2px solid ${C.acc}` : "2px solid transparent",
            background: "transparent", color: t === "Motion" ? C.t1 : C.t3,
            fontSize: 11, fontFamily: "inherit", cursor: "pointer",
            letterSpacing: ".02em", flexShrink: 0,
          }}>{t}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button style={{ padding: "5px 12px", borderRadius: R.r1, background: C.surf, border: `1px solid ${C.bdr}`, color: C.t3, fontSize: 10, fontFamily: "inherit", cursor: "pointer" }}>↑ Upload</button>
          <button style={{ padding: "5px 12px", borderRadius: R.r1, background: C.acc, border: "none", color: "#fff", fontSize: 10, fontFamily: "inherit", cursor: "pointer" }}>Export video</button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left — Shot panel */}
        <div style={{
          width: 220, flexShrink: 0,
          borderRight: `1px solid ${C.bdr}`,
          background: C.bg2,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }} className="streams-editor-left">

          {/* Motion beats */}
          <div style={{ padding: "10px 12px 6px", borderBottom: `1px solid ${C.bdr}`, flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase" }}>Motion beats</span>
            <span style={{ fontSize: 10, color: C.acc2, cursor: "pointer" }}>+ add shot</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            {SHOTS.map(shot => (
              <div
                key={shot.id}
                onClick={() => setActiveShot(shot.id)}
                style={{
                  padding: "8px 10px", borderRadius: R.r1, marginBottom: 4, cursor: "pointer",
                  border: `1px solid ${activeShot === shot.id ? C.acc : "transparent"}`,
                  background: activeShot === shot.id ? C.accDim : "transparent",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: C.acc2, fontWeight: 600 }}>{shot.num}</span>
                  <span style={{ fontSize: 9, color: C.t4 }}>{shot.time}</span>
                </div>
                <textarea
                  value={shotPrompts[shot.id]}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setShotPrompts((p: Record<string, string>) => ({ ...p, [shot.id]: e.target.value }))}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  rows={2}
                  style={{
                    width: "100%", background: "transparent", border: "none",
                    outline: "none", color: C.t2, fontSize: 11,
                    fontFamily: "inherit", resize: "none", lineHeight: 1.4,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Transcript */}
          <div style={{ borderTop: `1px solid ${C.bdr}`, flexShrink: 0, padding: "8px 12px 4px", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase" }}>Audio transcript</span>
            <span style={{ fontSize: 9, color: C.t4, fontFamily: "inherit" }}>Scribe v2</span>
          </div>
          <div style={{ flex: "0 0 140px", overflowY: "auto", padding: "4px 12px 8px" }}>
            {TRANSCRIPT.map((line, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: C.acc2, fontWeight: 600, marginBottom: 4, letterSpacing: ".04em" }}>
                  {line.speaker} · {line.time}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {line.words.map((w, j) => (
                    <span
                      key={j}
                      onClick={() => selectWord(w)}
                      style={{
                        padding: "2px 6px", borderRadius: R.r1, fontSize: 11,
                        background: selectedWord === w ? C.accDim : C.surf,
                        border: `1px solid ${selectedWord === w ? C.acc : C.bdr}`,
                        color: selectedWord === w ? C.t1 : C.t2,
                        cursor: "pointer",
                        transition: `all ${DUR.fast} ${EASE}`,
                      }}
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center — Video preview */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#000" }}>
          <div style={{
            padding: "8px 14px", borderBottom: `1px solid ${C.bdr}`,
            background: C.bg2, display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          }}>
            <span style={{
              fontSize: 9, padding: "3px 8px", borderRadius: R.r1,
              background: C.accDim, border: `1px solid ${C.accBr}`,
              color: C.acc2, fontWeight: 600, letterSpacing: ".06em",
            }}>
              SHOT {SHOTS.findIndex(s => s.id === activeShot) + 1} · {activeShotData.time}
            </span>
            <span style={{ fontSize: 9, color: C.t4, marginLeft: "auto" }}>1920 × 1080</span>
          </div>

          {/* 16:9 preview */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{
              aspectRatio: "16/9", maxWidth: "100%", maxHeight: "100%",
              background: C.bg3, borderRadius: R.r1,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              border: `1px solid ${C.bdr}`, position: "relative", width: "100%",
            }}>
              <div style={{ fontSize: 32, color: C.t4, opacity: .3, marginBottom: 12 }}>▶</div>
              <div style={{ fontSize: 11, color: C.t4 }}>Video preview · 1920×1080</div>
              <div style={{ fontSize: 10, color: C.t3, marginTop: 6, padding: "4px 12px", border: `1px solid ${C.bdr}`, borderRadius: R.r1 }}>
                Backend route needed · /api/streams/video/ingest
              </div>
              {/* Playhead */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: C.bg4, borderRadius: "0 0 8px 8px" }}>
                <div style={{ height: "100%", background: C.acc, width: `${playhead}%`, transition: "width 100ms linear", borderRadius: "0 0 8px 8px" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{
        height: 180, flexShrink: 0,
        borderTop: `1px solid ${C.bdr}`,
        background: C.bg2,
        display: "flex", flexDirection: "column",
      }}>
        {/* Controls */}
        <div style={{
          height: 36, flexShrink: 0, borderBottom: `1px solid ${C.bdr}`,
          padding: "0 16px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <button
            onClick={() => setPlaying((p: boolean) => !p)}
            style={{
              width: 28, height: 28, borderRadius: R.r1,
              background: playing ? C.acc : C.surf,
              border: `1px solid ${playing ? C.acc : C.bdr}`,
              color: playing ? "#fff" : C.t2,
              fontSize: 11, cursor: "pointer",
            }}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <span style={{ fontSize: 10, color: C.t4, fontFamily: "inherit" }}>0:00 / 0:10</span>
        </div>

        {/* Word chip edit bar */}
        <div style={{
          padding: "6px 16px", borderBottom: `1px solid ${C.bdr}`,
          background: "rgba(124,58,237,0.06)",
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <span style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", flexShrink: 0 }}>Edit audio</span>
          <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {(selectedWord
              ? TRANSCRIPT.flatMap(l => l.words).filter((_, i) => i < 6)
              : TRANSCRIPT[1].words
            ).map((w, i) => (
              <span
                key={i}
                onClick={() => selectWord(w)}
                style={{
                  padding: "2px 7px", borderRadius: R.r1, fontSize: 11,
                  background: selectedWord === w ? C.accDim : C.surf,
                  border: `1px solid ${selectedWord === w ? C.acc : C.bdr}`,
                  color: selectedWord === w ? C.t1 : C.t2,
                  cursor: "pointer",
                }}
              >
                {w}
              </span>
            ))}
          </div>
          {/* Voice selector — "Aria · ElevenLabs" in settings position only */}
          <select style={{
            background: C.bg3, border: `1px solid ${C.bdr}`,
            color: C.t2, fontSize: 11, borderRadius: R.r1,
            padding: "3px 8px", fontFamily: "inherit", flexShrink: 0,
          }}>
            <option>Aria · ElevenLabs</option>
            <option>Rachel</option>
            <option>Adam</option>
          </select>
          <button
            onClick={handleReVoice}
            style={{
              padding: "5px 12px", borderRadius: R.r1,
              background: C.acc, border: "none", color: "#fff",
              fontSize: 11, fontFamily: "inherit", cursor: "pointer", flexShrink: 0,
              transition: `background ${DUR.fast} ${EASE}`,
            }}
          >
            Re-voice
          </button>
          <input
            value={editText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditText(e.target.value)}
            placeholder="Edit selected word…"
            style={{
              background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1,
              color: C.t1, fontSize: 11, padding: "4px 10px",
              fontFamily: "inherit", outline: "none", width: 160, flexShrink: 0,
            }}
          />
        </div>

        {/* 3 tracks */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", gap: 0 }}>
          {[
            { label: "Video",   color: "rgba(124,58,237,0.5)",  segments: [{ l: "1%",  w: "29%", label: "shot 1" }, { l: "31%", w: "28%", label: "shot 2" }, { l: "60%", w: "38%", label: "shot 3" }] },
            { label: "Voice",   color: "rgba(16,185,129,0.5)",  segments: [{ l: "1%",  w: "91%", label: "narration · extracted" }] },
            { label: "Ambient", color: "rgba(245,158,11,0.5)",  segments: [{ l: "1%",  w: "91%", label: "city ambience · isolated" }] },
          ].map(track => (
            <div key={track.label} style={{
              display: "flex", alignItems: "center",
              height: "33.33%", padding: "0 16px", gap: 10,
            }}>
              <div style={{ width: 56, fontSize: 9, color: C.t4, letterSpacing: ".06em", textTransform: "uppercase", flexShrink: 0 }}>{track.label}</div>
              <div style={{
                flex: 1, height: 26, borderRadius: R.r1,
                background: C.bg4, border: `1px solid ${C.bdr}`,
                position: "relative", overflow: "hidden",
              }}>
                {track.segments.map((seg, i) => (
                  <div key={i} style={{
                    position: "absolute", top: 3, height: "calc(100% - 6px)",
                    left: seg.l, width: seg.w,
                    borderRadius: 4, background: track.color,
                    display: "flex", alignItems: "center",
                    padding: "0 6px", fontSize: 9, color: "rgba(255,255,255,.7)",
                    whiteSpace: "nowrap", overflow: "hidden",
                    cursor: "pointer",
                  }}>
                    {seg.label}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .streams-editor-left { display: none !important; }
        }
      `}</style>
    </div>
  );
}
