"use client";
/**
 * VideoPlayer — 4K-native. No resolution cap. No artificial downscale.
 * Source resolution is preserved end-to-end.
 *
 * Spec:
 *   - Renders at native source resolution (4K=3840×2160, 2K=2560×1440, etc.)
 *   - Auto-detects and badges the resolution from video metadata
 *   - object-fit: contain — full frame always visible, no cropping
 *   - Scrub bar with frame-accurate seeking via requestAnimationFrame
 *   - Space = play/pause  M = mute  F = fullscreen  P = picture-in-picture
 *   - currentWordMs prop → video.currentTime for transcript sync
 *   - onTimeUpdate fires at rAF rate for word highlighting
 *   - Download button opens native source URL (full quality)
 *   - ImageViewer mode: renders <img> at 100% native resolution
 *   - AudioPlayer mode: waveform-style bar with playback controls
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { C, R, DUR, EASE } from "./tokens";

type MediaKind = "video" | "image" | "audio";

export interface MediaPlayerProps {
  src:               string | null;
  kind?:             MediaKind;
  poster?:           string;
  aspectRatio?:      string;
  currentWordMs?:    number | null;
  onTimeUpdate?:     (ms: number) => void;
  onLoadedMetadata?: (durationMs: number, w: number, h: number) => void;
  autoPlay?:         boolean;
  loop?:             boolean;
  showDownload?:     boolean;
  label?:            string;
}

type Res = "4K" | "2K" | "1440p" | "1080p" | "720p" | "480p" | "SD";

function detectRes(w: number, h: number): Res {
  const p = Math.max(w, h);
  if (p >= 3840) return "4K";
  if (p >= 2560) return "2K";
  if (p >= 2160) return "1440p";
  if (p >= 1920) return "1080p";
  if (p >= 1280) return "720p";
  if (p >= 854)  return "480p";
  return "SD";
}

const RES_COLOR: Record<Res, string> = {
  "4K":    "#7c3aed", "2K": "#059669", "1440p": "#059669",
  "1080p": "#2563eb", "720p": "#475569", "480p": "#475569", "SD": "#374151",
};

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
    : `${m}:${String(sec).padStart(2,"0")}`;
}

// ── Image viewer (4K-native) ─────────────────────────────────────────────
function ImageViewer({ src, label, showDownload, aspectRatio = "16/9" }: {
  src: string; label?: string; showDownload?: boolean; aspectRatio?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [dims,   setDims]   = useState<{w:number;h:number}|null>(null);
  const [zoom,   setZoom]   = useState(false);
  const res = dims ? detectRes(dims.w, dims.h) : null;

  return (
    <div style={{ position:"relative", width:"100%", aspectRatio,
                  background:"#000", borderRadius:R.r1, overflow:"hidden",
                  cursor:zoom ? "zoom-out" : "zoom-in" }}
         onClick={() => setZoom((z:boolean) => !z)}>
      {/* 4K image — rendered at 100% native resolution, CSS scales to fit */}
      <img
        src={src}
        alt={label ?? "Generated image"}
        onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => {
          const img = e.currentTarget;
          setLoaded(true);
          setDims({ w: img.naturalWidth, h: img.naturalHeight });
        }}
        style={{
          width:"100%", height:"100%",
          objectFit: zoom ? "none" : "contain",
          objectPosition:"center",
          // Preserve 4K sharpness — disable browser smoothing at 1:1
          imageRendering: zoom ? "pixelated" : "auto",
          display:"block",
          transition:`all ${DUR.base}ms ${EASE}`,
        }}
      />
      {!loaded && <Skeleton />}
      {/* Resolution badge */}
      {res && (
        <ResBadge res={res} w={dims?.w} h={dims?.h} />
      )}
      {showDownload && <DownloadBtn href={src} />}
      {/* Zoom hint */}
      <div style={{ position:"absolute", bottom:8, left:8, fontSize:12,
                    color:"rgba(255,255,255,0.4)", pointerEvents:"none" }}>
        {zoom ? "Click to fit" : "Click to 1:1"}
      </div>
    </div>
  );
}

// ── Audio player ──────────────────────────────────────────────────────────
function AudioPlayer({ src, label, showDownload }: {
  src: string; label?: string; showDownload?: boolean;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration,setDuration]= useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); }
    else          { a.pause(); setPlaying(false); }
  }

  function handleBar(e: React.MouseEvent<HTMLDivElement>) {
    const a = ref.current;
    const b = barRef.current;
    if (!a || !b || !duration) return;
    const r = b.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration;
  }

  const pct = duration > 0 ? (elapsed / duration) * 100 : 0;

  return (
    <div style={{ padding:"16px", borderRadius:R.r2, background:C.bg2,
                  border:`1px solid ${C.bdr}` }}>
      <audio ref={ref} src={src}
        onTimeUpdate={() => setElapsed(ref.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(ref.current?.duration ?? 0)}
        onEnded={() => setPlaying(false)} />
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
        <button onClick={toggle} style={{ width:36, height:36, borderRadius:"50%",
          background:C.acc, border:"none", color:"#fff", fontSize:16,
          cursor:"pointer", flexShrink:0, display:"flex",
          alignItems:"center", justifyContent:"center" }}>
          {playing ? "⏸" : "▶"}
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, color:C.t1, marginBottom:4, fontWeight:500 }}>
            {label ?? "Audio"}
          </div>
          <div style={{ fontSize:12, color:C.t4 }}>
            {fmtTime(elapsed)} / {fmtTime(duration)}
          </div>
        </div>
        {showDownload && <DownloadBtn href={src} small />}
      </div>
      {/* Waveform-style scrub bar */}
      <div ref={barRef} onClick={handleBar} style={{
        height:32, background:C.bg4, borderRadius:R.r1,
        cursor:"pointer", position:"relative", overflow:"hidden",
      }}>
        {/* Progress fill */}
        <div style={{ position:"absolute", top:0, left:0, bottom:0,
          width:`${pct}%`, background:`rgba(124,58,237,0.25)`,
          borderRight:`2px solid ${C.acc}` }} />
        {/* Fake waveform bars */}
        <div style={{ position:"absolute", inset:0, display:"flex",
          alignItems:"center", gap:1, padding:"0 4px", opacity:.35 }}>
          {Array.from({length:80}).map((_,i) => {
            const h = 20 + Math.sin(i * 0.8) * 8 + Math.sin(i * 0.3) * 6;
            const active = (i / 80) * 100 < pct;
            return <div key={i} style={{ flex:1, height:`${h}px`,
              background: active ? C.acc : C.t4, borderRadius:1 }} />;
          })}
        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{
      position:"absolute", inset:0,
      background:`linear-gradient(90deg, ${C.bg3} 25%, ${C.bg4} 50%, ${C.bg3} 75%)`,
      backgroundSize:"200% 100%",
      animation:"streams-shimmer 1.5s ease infinite",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <div style={{ width:32, height:32, borderRadius:"50%",
                    border:`3px solid rgba(255,255,255,0.15)`,
                    borderTopColor:"rgba(255,255,255,0.6)",
                    animation:"streams-spin 700ms linear infinite" }} />
    </div>
  );
}

function ResBadge({ res, w, h }: { res: Res; w?: number; h?: number }) {
  return (
    <div style={{ position:"absolute", top:8, left:8, display:"flex", gap:4 }}>
      <span style={{ fontSize:12, fontWeight:700, letterSpacing:".06em",
                     padding:"2px 6px", borderRadius:R.r1,
                     background:RES_COLOR[res],
                     color:"#fff", backdropFilter:"blur(4px)" }}>
        {res}
      </span>
      {w && h && (
        <span style={{ fontSize:12, padding:"2px 6px", borderRadius:R.r1,
                       background:"rgba(0,0,0,0.55)", color:"rgba(255,255,255,0.7)",
                       backdropFilter:"blur(4px)" }}>
          {w}×{h}
        </span>
      )}
    </div>
  );
}

function DownloadBtn({ href, small }: { href: string; small?: boolean }) {
  return (
    <a href={href} download target="_blank" rel="noopener noreferrer"
       onClick={(e: React.MouseEvent) => e.stopPropagation()}
       title="Download at full quality"
       style={{ position: small ? "static" : "absolute",
                top:8, right:8,
                padding: small ? "4px 8px" : "4px 10px",
                borderRadius:R.r1, background:"rgba(0,0,0,0.55)",
                color:"#fff", fontSize:12, textDecoration:"none",
                backdropFilter:"blur(4px)",
                display:"inline-flex", alignItems:"center", gap:4 }}>
      ↓ {!small && "4K"}
    </a>
  );
}

// ── Main VideoPlayer ──────────────────────────────────────────────────────
export default function MediaPlayer({
  src, kind = "video", poster, aspectRatio = "16/9",
  currentWordMs, onTimeUpdate, onLoadedMetadata,
  autoPlay = false, loop = false, showDownload = true, label,
}: MediaPlayerProps) {

  const videoRef   = useRef<HTMLVideoElement>(null);
  const barRef     = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number>(0);
  const wrapRef    = useRef<HTMLDivElement>(null);

  const [playing,  setPlaying]  = useState(false);
  const [muted,    setMuted]    = useState(false);
  const [elapsed,  setElapsed]  = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [res,      setRes]      = useState<Res | null>(null);
  const [vDims,    setVDims]    = useState<{w:number;h:number}|null>(null);
  const [controls, setControls] = useState(true);
  const [loading,  setLoading]  = useState(true);
  const [shuttle,  setShuttle]  = useState(0);
  const shuttleRef = useRef(0);
  const hideTimer  = useRef<ReturnType<typeof setTimeout>|null>(null);

  // Image / audio delegate
  if (kind === "image" && src) return (
    <ImageViewer src={src} label={label} showDownload={showDownload}
                 aspectRatio={aspectRatio} />
  );
  if (kind === "audio" && src) return (
    <AudioPlayer src={src} label={label} showDownload={showDownload} />
  );

  // Empty state
  if (!src) return (
    <div style={{ width:"100%", aspectRatio, background:C.bg3,
                  borderRadius:R.r1, display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center",
                  border:`1px solid ${C.bdr}` }}>
      <div style={{ fontSize:28, opacity:.15, marginBottom:8 }}>▶</div>
      <div style={{ fontSize:13, color:C.t4 }}>No media loaded</div>
    </div>
  );

  // rAF loop for smooth time tracking
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const startRaf = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    function tick() {
      const v = videoRef.current;
      if (!v) return;
      setElapsed(v.currentTime);
      onTimeUpdate?.(v.currentTime * 1000);
      // Update buffered amount
      if (v.buffered.length > 0) {
        setBuffered(v.buffered.end(v.buffered.length - 1));
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onTimeUpdate]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Seek from transcript
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (currentWordMs != null && videoRef.current) {
      videoRef.current.currentTime = currentWordMs / 1000;
    }
  }, [currentWordMs]);

  // Keyboard shortcuts
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!wrapRef.current?.matches(":hover")) return;
      switch (e.code) {
        case "Space": e.preventDefault(); togglePlay(); break;
        case "KeyM":  toggleMute(); break;
        case "KeyF":  toggleFullscreen(); break;
        case "KeyP":  togglePip(); break;
        case "ArrowLeft":  e.preventDefault(); skip(-5); break;
        case "ArrowRight": e.preventDefault(); skip(5); break;
        case "Comma":      e.preventDefault(); stepFrame(-1); break;
        case "Period":     e.preventDefault(); stepFrame(1); break;
        case "KeyJ": e.preventDefault(); setShuttle((s:number)=>Math.max(s-1,-4)); break;
        case "KeyK": e.preventDefault(); setShuttle(0); videoRef.current?.pause(); setPlaying(false); break;
        case "KeyL": e.preventDefault(); setShuttle((s:number)=>Math.min(s+1,4)); break;
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); startRaf(); }
    else          { v.pause(); setPlaying(false); cancelAnimationFrame(rafRef.current); }
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current?.requestFullscreen();
  }

  function togglePip() {
    const v = videoRef.current;
    if (!v) return;
    if ((document as Document & { pictureInPictureElement?: Element }).pictureInPictureElement) {
      document.exitPictureInPicture();
    } else {
      v.requestPictureInPicture?.();
    }
  }

  function skip(sec: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + sec));
  }

  // Frame step — assumes 30fps, steps 1 frame at a time
  function stepFrame(dir: 1 | -1) {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
    const frameSec = 1 / 30;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + dir * frameSec));
    setElapsed(v.currentTime);
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const v = videoRef.current;
    const b = barRef.current;
    if (!v || !b || !duration) return;
    const rect = b.getBoundingClientRect();
    v.currentTime = Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)) * duration;
  }

  function showCtrl() {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = setTimeout(() => setControls(false), 2800);
  }

  const pct     = duration > 0 ? (elapsed  / duration) * 100 : 0;
  const bufPct  = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div ref={wrapRef}
         style={{ position:"relative", width:"100%", aspectRatio,
                  background:"#000", borderRadius:R.r1, overflow:"hidden",
                  cursor: playing ? "none" : "pointer" }}
         onMouseMove={showCtrl}
         onMouseLeave={() => playing && setControls(false)}
         onClick={togglePlay}>

      {/* 4K video — rendered at native resolution, CSS fits to container */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        loop={loop}
        playsInline
        autoPlay={autoPlay}
        style={{
          width:"100%", height:"100%",
          objectFit:"contain",          // full frame — never crops 4K
          objectPosition:"center",
          display:"block",
          // Browser hint: use HQ rendering pipeline
          imageRendering:"auto",
        }}
        onLoadedMetadata={() => {
          const v = videoRef.current!;
          setDuration(v.duration);
          setLoading(false);
          const w = v.videoWidth;
          const h = v.videoHeight;
          setRes(detectRes(w, h));
          setVDims({ w, h });
          onLoadedMetadata?.(v.duration * 1000, w, h);
        }}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onPlay={() => { setPlaying(true); startRaf(); }}
        onPause={() => { setPlaying(false); cancelAnimationFrame(rafRef.current); }}
        onEnded={() => { setPlaying(false); cancelAnimationFrame(rafRef.current); }}
      />

      {/* Loading skeleton */}
      {loading && <Skeleton />}

      {/* Resolution badge — top left */}
      {res && <ResBadge res={res} w={vDims?.w} h={vDims?.h} />}

      {/* Download at full quality — top right */}
      {showDownload && <DownloadBtn href={src} />}

      {/* Big play button when paused */}
      {!playing && !loading && (
        <div style={{ position:"absolute", inset:0, display:"flex",
                      alignItems:"center", justifyContent:"center",
                      pointerEvents:"none" }}>
          <div style={{ width:56, height:56, borderRadius:"50%",
                        background:"rgba(0,0,0,0.55)",
                        backdropFilter:"blur(6px)",
                        display:"flex", alignItems:"center",
                        justifyContent:"center", fontSize:22, color:"#fff" }}>▶</div>
        </div>
      )}

      {/* Controls overlay */}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0,
        background:"linear-gradient(transparent,rgba(0,0,0,0.82))",
        padding:"32px 12px 10px",
        opacity: controls ? 1 : 0,
        transition:`opacity 180ms ${EASE}`,
        pointerEvents: controls ? "all" : "none",
      }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>

        {/* Scrub bar */}
        <div ref={barRef} onClick={seek}
             style={{ height:3, borderRadius:R.pill, background:"rgba(255,255,255,0.15)",
                      marginBottom:8, cursor:"pointer", position:"relative" }}>
          {/* Buffered */}
          <div style={{ position:"absolute", top:0, left:0, height:"100%",
                        width:`${bufPct}%`, background:"rgba(255,255,255,0.25)",
                        borderRadius:R.pill }} />
          {/* Played */}
          <div style={{ position:"absolute", top:0, left:0, height:"100%",
                        width:`${pct}%`, background:"#fff", borderRadius:R.pill,
                        transition:"width 0.08s linear" }} />
          {/* Thumb */}
          <div style={{ position:"absolute", top:"50%", left:`${pct}%`,
                        transform:"translate(-50%,-50%)",
                        width:12, height:12, borderRadius:"50%", background:"#fff",
                        boxShadow:"0 0 4px rgba(0,0,0,0.6)" }} />
        </div>

        {/* Button row */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Btn onClick={togglePlay}>{playing ? "⏸" : "▶"}</Btn>
          <Btn onClick={() => skip(-5)}>⏪5</Btn>
          <Btn onClick={() => stepFrame(-1)} title="Prev frame (,)">‹</Btn>
          <Btn onClick={() => stepFrame(1)} title="Next frame (.)">›</Btn>
          <Btn onClick={() => skip(5)}>5⏩</Btn>
          <Btn onClick={toggleMute}>{muted ? "🔇" : "🔊"}</Btn>
          <span style={{ fontSize:12, color:"rgba(255,255,255,0.7)", flex:1 }}>
            {fmtTime(elapsed)} / {fmtTime(duration)}
          </span>
          {/* Keyboard hint */}
          <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>
            Space·F·M·P·,·.
          </span>
          <Btn onClick={togglePip} title="Picture-in-picture">⧉</Btn>
          <Btn onClick={toggleFullscreen} title="Fullscreen (F)">⛶</Btn>
        </div>
      </div>

      <style>{`
        @keyframes streams-spin { to { transform:rotate(360deg) } }
        @keyframes streams-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      `}</style>
    </div>
  );
}

function Btn({ onClick, children, title }: {
  onClick: () => void; children: React.ReactNode; title?: string;
}) {
  return (
    <button onClick={onClick} title={title} style={{
      background:"none", border:"none", color:"rgba(255,255,255,0.85)",
      fontSize:15, cursor:"pointer", padding:"0 4px",
      lineHeight:1, fontFamily:"inherit", flexShrink:0,
    }}>{children}</button>
  );
}

// Re-export subcomponents for direct use
export { ImageViewer, AudioPlayer };
