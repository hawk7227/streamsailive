"use client";

/**
 * GenerateTab — 6 modes, all fields per spec.
 * Mobile-first: form full-width, grid below, Generate button sticky bottom.
 * No backend calls in shell — state only.
 * Backend: /api/streams/video/generate + /api/streams/video/status
 */

import { useState, useRef, useEffect } from "react";
import { C, R, DUR, EASE } from "../tokens";

type Mode = "T2V" | "I2V" | "Motion" | "Image" | "Voice" | "Music";
type Duration = "3" | "4" | "5" | "8" | "10" | "15";
type AR = "16:9" | "9:16" | "1:1";
type MusicSub = "style-lyrics" | "auto-lyrics" | "instrumental" | "cover";
type GenState = "idle" | "submitting" | "queued" | "polling" | "done" | "failed";

const VIDEO_MODELS = ["Standard","Pro","Precision","Cinema","Native Audio"];
const IMAGE_MODELS = ["Kontext","Kontext Max","FLUX Pro","Design","Nano"];
const VOICE_MODELS = ["Voice v3","Turbo","Multilingual"];
const MUSIC_MODELS = ["Music","Music Draft","Music Ref","Commercial"];

const STRUCT_TAGS = ["[Intro]","[Verse]","[Pre Chorus]","[Chorus]","[Post Chorus]","[Bridge]","[Hook]","[Outro]","[Inst]","[Solo]"];
const STYLE_TPLS = [
  { label: "R&B",        val: "Soulful R&B, warm, cinematic, 85 BPM, B minor, smooth groove, emotive vocal" },
  { label: "Pop",        val: "Upbeat pop, 120 BPM, C major, synth, drums, catchy chorus hook" },
  { label: "Hip-hop",    val: "Trap hip-hop, 140 BPM, dark minor key, heavy 808 bass, hi-hats" },
  { label: "Ballad",     val: "Slow ballad, 65 BPM, piano, strings, intimate emotional delivery" },
  { label: "Electronic", val: "Electronic dance, 128 BPM, A minor, synth leads, four-on-floor kick" },
  { label: "Folk",       val: "Indie folk, melancholic, introspective, 80 BPM, acoustic guitar" },
];

// Cost estimates per mode/model
const COST: Record<string, string> = {
  "T2V-Standard":  "~$0.28 · 5s",
  "T2V-Pro":       "~$0.56 · 5s",
  "T2V-Precision": "~$0.56 · 5s",
  "T2V-Cinema":    "~$0.40 · 5s",
  "I2V-Standard":  "~$0.28 · 5s",
  "Image-Kontext":  "~$0.04 · 1 img",
  "Voice-Voice v3": "~$0.10 / 1K chars",
  "Music-Music":    "~$0.15 / gen",
};

interface GridItem { id: string; status: "waiting" | "running" | "done"; }

export default function GenerateTab() {
  const [mode,       setMode]       = useState<Mode>("T2V");
  const [model,      setModel]      = useState(0);
  const [prompt,     setPrompt]     = useState("");
  const [duration,   setDuration]   = useState<Duration>("5");
  const [ar,         setAr]         = useState<AR>("16:9");
  const [audio,      setAudio]      = useState(true);
  const [musicSub,   setMusicSub]   = useState<MusicSub>("style-lyrics");
  const [styleInput, setStyleInput] = useState("");
  const [lyricsInput,setLyricsInput]= useState("");
  const [styleAr,    setStyleAr]    = useState("1:1");
  const [genState,   setGenState]   = useState<GenState>("idle");
  const [grid,       setGrid]       = useState<GridItem[]>([]);
  const [stitch,     setStitch]     = useState<string[]>([]);
  const [micState,   setMicState]   = useState<"idle"|"recording"|"done">("idle");
  const [camState,   setCamState]   = useState<"idle"|"done">("idle");

  const lyricsRef = useRef<HTMLTextAreaElement>(null);

  const models = mode === "Image" ? IMAGE_MODELS
               : mode === "Voice" ? VOICE_MODELS
               : mode === "Music" ? MUSIC_MODELS
               : VIDEO_MODELS;

  const currentModel = models[Math.min(model, models.length - 1)];
  const costKey = `${mode}-${currentModel}`;
  const cost = COST[costKey] ?? "—";
  const isActive = genState === "submitting" || genState === "queued" || genState === "polling";

  function insertTag(tag: string) {
    const ta = lyricsRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const val = ta.value;
    const next = val.slice(0, pos) + "\n" + tag + "\n" + val.slice(pos);
    setLyricsInput(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(pos + tag.length + 2, pos + tag.length + 2); }, 0);
  }

  function handleGenerate() {
    if (isActive) return;
    setGenState("submitting");
    const newGrid: GridItem[] = Array.from({ length: 1 }, (_, i) => ({ id: String(i), status: "waiting" }));
    setGrid(newGrid);

    setTimeout(() => {
      setGenState("queued");
      setGrid((g: GridItem[]) => g.map((it: GridItem, i: number) => i === 0 ? { ...it, status: "running" } : it));
    }, 600);
    setTimeout(() => {
      setGenState("polling");
    }, 1800);
    setTimeout(() => {
      setGenState("done");
      setGrid((g: GridItem[]) => g.map((it: GridItem) => ({ ...it, status: "done" })));
    }, 3400);
  }

  function handleMic() {
    if (micState !== "idle") return;
    setMicState("recording");
    setTimeout(() => setMicState("done"), 2400);
  }

  function handleCam() {
    if (camState !== "idle") return;
    setCamState("done");
  }

  function addToStitch(id: string) {
    setStitch((s: string[]) => s.includes(id) ? s.filter((x: string) => x !== id) : [...s, id]);
  }

  const btnLabel = genState === "submitting" ? "Sending…"
    : genState === "queued"   ? "Queued…"
    : genState === "polling"  ? "Generating…"
    : genState === "done"     ? "✓ Complete — Generate again"
    : "Generate";

  // Left panel fields
  const Fields = (
    <div style={{ flex: "0 0 260px", borderRight: `1px solid ${C.bdr}`, background: C.bg2, display: "flex", flexDirection: "column", overflow: "hidden" }} className="streams-gen-left">

      {/* Mode bar */}
      <div style={{ display: "flex", overflowX: "auto", borderBottom: `1px solid ${C.bdr}`, flexShrink: 0, background: C.bg }}>
        {(["T2V","I2V","Motion","Image","Voice","Music"] as Mode[]).map(m => (
          <button key={m} onClick={() => { setMode(m); setModel(0); }} style={{
            height: 38, padding: "0 14px", border: "none", flexShrink: 0,
            borderBottom: mode === m ? `2px solid ${C.acc}` : "2px solid transparent",
            background: mode === m ? C.surf2 : "transparent",
            color: mode === m ? C.t1 : C.t3, fontSize: 11, fontFamily: "inherit", cursor: "pointer",
          }}>{m}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Model chips */}
        <div>
          <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>Model</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {models.map((m, i) => (
              <button key={m} onClick={() => setModel(i)} style={{
                padding: "4px 10px", borderRadius: R.pill, fontSize: 10, fontFamily: "inherit", cursor: "pointer",
                border: `1px solid ${model === i ? C.acc : C.bdr}`,
                background: model === i ? C.accDim : "transparent",
                color: model === i ? C.acc2 : C.t3,
              }}>{m}</button>
            ))}
          </div>
        </div>

        {/* Mode-specific fields */}
        {(mode === "T2V" || mode === "Motion") && (
          <div>
            <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Prompt</div>
            <textarea value={prompt} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)} rows={4}
              placeholder={mode === "Motion" ? "Describe the character's appearance only — motion comes from reference video" : "Describe the video…"}
              maxLength={2500}
              style={{ width: "100%", background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1, padding: "8px 10px", color: C.t1, fontSize: 12, fontFamily: "inherit", resize: "none", outline: "none" }} />
          </div>
        )}

        {mode === "I2V" && (
          <>
            <div>
              <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Start image <span style={{ color: C.red }}>required</span></div>
              <div style={{
                border: `1px dashed ${C.bdr2}`, borderRadius: R.r2,
                padding: "20px 14px", textAlign: "center", cursor: "pointer",
                background: C.bg3,
              }}>
                <div style={{ fontSize: 20, color: C.t4, marginBottom: 6 }}>↑</div>
                <div style={{ fontSize: 11, color: C.t3 }}>Drop start frame or URL</div>
                <div style={{ fontSize: 10, color: C.t4, marginTop: 2 }}>jpg · png · webp</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Motion prompt</div>
              <textarea value={prompt} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)} rows={3}
                placeholder="Slow cinematic push-in, golden hour stays consistent…"
                style={{ width: "100%", background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1, padding: "8px 10px", color: C.t1, fontSize: 12, fontFamily: "inherit", resize: "none", outline: "none" }} />
            </div>
          </>
        )}

        {mode === "Motion" && (
          <div>
            <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Motion reference video</div>
            <div style={{
              border: `1px dashed ${C.bdr2}`, borderRadius: R.r2,
              padding: "16px 14px", textAlign: "center", cursor: "pointer", background: C.bg3,
            }}>
              <div style={{ fontSize: 11, color: C.t3 }}>Upload reference video</div>
              <div style={{ fontSize: 10, color: C.t4, marginTop: 2 }}>mp4 · mov</div>
            </div>
          </div>
        )}

        {mode === "Image" && (
          <>
            <div>
              <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Prompt</div>
              <textarea value={prompt} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)} rows={4}
                placeholder="Describe the image…" maxLength={2500}
                style={{ width: "100%", background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1, padding: "8px 10px", color: C.t1, fontSize: 12, fontFamily: "inherit", resize: "none", outline: "none" }} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Aspect ratio</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["21:9","16:9","4:3","1:1","9:16"].map(a => (
                  <button key={a} onClick={() => setStyleAr(a)} style={{
                    flex: 1, padding: "5px 0", borderRadius: R.r1, fontSize: 9, fontFamily: "inherit", cursor: "pointer",
                    border: `1px solid ${styleAr === a ? C.acc : C.bdr}`,
                    background: styleAr === a ? C.accDim : "transparent",
                    color: styleAr === a ? C.acc2 : C.t3,
                  }}>{a}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {mode === "Voice" && (
          <>
            <div>
              <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Text <span style={{ color: C.t3, textTransform: "none", letterSpacing: 0 }}>supports [excited] [whispers] tags</span></div>
              <textarea value={prompt} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)} rows={5}
                placeholder="Enter text to speak. Use [excited] or [whispers] inline for emotion."
                style={{ width: "100%", background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1, padding: "8px 10px", color: C.t1, fontSize: 12, fontFamily: "inherit", resize: "none", outline: "none" }} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Stability</div>
              <input type="range" min={0} max={100} defaultValue={50} step={1}
                style={{ width: "100%", accentColor: C.acc }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.t4, marginTop: 2 }}>
                <span>Creative</span><span>Consistent</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Speed</div>
              <input type="range" min={70} max={120} defaultValue={100} step={1}
                style={{ width: "100%", accentColor: C.acc }} />
            </div>
          </>
        )}

        {mode === "Music" && (
          <>
            {/* Sub-mode */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {([["style-lyrics","Style + Lyrics"],["auto-lyrics","Auto-Lyrics"],["instrumental","Instrumental"],["cover","Cover"]] as [MusicSub,string][]).map(([id, label]) => (
                <button key={id} onClick={() => setMusicSub(id)} style={{
                  padding: "4px 10px", borderRadius: R.pill, fontSize: 10, fontFamily: "inherit", cursor: "pointer",
                  border: `1px solid ${musicSub === id ? C.acc : C.bdr}`,
                  background: musicSub === id ? C.accDim : "transparent",
                  color: musicSub === id ? C.acc2 : C.t3,
                }}>{label}</button>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>
                Style prompt <span style={{ color: C.red, textTransform: "none", letterSpacing: 0 }}>— STYLE ONLY · no lyrics here</span>
              </div>
              <input value={styleInput} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStyleInput(e.target.value)}
                placeholder="Soulful R&B, warm, cinematic, 85 BPM, B minor…"
                style={{ width: "100%", background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1, padding: "8px 10px", color: C.t1, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {STYLE_TPLS.map(t => (
                  <button key={t.label} onClick={() => setStyleInput(t.val)} style={{
                    padding: "3px 8px", borderRadius: R.pill, fontSize: 9, cursor: "pointer",
                    background: C.surf, border: `1px solid ${C.bdr}`, color: C.t3, fontFamily: "inherit",
                  }}>{t.label}</button>
                ))}
              </div>
            </div>

            {musicSub !== "instrumental" && musicSub !== "auto-lyrics" && (
              <div>
                <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>
                  Lyrics <span style={{ color: C.amber, textTransform: "none", letterSpacing: 0 }}>— words + structure tags only</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
                  {STRUCT_TAGS.map(tag => (
                    <button key={tag} onClick={() => insertTag(tag)} style={{
                      padding: "2px 7px", borderRadius: R.r1, fontSize: 9, cursor: "pointer",
                      background: C.surf, border: `1px solid ${C.bdr}`, color: C.t3, fontFamily: "inherit",
                    }}>{tag}</button>
                  ))}
                </div>
                <textarea ref={lyricsRef} value={lyricsInput} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setLyricsInput(e.target.value)} rows={5}
                  placeholder={`[Verse]\nNeon lights on wet asphalt glow\nEvery step I take, I own the show\n\n[Chorus]\nThis is my city, my time, my sky`}
                  style={{ width: "100%", background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1, padding: "8px 10px", color: C.t1, fontSize: 11, fontFamily: "inherit", resize: "none", outline: "none" }} />
              </div>
            )}

            {musicSub === "cover" && (
              <div>
                <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Reference audio <span style={{ color: C.t3, textTransform: "none", letterSpacing: 0 }}>— vocals required</span></div>
                <div style={{ border: `1px dashed ${C.bdr2}`, borderRadius: R.r2, padding: "14px", textAlign: "center", cursor: "pointer", background: C.bg3 }}>
                  <div style={{ fontSize: 10, color: C.t3 }}>Drop audio or click · wav · mp3 · min 15s</div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Duration + AR (video modes) */}
        {(mode === "T2V" || mode === "I2V" || mode === "Motion") && (
          <>
            <div>
              <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Duration</div>
              <select value={duration} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDuration(e.target.value as Duration)}
                style={{ width: "100%", background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1, padding: "7px 10px", color: C.t1, fontSize: 12, fontFamily: "inherit", outline: "none" }}>
                {(["3","4","5","8","10","15"] as Duration[]).map(d => <option key={d} value={d}>{d}s</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Aspect ratio</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["16:9","9:16","1:1"] as AR[]).map(a => (
                  <button key={a} onClick={() => setAr(a)} style={{
                    flex: 1, padding: "6px 0", borderRadius: R.r1, fontSize: 11, fontFamily: "inherit", cursor: "pointer",
                    border: `1px solid ${ar === a ? C.acc : C.bdr}`,
                    background: ar === a ? C.accDim : "transparent",
                    color: ar === a ? C.acc2 : C.t3,
                  }}>{a}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Native audio</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[true, false].map(v => (
                  <button key={String(v)} onClick={() => setAudio(v)} style={{
                    flex: 1, padding: "6px 0", borderRadius: R.r1, fontSize: 11, fontFamily: "inherit", cursor: "pointer",
                    border: `1px solid ${audio === v ? C.acc : C.bdr}`,
                    background: audio === v ? C.accDim : "transparent",
                    color: audio === v ? C.acc2 : C.t3,
                  }}>{v ? "On" : "Off"}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Device capture (Music mode) */}
        {mode === "Music" && (
          <div>
            <div style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>Your voice + face</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { id: "mic", state: micState, icon: micState === "done" ? "✓" : micState === "recording" ? "🔴" : "🎙",
                  title: micState === "done" ? "Voice captured" : micState === "recording" ? "Recording…" : "Record voice sample",
                  sub: micState === "done" ? "voice_id stored · IVC ready" : "60s clean speech · min 1 min for IVC", onClick: handleMic },
                { id: "cam", state: camState, icon: camState === "done" ? "✓" : "📷",
                  title: camState === "done" ? "Face captured" : "Capture face reference",
                  sub: camState === "done" ? "face_reference.jpg stored" : "Frontal, good light · 512×512px min", onClick: handleCam },
              ].map(btn => (
                <button key={btn.id} onClick={btn.onClick} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: R.r2,
                  border: `1px solid ${btn.state !== "idle" ? C.acc : C.bdr}`,
                  background: btn.state !== "idle" ? C.accDim : C.bg3,
                  cursor: "pointer", textAlign: "left", width: "100%",
                  animation: btn.state === "recording" ? "streams-pulse 1.5s ease infinite" : "none",
                }}>
                  <span style={{ fontSize: 20 }}>{btn.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, color: C.t1, fontFamily: "inherit", fontWeight: 500 }}>{btn.title}</div>
                    <div style={{ fontSize: 10, color: C.t4, marginTop: 2 }}>{btn.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer: cost + Generate */}
      <div style={{ padding: "12px 14px", borderTop: `1px solid ${C.bdr}`, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 9, color: C.t4, letterSpacing: ".06em", textTransform: "uppercase" }}>Est. cost</span>
          <span style={{ fontSize: 11, color: C.acc2, fontWeight: 500 }}>{cost}</span>
        </div>
        <button onClick={handleGenerate} disabled={isActive} style={{
          width: "100%", padding: "12px 0", borderRadius: R.r2, border: "none",
          background: isActive ? C.bg4 : C.acc,
          color: isActive ? C.t4 : "#fff",
          fontSize: 13, fontFamily: "inherit", fontWeight: 500,
          cursor: isActive ? "not-allowed" : "pointer",
          transition: `background ${DUR.fast} ${EASE}`,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          {isActive && <span style={{ width: 12, height: 12, borderRadius: R.pill, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", display: "inline-block", animation: "streams-spin 600ms linear infinite" }} />}
          ✦ {btnLabel}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {Fields}

      {/* Right — grid + stitch */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }} className="streams-gen-right">

        {/* Generation grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {grid.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.t4, fontSize: 11, flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 28, opacity: .2 }}>✦</span>
              Generate clips — they appear here
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {grid.map((item: GridItem, i: number) => (
                <div key={item.id} style={{
                  aspectRatio: ar === "9:16" ? "9/16" : ar === "1:1" ? "1/1" : "16/9",
                  background: C.bg3, borderRadius: R.r2,
                  border: `1px solid ${item.status === "done" ? C.accBr : C.bdr}`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  position: "relative", overflow: "hidden",
                }}>
                  {item.status === "running" && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(124,58,237,.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ width: 24, height: 24, borderRadius: R.pill, border: `2px solid ${C.acc}`, borderTopColor: "transparent", display: "block", animation: "streams-spin 600ms linear infinite" }} />
                    </div>
                  )}
                  {item.status === "done" && (
                    <>
                      <div style={{ fontSize: 28, color: C.t4, opacity: .2 }}>▶</div>
                      <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: 4 }}>
                        <button onClick={() => addToStitch(item.id)} style={{
                          padding: "3px 8px", borderRadius: R.r1, fontSize: 9, cursor: "pointer", fontFamily: "inherit",
                          background: stitch.includes(item.id) ? C.acc : C.bg4,
                          border: `1px solid ${stitch.includes(item.id) ? C.acc : C.bdr}`,
                          color: stitch.includes(item.id) ? "#fff" : C.t3,
                        }}>+ stitch</button>
                      </div>
                    </>
                  )}
                  {item.status === "waiting" && (
                    <div style={{ fontSize: 10, color: C.t4 }}>Waiting…</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stitch strip */}
        <div style={{ height: 80, flexShrink: 0, borderTop: `1px solid ${C.bdr}`, background: C.bg2, display: "flex", alignItems: "stretch" }}>
          <div style={{ padding: "0 14px", borderRight: `1px solid ${C.bdr}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase" }}>Stitch sequence</span>
            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: R.pill, background: C.surf, border: `1px solid ${C.bdr}`, color: C.t4 }}>fal ffmpeg-api</span>
          </div>
          <div style={{ flex: 1, overflowX: "auto", display: "flex", alignItems: "center", gap: 8, padding: "0 14px" }}>
            {stitch.length === 0 ? (
              <span style={{ fontSize: 10, color: C.t4 }}>Generate clips — add to stitch — merge via fal ffmpeg API</span>
            ) : (
              stitch.map((id: string, i: number) => (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 80, height: 48, borderRadius: R.r1,
                    background: C.bg3, border: `1px solid ${C.accBr}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, color: C.acc2,
                  }}>clip {i + 1}</div>
                  {i < stitch.length - 1 && <span style={{ color: C.t4, fontSize: 14 }}>→</span>}
                </div>
              ))
            )}
          </div>
          {stitch.length >= 2 && (
            <div style={{ padding: "0 14px", display: "flex", alignItems: "center", flexShrink: 0 }}>
              <button style={{
                padding: "8px 14px", borderRadius: R.r1, background: C.acc,
                border: "none", color: "#fff", fontSize: 11, fontFamily: "inherit", cursor: "pointer",
              }}>Stitch → fal</button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes streams-spin  { to { transform: rotate(360deg); } }
        @keyframes streams-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(124,58,237,.4)} 50%{box-shadow:0 0 0 8px rgba(124,58,237,0)} }
        @media (max-width: 768px) {
          .streams-gen-left  { flex: 0 0 100% !important; border-right: none !important; }
          .streams-gen-right { display: none !important; }
        }
      `}</style>
    </div>
  );
}
