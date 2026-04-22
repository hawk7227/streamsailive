"use client";

/**
 * VideoEditorTab — Image 1 spec.
 * Sub-tabs: Motion · Transcript · Audio · Export
 * All 4 sub-tabs switch content. No sub-tab content was wired before — fixed.
 *
 * No backend. Backend required:
 *   /api/streams/video/ingest · /api/streams/video/edit-voice
 *   /api/streams/video/edit-motion · /api/streams/video/dub
 */

import { useState } from "react";
import { C, R, DUR, EASE } from "../tokens";

type SubTab = "Motion" | "Transcript" | "Audio" | "Export";

const SHOTS = [
  { id: "s1", num: "01", time: "0–3s",  prompt: "Woman walks along city street, golden hour, slow push-in camera" },
  { id: "s2", num: "02", time: "3–7s",  prompt: "Close on her face, wind in hair, soft bokeh background"         },
  { id: "s3", num: "03", time: "7–10s", prompt: "Wide shot, crowds blur past, she crosses intersection"          },
];

const TRANSCRIPT = [
  { speaker: "Speaker A", time: "0.0s", words: ["The","city","never","sleeps","—","and","neither","does","she."]         },
  { speaker: "Speaker A", time: "3.2s", words: ["Every","step","purposeful,","every","glance","forward."]                },
  { speaker: "Speaker A", time: "6.8s", words: ["This","is","her","city.","Her","moment.","Her","story."]                },
];

const EXPORT_FORMATS = [
  { label: "Final video",          ext: ".mp4",  note: "Merged · all edits applied" },
  { label: "Transcript",           ext: ".json", note: "Word-level timestamps"       },
  { label: "Subtitles",            ext: ".srt",  note: "SubRip format"               },
  { label: "Subtitles",            ext: ".vtt",  note: "WebVTT format"               },
  { label: "Audio tracks",         ext: ".zip",  note: "Voice + ambient separate"    },
  { label: "Voice only",           ext: ".mp3",  note: "Clean isolated speech"       },
  { label: "Motion beats",         ext: ".json", note: "Shot prompts + timecodes"    },
  { label: "Frame screenshot",     ext: ".png",  note: "Current frame"               },
  { label: "Full project",         ext: ".zip",  note: "All assets"                  },
];

export default function VideoEditorTab() {
  const [subTab,       setSubTab]       = useState<SubTab>("Motion");
  const [activeShot,   setActiveShot]   = useState("s1");
  const [shotPrompts,  setShotPrompts]  = useState(Object.fromEntries(SHOTS.map(s => [s.id, s.prompt])));
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [editText,     setEditText]     = useState("");
  const [playing,      setPlaying]      = useState(false);
  const [revoiceState, setRevoiceState] = useState<"idle"|"running"|"done">("idle");
  const [dubLang,      setDubLang]      = useState("Spanish");
  const [dubState,     setDubState]     = useState<"idle"|"running"|"done">("idle");
  const [downloading,  setDownloading]  = useState<string|null>(null);

  function selectWord(w: string) {
    setSelectedWord(w);
    setEditText(w);
  }

  function handleReVoice() {
    if (!editText.trim() || revoiceState === "running") return;
    setRevoiceState("running");
    setTimeout(() => setRevoiceState("done"), 2000);
  }

  function handleDub() {
    if (dubState === "running") return;
    setDubState("running");
    setTimeout(() => setDubState("done"), 3000);
  }

  function handleDownload(label: string) {
    setDownloading(label);
    setTimeout(() => setDownloading(null), 1800);
  }

  const activeShotData = SHOTS.find(s => s.id === activeShot)!;

  /* ── Shared left panel (always visible) ─────────────────────── */
  const LeftPanel = (
    <div style={{
      width: 220, flexShrink: 0,
      borderRight: `1px solid ${C.bdr}`,
      background: C.bg2,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }} className="streams-editor-left">

      <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.bdr}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: C.t4, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>Editable Layers</span>
        <span style={{ fontSize: 12, padding: "1px 7px", borderRadius: R.pill, background: C.accDim, border: `1px solid ${C.accBr}`, color: C.acc2 }}>3 shots</span>
      </div>

      <div style={{ padding: "8px 12px 4px", borderBottom: `1px solid ${C.bdr}`, flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase" }}>Motion beats</span>
        <span style={{ fontSize: 13, color: C.acc2, cursor: "pointer" }}>+ add shot</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {SHOTS.map(shot => (
          <div key={shot.id} onClick={() => setActiveShot(shot.id)} style={{
            padding: "8px 10px", borderRadius: R.r1, marginBottom: 4, cursor: "pointer",
            border: `1px solid ${activeShot === shot.id ? C.acc : "transparent"}`,
            background: activeShot === shot.id ? C.accDim : "transparent",
          }}>
            <div style={{ width: "100%", aspectRatio: "16/9", background: C.bg4, borderRadius: 4, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.bdr}` }}>
              <span style={{ fontSize: 13, color: C.t4, opacity: .4 }}>▶</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: C.acc2, fontWeight: 600 }}>{shot.num}</span>
              <span style={{ fontSize: 12, color: C.t4 }}>{shot.time}</span>
            </div>
            <textarea
              value={shotPrompts[shot.id]}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setShotPrompts((p: Record<string,string>) => ({ ...p, [shot.id]: e.target.value }))}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              rows={2}
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: C.t2, fontSize: 14, fontFamily: "inherit", resize: "none", lineHeight: 1.4 }}
            />
          </div>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${C.bdr}`, flexShrink: 0, padding: "8px 12px 4px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase" }}>Audio transcript</span>
        <span style={{ fontSize: 12, color: C.t4 }}>Scribe v2</span>
      </div>
      <div style={{ flex: "0 0 140px", overflowY: "auto", padding: "4px 12px 8px" }}>
        {TRANSCRIPT.map((line, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: C.acc2, fontWeight: 600, marginBottom: 4 }}>{line.speaker} · {line.time}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {line.words.map((w, j) => (
                <span key={j} onClick={() => selectWord(w)} style={{
                  padding: "2px 6px", borderRadius: R.r1, fontSize: 14,
                  background: selectedWord === w ? C.accDim : C.surf,
                  border: `1px solid ${selectedWord === w ? C.acc : C.bdr}`,
                  color: selectedWord === w ? C.t1 : C.t2,
                  cursor: "pointer", transition: `all ${DUR.fast} ${EASE}`,
                }}>{w}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ── Motion sub-tab ────────────────────────────────────────── */
  const MotionView = (
    <>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {LeftPanel}
        {/* Video preview */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#000" }}>
          <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.bdr}`, background: C.bg2, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: R.r1, background: C.accDim, border: `1px solid ${C.accBr}`, color: C.acc2, fontWeight: 600, letterSpacing: ".06em" }}>
              SHOT {SHOTS.findIndex(s => s.id === activeShot) + 1} · {activeShotData.time}
            </span>
            <span style={{ fontSize: 12, color: C.t4, marginLeft: "auto" }}>1920 × 1080</span>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ aspectRatio: "16/9", maxWidth: "100%", maxHeight: "100%", background: C.bg3, borderRadius: R.r1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: `1px solid ${C.bdr}`, position: "relative", width: "100%" }}>
              <div style={{ fontSize: 32, color: C.t4, opacity: .3, marginBottom: 12 }}>▶</div>
              <div style={{ fontSize: 14, color: C.t4 }}>Video preview · 1920×1080</div>
              <div style={{ fontSize: 13, color: C.t3, marginTop: 6, padding: "4px 12px", border: `1px solid ${C.bdr}`, borderRadius: R.r1 }}>Backend route needed · /api/streams/video/ingest</div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ height: 180, flexShrink: 0, borderTop: `1px solid ${C.bdr}`, background: C.bg2, display: "flex", flexDirection: "column" }}>
        <div style={{ height: 36, flexShrink: 0, borderBottom: `1px solid ${C.bdr}`, padding: "0 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setPlaying((p: boolean) => !p)} style={{ width: 28, height: 28, borderRadius: R.r1, background: playing ? C.acc : C.surf, border: `1px solid ${playing ? C.acc : C.bdr}`, color: playing ? "#fff" : C.t2, fontSize: 14, cursor: "pointer" }}>
            {playing ? "⏸" : "▶"}
          </button>
          <span style={{ fontSize: 13, color: C.t4 }}>0:00 / 0:10</span>
        </div>

        {/* Word chip edit bar */}
        <div style={{ padding: "6px 16px", borderBottom: `1px solid ${C.bdr}`, background: "rgba(124,58,237,0.06)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, overflowX: "auto" }}>
          <span style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", flexShrink: 0 }}>Edit audio</span>
          <div style={{ display: "flex", flexWrap: "nowrap", gap: 4, flex: 1, overflowX: "auto" }}>
            {(selectedWord ? TRANSCRIPT.flatMap(l => l.words).slice(0, 7) : TRANSCRIPT[1].words).map((w, i) => (
              <span key={i} onClick={() => selectWord(w)} style={{ padding: "2px 7px", borderRadius: R.r1, fontSize: 14, background: selectedWord === w ? C.accDim : C.surf, border: `1px solid ${selectedWord === w ? C.acc : C.bdr}`, color: selectedWord === w ? C.t1 : C.t2, cursor: "pointer", whiteSpace: "nowrap" }}>{w}</span>
            ))}
          </div>
          <select style={{ background: C.bg3, border: `1px solid ${C.bdr}`, color: C.t2, fontSize: 14, borderRadius: R.r1, padding: "3px 8px", fontFamily: "inherit", flexShrink: 0 }}>
            <option>Aria · ElevenLabs</option><option>Rachel</option><option>Adam</option>
          </select>
          <input value={editText} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditText(e.target.value)} placeholder="Edit selected word…" style={{ background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1, color: C.t1, fontSize: 14, padding: "4px 10px", fontFamily: "inherit", outline: "none", width: 140, flexShrink: 0 }} />
          <button onClick={handleReVoice} style={{ padding: "5px 14px", borderRadius: R.r1, background: revoiceState === "done" ? C.green : revoiceState === "running" ? C.bg4 : C.acc, border: "none", color: "#fff", fontSize: 14, fontFamily: "inherit", cursor: revoiceState === "running" ? "not-allowed" : "pointer", flexShrink: 0, transition: `background ${DUR.fast} ${EASE}`, display: "flex", alignItems: "center", gap: 5 }}>
            {revoiceState === "running" && <span style={{ width: 10, height: 10, borderRadius: R.pill, border: "1.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff", display: "block", animation: "streams-editor-spin 600ms linear infinite" }} />}
            {revoiceState === "done" ? "✓ Done" : revoiceState === "running" ? "Processing…" : "Re-voice"}
          </button>
        </div>

        {/* 3 tracks */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {[
            { label: "Video",   color: "rgba(124,58,237,0.5)", segments: [{ l:"1%", w:"29%", label:"shot 1" }, { l:"31%", w:"28%", label:"shot 2" }, { l:"60%", w:"38%", label:"shot 3" }] },
            { label: "Voice",   color: "rgba(16,185,129,0.5)",  segments: [{ l:"1%", w:"91%", label:"narration · extracted" }] },
            { label: "Ambient", color: "rgba(245,158,11,0.5)",  segments: [{ l:"1%", w:"91%", label:"city ambience · isolated" }] },
          ].map(track => (
            <div key={track.label} style={{ display: "flex", alignItems: "center", height: "33.33%", padding: "0 16px", gap: 10 }}>
              <div style={{ width: 56, fontSize: 12, color: C.t4, letterSpacing: ".06em", textTransform: "uppercase", flexShrink: 0 }}>{track.label}</div>
              <div style={{ flex: 1, height: 26, borderRadius: R.r1, background: C.bg4, border: `1px solid ${C.bdr}`, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, bottom: 0, left: "22%", width: 2, background: "rgba(255,255,255,0.7)", zIndex: 10 }} />
                {track.segments.map((seg, i) => (
                  <div key={i} style={{ position: "absolute", top: 3, height: "calc(100% - 6px)", left: seg.l, width: seg.w, borderRadius: 4, background: track.color, display: "flex", alignItems: "center", padding: "0 6px", fontSize: 12, color: "rgba(255,255,255,.7)", whiteSpace: "nowrap", overflow: "hidden", cursor: "pointer" }}>{seg.label}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  /* ── Transcript sub-tab ────────────────────────────────────── */
  const TranscriptView = (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {LeftPanel}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: C.t1 }}>Full transcript</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => handleDownload("srt")} style={{ padding: "6px 14px", borderRadius: R.r1, background: downloading === "srt" ? C.green : C.surf, border: `1px solid ${downloading === "srt" ? C.green : C.bdr}`, color: downloading === "srt" ? "#fff" : C.t3, fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>{downloading === "srt" ? "✓" : "Export .srt"}</button>
              <button onClick={() => handleDownload("vtt")} style={{ padding: "6px 14px", borderRadius: R.r1, background: downloading === "vtt" ? C.green : C.surf, border: `1px solid ${downloading === "vtt" ? C.green : C.bdr}`, color: downloading === "vtt" ? "#fff" : C.t3, fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>{downloading === "vtt" ? "✓" : "Export .vtt"}</button>
            </div>
          </div>

          {/* Source info */}
          <div style={{ padding: "10px 14px", borderRadius: R.r2, background: C.bg3, border: `1px solid ${C.bdr}`, marginBottom: 20, fontSize: 13, color: C.t4, lineHeight: 1.6 }}>
            Source: ElevenLabs Scribe v2 · word-level timestamps · Speaker diarization · 0:00–0:10
          </div>

          {TRANSCRIPT.map((line, i) => (
            <div key={i} style={{ marginBottom: 28, padding: "16px 18px", borderRadius: R.r2, background: C.bg2, border: `1px solid ${C.bdr}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: C.acc2, fontWeight: 600, letterSpacing: ".04em" }}>{line.speaker} · {line.time}</span>
                <span style={{ fontSize: 12, color: C.t4 }}>{line.words.length} words</span>
              </div>
              {/* Editable word chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {line.words.map((w, j) => (
                  <span key={j} onClick={() => selectWord(w)} style={{
                    padding: "4px 10px", borderRadius: R.r1, fontSize: 15,
                    background: selectedWord === w ? C.accDim : C.surf,
                    border: `1px solid ${selectedWord === w ? C.acc : C.bdr}`,
                    color: selectedWord === w ? C.t1 : C.t2,
                    cursor: "pointer", transition: `all ${DUR.fast} ${EASE}`,
                  }}>{w}</span>
                ))}
              </div>
              {/* Edit bar — appears when word selected */}
              {selectedWord && line.words.includes(selectedWord) && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", borderRadius: R.r1, background: C.bg4, border: `1px solid ${C.accBr}` }}>
                  <span style={{ fontSize: 13, color: C.t3, flexShrink: 0 }}>Replace:</span>
                  <input value={editText} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditText(e.target.value)}
                    style={{ flex: 1, background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1, padding: "6px 10px", color: C.t1, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
                  <button onClick={handleReVoice} style={{
                    padding: "6px 16px", borderRadius: R.r1, border: "none", fontFamily: "inherit", fontSize: 13, cursor: "pointer",
                    background: revoiceState === "done" ? C.green : C.acc, color: "#fff",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    {revoiceState === "running" && <span style={{ width: 10, height: 10, borderRadius: R.pill, border: "1.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff", display: "block", animation: "streams-editor-spin 600ms linear infinite" }} />}
                    {revoiceState === "done" ? "✓ Done" : "Re-voice"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── Audio sub-tab ─────────────────────────────────────────── */
  const AudioView = (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {LeftPanel}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Voice track */}
          <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: R.r3, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.bdr}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.t1 }}>Voice track</div>
              <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: R.pill, background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.25)", color: C.green }}>extracted · clean</span>
            </div>
            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleReVoice} style={{ flex: 1, padding: "10px 0", borderRadius: R.r2, background: revoiceState === "done" ? C.green : C.acc, border: "none", color: "#fff", fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>{revoiceState === "done" ? "✓ Done" : "Re-voice entire track"}</button>
                <button onClick={() => handleDownload("voice")} style={{ flex: 1, padding: "10px 0", borderRadius: R.r2, background: downloading === "voice" ? C.green : C.surf, border: `1px solid ${C.bdr}`, color: downloading === "voice" ? "#fff" : C.t2, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>{downloading === "voice" ? "✓ Ready" : "Download voice.mp3"}</button>
              </div>
            </div>
          </div>

          {/* Ambient track */}
          <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: R.r3, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.bdr}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.t1 }}>Ambient track</div>
              <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: R.pill, background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.25)", color: C.amber }}>city ambience · isolated</span>
            </div>
            <div style={{ padding: "14px 18px", display: "flex", gap: 10 }}>
              <button style={{ flex: 1, padding: "10px 0", borderRadius: R.r2, background: C.surf, border: `1px solid ${C.bdr}`, color: C.t2, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>Swap ambient</button>
              <button onClick={() => handleDownload("ambient")} style={{ flex: 1, padding: "10px 0", borderRadius: R.r2, background: downloading === "ambient" ? C.green : C.surf, border: `1px solid ${C.bdr}`, color: downloading === "ambient" ? "#fff" : C.t2, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>{downloading === "ambient" ? "✓ Ready" : "Download ambient.mp3"}</button>
            </div>
          </div>

          {/* Add sound design */}
          <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: R.r3, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.bdr}` }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.t1 }}>Add sound design</div>
              <div style={{ fontSize: 13, color: C.t4, marginTop: 3 }}>Generates audio synchronized to video frames — $0.001/sec</div>
            </div>
            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <input placeholder="Describe the sound… cinematic swoosh, urban ambient, logo reveal pulse" style={{ background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1, padding: "10px 12px", color: C.t1, fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%" }} />
              <button onClick={() => handleDownload("sound")} style={{ padding: "10px 0", borderRadius: R.r2, background: downloading === "sound" ? C.green : C.acc, border: "none", color: "#fff", fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>{downloading === "sound" ? "✓ Processing…" : "Add sound — fal MMAudio v2"}</button>
            </div>
          </div>

          {/* Language dubbing */}
          <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: R.r3, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.bdr}` }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.t1 }}>Language dubbing</div>
              <div style={{ fontSize: 13, color: C.t4, marginTop: 3 }}>Translation + voice synthesis + lipsync in one call — $0.90/min</div>
            </div>
            <div style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center" }}>
              <select value={dubLang} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDubLang(e.target.value)}
                style={{ flex: 1, background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1, padding: "9px 12px", color: C.t1, fontSize: 14, fontFamily: "inherit", outline: "none" }}>
                {["Spanish","French","German","Japanese","Portuguese","Italian","Hindi","Korean","Arabic"].map(l => <option key={l}>{l}</option>)}
              </select>
              <button onClick={handleDub} style={{
                padding: "10px 20px", borderRadius: R.r2, border: "none", fontFamily: "inherit", fontSize: 14, cursor: "pointer",
                background: dubState === "done" ? C.green : dubState === "running" ? C.bg4 : C.acc, color: "#fff",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                {dubState === "running" && <span style={{ width: 12, height: 12, borderRadius: R.pill, border: "1.5px solid rgba(255,255,255,.3)", borderTopColor: "#fff", display: "block", animation: "streams-editor-spin 600ms linear infinite" }} />}
                {dubState === "done" ? "✓ Done" : dubState === "running" ? "Dubbing…" : `Dub to ${dubLang}`}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );

  /* ── Export sub-tab ────────────────────────────────────────── */
  const ExportView = (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: C.t1, marginBottom: 6 }}>Export</div>
        <div style={{ fontSize: 13, color: C.t3, marginBottom: 24 }}>Download any combination of assets from this video project.</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {EXPORT_FORMATS.map(fmt => (
            <div key={`${fmt.label}-${fmt.ext}`} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px", borderRadius: R.r2,
              background: C.bg2, border: `1px solid ${C.bdr}`,
            }}>
              <div>
                <div style={{ fontSize: 15, color: C.t1, fontWeight: 500 }}>{fmt.label} <span style={{ fontSize: 13, color: C.acc2, fontWeight: 400 }}>{fmt.ext}</span></div>
                <div style={{ fontSize: 13, color: C.t4, marginTop: 3 }}>{fmt.note}</div>
              </div>
              <button
                onClick={() => handleDownload(fmt.label + fmt.ext)}
                style={{
                  padding: "8px 18px", borderRadius: R.r1, fontFamily: "inherit", fontSize: 13,
                  background: downloading === fmt.label + fmt.ext ? C.green : C.surf,
                  border: `1px solid ${downloading === fmt.label + fmt.ext ? C.green : C.bdr}`,
                  color: downloading === fmt.label + fmt.ext ? "#fff" : C.t2,
                  cursor: "pointer", transition: `all ${DUR.fast} ${EASE}`,
                }}
              >
                {downloading === fmt.label + fmt.ext ? "✓ Ready" : "↓ Download"}
              </button>
            </div>
          ))}
        </div>

        {/* Download all */}
        <button onClick={() => handleDownload("all")} style={{
          width: "100%", marginTop: 16, padding: "14px 0", borderRadius: R.r2, border: "none",
          background: downloading === "all" ? C.green : C.acc, color: "#fff",
          fontSize: 15, fontFamily: "inherit", fontWeight: 500, cursor: "pointer",
          transition: `background ${DUR.fast} ${EASE}`,
        }}>
          {downloading === "all" ? "✓ Preparing zip…" : "↓ Download full project .zip"}
        </button>
      </div>
    </div>
  );

  /* ── Root ──────────────────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Sub-tab bar */}
      <div style={{ display: "flex", height: 46, flexShrink: 0, borderBottom: `1px solid ${C.bdr}`, background: C.bg2, padding: "0 16px", gap: 0, overflowX: "auto" }}>
        {(["Motion","Transcript","Audio","Export"] as SubTab[]).map(t => (
          <button key={t} onClick={() => setSubTab(t)} style={{
            height: 46, padding: "0 18px", border: "none",
            borderBottom: subTab === t ? `2px solid ${C.acc}` : "2px solid transparent",
            background: subTab === t ? "rgba(124,58,237,0.06)" : "transparent",
            color: subTab === t ? C.t1 : C.t3,
            fontSize: 14, fontFamily: "inherit", cursor: "pointer",
            letterSpacing: ".02em", flexShrink: 0,
            transition: `all ${DUR.fast} ${EASE}`,
          }}>{t}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => {}} style={{ padding: "6px 14px", borderRadius: R.r1, background: C.surf, border: `1px solid ${C.bdr}`, color: C.t3, fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>↑ Upload</button>
          <button style={{ padding: "6px 14px", borderRadius: R.r1, background: C.acc, border: "none", color: "#fff", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }} onClick={() => setSubTab("Export")}>Export video</button>
        </div>
      </div>

      {/* Tab content */}
      {subTab === "Motion"     && MotionView}
      {subTab === "Transcript" && TranscriptView}
      {subTab === "Audio"      && AudioView}
      {subTab === "Export"     && ExportView}

      <style>{`
        @keyframes streams-editor-spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .streams-editor-left { display: none !important; }
        }
      `}</style>
    </div>
  );
}
