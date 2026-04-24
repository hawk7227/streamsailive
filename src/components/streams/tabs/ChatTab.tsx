"use client";

/**
 * ChatTab — claude.ai-style light theme.
 *
 * KEY BEHAVIOURS (matching claude.ai UX):
 *   1. Status pill appears IMMEDIATELY on send — never blank
 *   2. Status phases advance on timers while waiting for first token
 *   3. RAF buffer drains tokens at 60fps — smooth character-by-character stream
 *      (fixes React 18 batching that caused dump-all-at-once)
 *   4. All modes have distinct phases: Chat, Image, Video, Build
 *   5. Stop button cancels the actual in-flight fetch (AbortController)
 *   6. Lightbox for generated images
 *
 * Rules: CSS.1, 4.1–4.3, 2.1–2.2, 3.1–3.2, 1.5, 9.1 all respected.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import MediaPlayer from "../VideoPlayer";
import { R, S, DUR, EASE } from "../tokens";
import { streamDirectFromOpenAI } from "@/lib/streams/openai-direct";

const CT = {
  bg:          "#ffffff",
  sbBg:        "#f9f9f9",
  border:      "rgba(0,0,0,0.08)",
  t1:          "#18181b",
  t2:          "#52525b",
  t3:          "#71717a",
  t4:          "#a1a1aa",
  chipBorder:  "#d4d4d8",
  chipActive:  "#18181b",
  send:        "#d95b2a",
  inputBorder: "#d4d4d8",
  inputFocus:  "#a1a1aa",
} as const;

type Mode    = "Chat" | "Image" | "Video" | "Build";
type MsgRole = "user" | "assistant";

interface Msg {
  id:           string;
  role:         MsgRole;
  text:         string;
  // Status shown before/during generation — cleared when real text arrives
  statusLabel?: string;   // pill label e.g. "Calling fal ✦"
  statusNote?:  string;   // italic note e.g. "Thinking…"
  mediaUrl?:    string;
  mediaType?:   "image" | "video";
  streaming?:   boolean;
}

type Session     = { id: string; title: string; time: string };
type LibraryItem = { id: string; generation_type: string; output_url: string; created_at: string; cost_usd?: number | null };

async function saveToLibrary(opts: { type: "image"|"video"|"voice"|"music"; outputUrl: string; prompt: string; model?: string; provider?: string; }) {
  try {
    await fetch("/api/streams/save-generation", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(opts),
    });
  } catch { /* non-fatal */ }
}

// ── Phase definitions for each mode ────────────────────────────────────────
// Each phase: [delayMs, statusNote, statusLabel?]
const PHASES = {
  Chat: [
    [0,    "Thinking…",         undefined         ],
    [1400, "Working on it…",   undefined         ],
    [3000, "Almost there…",    undefined         ],
  ],
  Build: [
    [0,    "Analyzing request…",  "Build mode ✦"   ],
    [700,  "Planning response…",  "Planning ✦"     ],
    [1600, "Writing…",            "Writing ✦"      ],
  ],
  Image: [
    [0,    "Submitting to fal…",  "Calling fal ✦"  ],
  ],
  Video: [
    [0,    "Submitting video…",   "Calling fal ✦"  ],
  ],
} as const;

export default function ChatTab() {
  const [msgs,          setMsgs]         = useState<Msg[]>([]);
  const [lightboxUrl,   setLightboxUrl]  = useState<string | null>(null);
  const [input,         setInput]        = useState("");
  const [mode,          setMode]         = useState<Mode>("Chat");
  const [streaming,     setStreaming]    = useState(false);
  const [sidebarOpen,   setSidebarOpen]  = useState(false);
  const [activeNav,     setActiveNav]    = useState<"Sessions"|"Library"|"Images">("Sessions");
  const [sessions,      setSessions]     = useState<Session[]>([{ id: "current", title: "New conversation", time: "now" }]);
  const [activeSession, setActiveSession] = useState("current");
  const msgHistoryRef   = useRef<Record<string, Msg[]>>({ current: [] });
  const [library,       setLibrary]      = useState<LibraryItem[]>([]);
  const [libraryLoading, setLibLoad]     = useState(false);
  const [expandedLib,   setExpandedLib]  = useState<string|null>(null);
  const [attachMode,    setAttachMode]   = useState(false);
  const [attachUrl,     setAttachUrl]    = useState("");
  const [inputFocused,  setInputFocused] = useState(false);
  const [inputBarH,     setInputBarH]    = useState(0);

  // ── Streaming infrastructure refs ──────────────────────────────────────────
  // AbortController — cancels in-flight fetch
  const abortRef = useRef<AbortController | null>(null);

  // RAF streaming buffer — fixes React 18 batch-dump-all-at-once
  // onDelta appends here; RAF loop drains at 60fps (1 setState per frame)
  const tokenBufRef    = useRef<string>("");
  const rafRef         = useRef<number | null>(null);
  const streamingIdRef = useRef<string | null>(null);

  // Phase timer cleanup
  const phaseTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const endRef            = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef      = useRef<HTMLDivElement>(null);
  const textareaRef       = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = inputAreaRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setInputBarH(el.offsetHeight));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return;
    const handler = () => {
      const offset = window.innerHeight - vv.height;
      if (inputContainerRef.current)
        inputContainerRef.current.style.transform = `translateY(-${offset}px)`;
    };
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxUrl(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const loadLibrary = useCallback(async () => {
    if (libraryLoading) return;
    setLibLoad(true);
    try {
      const res = await fetch("/api/streams/library?limit=20", { credentials: "include" });
      if (res.ok) { const j = await res.json() as { data?: LibraryItem[] }; setLibrary(j.data ?? []); }
    } catch { /* empty */ } finally { setLibLoad(false); }
  }, [libraryLoading]);

  // ── RAF token flush — runs at 60fps, drains tokenBufRef into state ─────────
  function startTokenFlush(id: string) {
    streamingIdRef.current = id;
    tokenBufRef.current = "";

    function flush() {
      const tok = tokenBufRef.current;
      if (tok) {
        tokenBufRef.current = "";
        // Single setState per animation frame — smooth character appearance
        setMsgs(p => p.map(m => m.id === id
          ? { ...m, text: m.text + tok, statusLabel: undefined, statusNote: undefined }
          : m));
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }
      if (streamingIdRef.current === id) {
        rafRef.current = requestAnimationFrame(flush);
      }
    }
    rafRef.current = requestAnimationFrame(flush);
  }

  function stopTokenFlush(id: string) {
    streamingIdRef.current = null;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    // Drain any remaining tokens
    const remaining = tokenBufRef.current;
    tokenBufRef.current = "";
    if (remaining) {
      setMsgs(p => p.map(m => m.id === id
        ? { ...m, text: m.text + remaining, statusLabel: undefined, statusNote: undefined }
        : m));
    }
  }

  // ── Phase system — advances status labels while waiting for first token ────
  function startPhases(id: string, phases: readonly (readonly [number, string, string|undefined])[]) {
    clearPhases();
    phases.forEach(([ms, note, label]) => {
      if (ms === 0) {
        setMsgs(p => p.map(m => m.id === id ? { ...m, statusNote: note, statusLabel: label } : m));
      } else {
        const t = setTimeout(() => {
          setMsgs(p => p.map(m => m.id === id && m.streaming ? { ...m, statusNote: note, statusLabel: label } : m));
        }, ms);
        phaseTimersRef.current.push(t);
      }
    });
  }

  function clearPhases() {
    phaseTimersRef.current.forEach(clearTimeout);
    phaseTimersRef.current = [];
  }

  // ── Message mutation helpers ───────────────────────────────────────────────
  function finishMsg(id: string) {
    clearPhases();
    stopTokenFlush(id);
    setMsgs(p => p.map(m => m.id === id
      ? { ...m, streaming: false, statusLabel: undefined, statusNote: undefined }
      : m));
    setStreaming(false);
    abortRef.current = null;
  }

  function errorMsg(id: string, text: string) {
    clearPhases();
    stopTokenFlush(id);
    setMsgs(p => p.map(m => m.id === id
      ? { ...m, text, streaming: false, statusLabel: undefined, statusNote: undefined }
      : m));
    setStreaming(false);
    abortRef.current = null;
  }

  function setMedia(id: string, mediaUrl: string, mediaType: "image"|"video") {
    clearPhases();
    setMsgs(p => p.map(m => m.id === id
      ? { ...m, mediaUrl, mediaType, text: "", streaming: false, statusLabel: undefined, statusNote: undefined }
      : m));
    setStreaming(false);
  }

  // ── Stop ──────────────────────────────────────────────────────────────────
  function handleStop() {
    abortRef.current?.abort();
    clearPhases();
    stopTokenFlush(streamingIdRef.current ?? "");
    setMsgs(p => p.map(m => m.streaming
      ? { ...m, streaming: false, statusLabel: undefined, statusNote: "Stopped" }
      : m));
    setStreaming(false);
    abortRef.current = null;
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    setMsgs(p => [...p, { id: Date.now().toString(), role: "user", text }]);
    setSessions(prev => prev.map(s =>
      s.id === activeSession && s.title === "New conversation"
        ? { ...s, title: text.slice(0, 36) + (text.length > 36 ? "…" : "") } : s));
    setInput(""); setStreaming(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const aiId = (Date.now() + 1).toString();
    const ctrl  = new AbortController();
    abortRef.current = ctrl;

    const { getProviderKey } = await import("@/lib/streams/provider-keys");
    const falKey    = getProviderKey("fal");
    const openaiKey = getProviderKey("openai");

    // ── IMAGE ────────────────────────────────────────────────────────────────
    if (mode === "Image") {
      setMsgs(p => [...p, { id: aiId, role: "assistant", text: "", streaming: true }]);
      startPhases(aiId, PHASES.Image);

      if (falKey) {
        const { submitDirectToFal, extractImageUrl } = await import("@/lib/streams/fal-direct");
        await submitDirectToFal({
          endpoint: "fal-ai/flux-pro/kontext/text-to-image",
          input:    { prompt: text, aspect_ratio: "1:1" },
          signal:   ctrl.signal,
          onProgress: (status, logs) => {
            const isQueued    = status.includes("Queue") || status.includes("Queued");
            const isGenerating = status.includes("Progress") || status.includes("Generating");
            const label = isQueued ? "Queued — fal ✦" : isGenerating ? "Generating image ✦" : "fal processing ✦";
            const note  = logs?.[0] ?? status;
            setMsgs(p => p.map(m => m.id === aiId ? { ...m, statusLabel: label, statusNote: note } : m));
          },
          onDone: (raw) => {
            const url = extractImageUrl(raw);
            if (url) {
              setMedia(aiId, url, "image");
              void saveToLibrary({ type: "image", outputUrl: url, prompt: text, provider: "fal", model: "flux-pro" });
            } else { errorMsg(aiId, "Image completed but no URL returned — try again."); }
          },
          onError: (err) => errorMsg(aiId,
            err.includes("key not set") ? "fal key not set — go to Settings → API Keys, paste your fal key, then Save." :
            err.includes("401") ? "fal key invalid — go to Settings → API Keys and re-enter your fal key." :
            err.includes("429") ? "fal rate limit hit — wait 30 seconds and try again." : err),
        });
        return;
      }

      if (openaiKey) {
        setMsgs(p => p.map(m => m.id === aiId
          ? { ...m, statusLabel: "Calling OpenAI ✦", statusNote: "Generating image with gpt-image-1…" }
          : m));
        try {
          const res = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST", signal: ctrl.signal,
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
            body: JSON.stringify({ model: "gpt-image-1", prompt: text, n: 1, size: "1024x1024", quality: "standard" }),
          });
          const data = await res.json() as { data?: Array<{ url?: string; b64_json?: string }>; error?: { message: string } };
          if (!res.ok || data.error) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
          const item = data.data?.[0];
          const url  = item?.url ?? (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : null);
          if (url) {
            setMedia(aiId, url, "image");
            if (!url.startsWith("data:"))
              void saveToLibrary({ type: "image", outputUrl: url, prompt: text, provider: "openai", model: "gpt-image-1" });
          } else { errorMsg(aiId, "OpenAI image completed but no URL returned."); }
        } catch (err) {
          if ((err as Error).name === "AbortError") { finishMsg(aiId); return; }
          errorMsg(aiId, err instanceof Error ? err.message : "Image generation failed");
        }
        return;
      }

      errorMsg(aiId, "No image key — go to Settings → API Keys and add a fal or OpenAI key.");
      return;
    }

    // ── VIDEO ────────────────────────────────────────────────────────────────
    if (mode === "Video") {
      setMsgs(p => [...p, { id: aiId, role: "assistant", text: "", streaming: true }]);
      startPhases(aiId, PHASES.Video);

      if (!falKey) { errorMsg(aiId, "fal key not set — go to Settings → API Keys, paste your fal key, then Save."); return; }

      const { submitDirectToFal, extractVideoUrl } = await import("@/lib/streams/fal-direct");
      await submitDirectToFal({
        endpoint: "fal-ai/kling-video/v3/standard/text-to-video",
        input:    { prompt: text, duration: "5", aspect_ratio: "16:9" },
        signal:   ctrl.signal,
        pollMs:   4000,
        maxPolls: 60,
        onProgress: (status, logs) => {
          const isGenerating = status.includes("Progress") || status.includes("Generating");
          setMsgs(p => p.map(m => m.id === aiId
            ? { ...m,
                statusLabel: isGenerating ? "Generating — Kling v3 ✦" : "Queued — Kling v3 ✦",
                statusNote:  logs?.[0] ?? status }
            : m));
        },
        onDone: (raw) => {
          const url = extractVideoUrl(raw);
          if (url) {
            setMedia(aiId, url, "video");
            void saveToLibrary({ type: "video", outputUrl: url, prompt: text, provider: "fal", model: "kling-v3" });
          } else { errorMsg(aiId, "Video completed but no URL returned — try again."); }
        },
        onError: (err) => errorMsg(aiId, err),
      });
      return;
    }

    // ── CHAT / BUILD — OpenAI direct stream with RAF buffer ──────────────────
    const isBuild = mode === "Build";
    setMsgs(p => [...p, { id: aiId, role: "assistant", text: "", streaming: true }]);
    startPhases(aiId, isBuild ? PHASES.Build : PHASES.Chat);

    const history = msgs.slice(-12).map(m => ({
      role:    m.role as "user"|"assistant",
      content: m.text,
    }));

    let firstDelta = true;

    await streamDirectFromOpenAI({
      message: isBuild ? `[Build mode — Streams AI platform] ${text}` : text,
      history,
      signal: ctrl.signal,
      onDelta: (delta) => {
        if (firstDelta) {
          firstDelta = false;
          clearPhases();
          // Start RAF loop — subsequent deltas go into the buffer
          startTokenFlush(aiId);
        }
        // Append to buffer ref — NOT setState — RAF loop drains it at 60fps
        tokenBufRef.current += delta;
      },
      onDone: () => finishMsg(aiId),
      onError: (err) => {
        if (err.includes("aborted") || err.includes("AbortError")) { finishMsg(aiId); return; }
        errorMsg(aiId, err);
      },
    });
  }

  function handleNewChat() {
    clearPhases();
    msgHistoryRef.current[activeSession] = msgs;
    const newId = crypto.randomUUID();
    msgHistoryRef.current[newId] = [];
    setSessions(prev => [{ id: newId, title: "New conversation", time: "now" }, ...prev.slice(0,9)]);
    setActiveSession(newId); setMsgs([]); setSidebarOpen(false);
  }

  // ── Status pill ───────────────────────────────────────────────────────────
  function StatusRow({ label, note }: { label?: string; note?: string }) {
    if (!label && !note) return null;
    return (
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:S.s2, flexWrap:"wrap" }}>
        {label && (
          <span style={{
            display:"inline-flex", alignItems:"center", gap:5,
            padding:"2px 10px", borderRadius:R.pill,
            background:"rgba(0,0,0,0.04)", border:"1px solid rgba(0,0,0,0.08)",
            fontSize:12, color:CT.t3,
          }}>
            <span style={{
              display:"inline-block", width:6, height:6,
              borderRadius:"50%", background:CT.send, flexShrink:0,
              animation:"streams-pulse2 1.2s ease infinite",
            }}/>
            {label}
          </span>
        )}
        {note && (
          <span style={{ fontSize:14, color:CT.t4, fontStyle:"italic" }}>
            {note}
          </span>
        )}
      </div>
    );
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const Sidebar = (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:CT.sbBg, overflow:"hidden" }}>
      <div style={{ padding:"16px 16px 12px", borderBottom:`1px solid ${CT.border}`, flexShrink:0 }}>
        <div style={{ fontSize:12, color:CT.t4, letterSpacing:".18em", textTransform:"uppercase", marginBottom:S.s3 }}>Streams</div>
        <button onClick={handleNewChat} style={{
          display:"flex", alignItems:"center", justifyContent:"center", gap:S.s2,
          width:"100%", padding:"9px 0", background:CT.send, border:"none",
          borderRadius:R.r2, color:"#fff", fontSize:14,
          fontFamily:"inherit", cursor:"pointer", minHeight:44,
        }}>+ New chat</button>
      </div>

      <nav aria-label="Sidebar navigation" style={{ padding:S.s2, borderBottom:`1px solid ${CT.border}`, flexShrink:0 }}>
        {(["Sessions","Library","Images"] as const).map(id => (
          <button key={id} onClick={() => { setActiveNav(id); if (id==="Library"||id==="Images") void loadLibrary(); }}
            style={{
              display:"flex", alignItems:"center", gap:S.s3,
              width:"100%", padding:"8px 12px",
              background:activeNav===id?"rgba(0,0,0,0.06)":"transparent",
              border:"none", borderRadius:R.r1, color:activeNav===id?CT.t1:CT.t2,
              fontSize:14, fontFamily:"inherit", cursor:"pointer", textAlign:"left", minHeight:44,
            }}>{id}</button>
        ))}
      </nav>

      <div style={{ flex:1, overflowY:"auto" }}>
        <div style={{ padding:"12px 16px 4px", fontSize:12, color:CT.t4, letterSpacing:".1em", textTransform:"uppercase" }}>Recents</div>

        {activeNav==="Sessions" && sessions.map(s => (
          <button key={s.id} onClick={() => {
            msgHistoryRef.current[activeSession]=msgs; setActiveSession(s.id);
            setMsgs(msgHistoryRef.current[s.id]??[]); setSidebarOpen(false);
          }} style={{
            display:"block", textAlign:"left", padding:"8px 16px",
            width:"100%", border:"none",
            background:s.id===activeSession?"rgba(0,0,0,0.06)":"transparent",
            color:s.id===activeSession?CT.t1:CT.t2, fontSize:14, fontFamily:"inherit", cursor:"pointer",
          }}>
            <div style={{ fontSize:13, marginBottom:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.title}</div>
            <div style={{ fontSize:12, color:CT.t4 }}>{s.time}</div>
          </button>
        ))}

        {(activeNav==="Library"||activeNav==="Images") && (
          <div style={{ padding:S.s2 }}>
            {libraryLoading && <div style={{ padding:"12px 8px", fontSize:14, color:CT.t4 }}>Loading…</div>}
            {!libraryLoading && library.length===0 && (
              <div style={{ padding:"12px 8px", fontSize:13, color:CT.t4 }}>
                {activeNav==="Images"?"No images yet":"No generations yet"}
              </div>
            )}
            {!libraryLoading && library
              .filter(i => activeNav==="Images"?i.generation_type==="image":true)
              .map((item:LibraryItem) => {
                const icons: Record<string,string> = { video_t2v:"🎬",video_i2v:"🎬",image:"🖼",voice:"🎙",music:"🎵" };
                return (
                  <div key={item.id} role="button" tabIndex={0}
                    onKeyDown={(e:React.KeyboardEvent) => { if(e.key==="Enter"||e.key===" ") setExpandedLib(expandedLib===item.id?null:item.id); }}
                    onClick={() => setExpandedLib(expandedLib===item.id?null:item.id)}
                    style={{ padding:S.s2, borderRadius:R.r1, marginBottom:S.s1, cursor:"pointer", border:`0.5px solid ${CT.border}`, background:"transparent" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:S.s2 }}>
                      <span style={{ fontSize:16, width:24, textAlign:"center", flexShrink:0 }}>{icons[item.generation_type]??"✦"}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:CT.t1, fontSize:13, textTransform:"capitalize", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {item.generation_type.replace("_"," ")}
                        </div>
                        <div style={{ color:CT.t4, fontSize:12 }}>
                          {new Date(item.created_at).toLocaleDateString(undefined,{month:"short",day:"numeric"})}
                        </div>
                      </div>
                    </div>
                    {item.output_url && expandedLib===item.id && (
                      <div style={{ borderRadius:R.r1, overflow:"hidden", marginTop:S.s2 }}>
                        <MediaPlayer src={item.output_url}
                          kind={item.generation_type==="image"?"image":item.generation_type==="voice"||item.generation_type==="music"?"audio":"video"}
                          aspectRatio={item.generation_type==="image"?"1/1":"16/9"} showDownload label={item.generation_type}/>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden", background:CT.bg }}>

      <div className={`streams-chat-sb2${sidebarOpen?" open":""}`}>{Sidebar}</div>

      <div onClick={() => setSidebarOpen(false)} aria-hidden="true" style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:299,
        opacity:sidebarOpen?1:0, pointerEvents:sidebarOpen?"auto":"none",
        transition:`opacity ${DUR.base} ${EASE}`,
      }}/>

      {/* ── Lightbox ── */}
      {lightboxUrl && (
        <div
          role="dialog" aria-label="Image lightbox" aria-modal="true"
          onClick={() => setLightboxUrl(null)}
          style={{
            position:"fixed", inset:0, zIndex:500,
            background:"rgba(0,0,0,0.9)",
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"zoom-out", padding:20,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="Full size" onClick={e => e.stopPropagation()}
            style={{ maxWidth:"100%", maxHeight:"90vh", borderRadius:R.r2, boxShadow:"0 24px 80px rgba(0,0,0,0.6)", cursor:"default" }}/>
          <button aria-label="Close lightbox" onClick={() => setLightboxUrl(null)}
            style={{
              position:"absolute", top:20, right:20, width:40, height:40,
              display:"flex", alignItems:"center", justifyContent:"center",
              background:"rgba(255,255,255,0.15)", border:"none",
              borderRadius:R.pill, color:"#fff", fontSize:20, cursor:"pointer",
            }}>×</button>
        </div>
      )}

      {/* ── Main ── */}
      <div ref={inputContainerRef} style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:CT.bg }}>

        <div className="streams-chat-mhdr2" style={{
          padding:"12px 16px", borderBottom:`1px solid ${CT.border}`,
          alignItems:"center", gap:S.s3,
        }}>
          <button aria-label="Open sidebar" onClick={() => setSidebarOpen(v=>!v)} style={{
            background:"transparent", border:`1px solid ${CT.border}`,
            borderRadius:R.r1, color:CT.t2, cursor:"pointer", fontFamily:"inherit",
            minWidth:44, minHeight:44, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
          }}>☰</button>
          <span style={{ fontSize:15, color:CT.t1 }}>Streams</span>
        </div>

        {/* ── Messages ── */}
        <div role="log" aria-live="polite" aria-atomic="false" aria-label="Conversation messages"
          style={{ flex:1, overflowY:"auto", overscrollBehavior:"contain", paddingBottom:inputBarH+S.s4 }}>

          {msgs.length===0 && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60%", padding:"40px 32px", textAlign:"center" }}>
              <div style={{ fontSize:22, color:CT.t1, marginBottom:S.s2 }}>AI assistant</div>
              <div style={{ fontSize:15, color:CT.t3, lineHeight:1.6, maxWidth:360 }}>
                Generate images, videos, voice and code directly from conversation.
              </div>
            </div>
          )}

          {msgs.length>0 && (
            <div className="streams-chat-msgs2" style={{
              maxWidth:820, margin:"0 auto", padding:"32px 32px 0",
              display:"flex", flexDirection:"column", gap:S.s5,
            }}>
              {msgs.map((msg:Msg) => (
                <div key={msg.id} style={{ display:"flex", flexDirection:"column", alignItems:msg.role==="user"?"flex-end":"flex-start" }}>

                  {msg.role==="assistant" && (
                    <div style={{ fontSize:12, letterSpacing:".14em", textTransform:"uppercase", color:CT.t4, marginBottom:S.s1 }}>
                      STREAMS
                    </div>
                  )}

                  {/* Status row — shows immediately, phases advance on timers */}
                  {msg.role==="assistant" && (msg.statusLabel || (msg.streaming && !msg.text && !msg.mediaUrl)) && (
                    <StatusRow label={msg.statusLabel} note={msg.statusNote} />
                  )}

                  {/* Stopped note */}
                  {msg.role==="assistant" && !msg.streaming && msg.statusNote==="Stopped" && (
                    <div style={{ fontSize:12, color:CT.t4, fontStyle:"italic", marginBottom:S.s1 }}>Stopped</div>
                  )}

                  {/* Text stream */}
                  {msg.text && (
                    <div style={{
                      maxWidth:msg.role==="user"?"72%":"100%",
                      color:CT.t1, fontSize:16, lineHeight:1.75,
                      overflowWrap:"break-word",
                      textAlign:msg.role==="user"?"right":"left",
                      whiteSpace:"pre-wrap",
                    }}>
                      {msg.text}
                      {msg.streaming && msg.text && (
                        <span style={{
                          display:"inline-block", width:2, height:16,
                          background:CT.t1, borderRadius:1, marginLeft:2,
                          verticalAlign:"text-bottom",
                          animation:"streams-blink2 0.8s ease infinite",
                        }}/>
                      )}
                    </div>
                  )}

                  {/* Media */}
                  {msg.role==="assistant" && msg.mediaUrl && (
                    <div style={{ marginTop:S.s2 }}>
                      {msg.mediaType==="video" ? (
                        <div style={{ width:"100%", maxWidth:480 }}>
                          <MediaPlayer src={msg.mediaUrl} kind="video" aspectRatio="16/9" showDownload label="Generated video"/>
                        </div>
                      ) : (
                        <div
                          role="button" aria-label="View full size" tabIndex={0}
                          onClick={() => setLightboxUrl(msg.mediaUrl!)}
                          onKeyDown={(e:React.KeyboardEvent) => { if(e.key==="Enter"||e.key===" ") setLightboxUrl(msg.mediaUrl!); }}
                          style={{ cursor:"zoom-in", borderRadius:R.r2, overflow:"hidden", display:"inline-block", maxWidth:400, width:"100%", boxShadow:"0 4px 20px rgba(0,0,0,0.10)" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={msg.mediaUrl} alt="Generated" style={{ width:"100%", height:"auto", display:"block" }}/>
                          <div style={{ padding:"5px 10px", background:"rgba(0,0,0,0.04)", fontSize:12, color:CT.t4, display:"flex", gap:8 }}>
                            <span>🔍 Enlarge</span>
                            <a href={msg.mediaUrl} download onClick={e=>e.stopPropagation()} style={{ color:CT.send, textDecoration:"none" }}>↓ Download</a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={endRef} style={{ height:1 }}/>
            </div>
          )}
        </div>

        {/* ── Input ── */}
        <div ref={inputAreaRef} className="streams-chat-input2" style={{
          borderTop:`1px solid ${CT.border}`, background:CT.bg, flexShrink:0,
          padding:"16px 24px",
          paddingBottom:"calc(20px + env(safe-area-inset-bottom))",
        }}>
          <div style={{ maxWidth:820, margin:"0 auto" }}>

            {attachMode && (
              <div style={{ display:"flex", gap:S.s2, marginBottom:S.s2 }}>
                <input value={attachUrl} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setAttachUrl(e.target.value)}
                  placeholder="Paste image or video URL…"
                  style={{ flex:1, background:"#f4f4f5", border:"none", borderRadius:R.r2, padding:"8px 12px", color:CT.t1, fontSize:16, fontFamily:"inherit", outline:"none" }}
                  onKeyDown={(e:React.KeyboardEvent<HTMLInputElement>)=>{
                    if(e.key==="Enter"&&attachUrl.trim()){setInput(p=>p+(p?" ":"")+attachUrl.trim());setAttachUrl("");setAttachMode(false);}
                    if(e.key==="Escape") setAttachMode(false);
                  }}/>
                <button onClick={()=>{setInput(p=>p+(p?" ":"")+attachUrl.trim());setAttachUrl("");setAttachMode(false);}}
                  style={{ padding:"8px 16px", borderRadius:R.r2, background:CT.send, border:"none", color:"#fff", fontSize:14, fontFamily:"inherit", cursor:"pointer", minHeight:44 }}>
                  Attach
                </button>
              </div>
            )}

            <div className="streams-chat-chips2" style={{ display:"flex", gap:S.s2, marginBottom:S.s3, overflowX:"auto", scrollbarWidth:"none" as React.CSSProperties["scrollbarWidth"] }}>
              {(["Chat","Image","Video","Build"] as Mode[]).map(m=>(
                <button key={m} onClick={()=>setMode(m)} style={{
                  padding:"6px 14px", borderRadius:R.pill,
                  border:`1px solid ${mode===m?CT.chipActive:CT.chipBorder}`,
                  background:mode===m?CT.chipActive:"transparent",
                  color:mode===m?"#fff":CT.t2,
                  fontSize:13, fontFamily:"inherit", cursor:"pointer",
                  flexShrink:0, minHeight:32,
                  transition:`background ${DUR.fast} ${EASE}, border-color ${DUR.fast} ${EASE}, color ${DUR.fast} ${EASE}`,
                }}>{m}</button>
              ))}
            </div>

            <div style={{ display:"flex", alignItems:"flex-end", gap:S.s2 }}>

              <button aria-label="Attach URL" onClick={()=>setAttachMode(v=>!v)} style={{
                width:44, height:44, flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                background:attachMode?"rgba(217,91,42,0.08)":"transparent",
                border:`1px solid ${attachMode?CT.send:CT.chipBorder}`,
                borderRadius:R.r2, color:attachMode?CT.send:CT.t3, fontSize:18, cursor:"pointer",
              }}>⊕</button>

              <div style={{
                flex:1, border:`2px solid ${inputFocused?CT.inputFocus:CT.inputBorder}`,
                borderRadius:24, padding:"12px 16px", background:CT.bg,
                transition:`border-color ${DUR.fast} ${EASE}`,
              }}>
                <textarea ref={textareaRef} value={input} maxLength={2000}
                  aria-label="Message input" aria-multiline="true"
                  onFocus={()=>setInputFocused(true)} onBlur={()=>setInputFocused(false)}
                  onChange={(e:React.ChangeEvent<HTMLTextAreaElement>)=>{
                    setInput(e.target.value);
                    e.target.style.height="auto";
                    e.target.style.height=Math.min(e.target.scrollHeight,160)+"px";
                  }}
                  onKeyDown={(e:React.KeyboardEvent<HTMLTextAreaElement>)=>{
                    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void handleSend();}
                  }}
                  placeholder={`Message Streams — ${mode} mode`}
                  rows={1}
                  style={{
                    width:"100%", background:"transparent", border:"none", outline:"none",
                    fontFamily:"inherit", fontSize:16, color:CT.t1,
                    resize:"none", lineHeight:1.5, minHeight:24,
                  }}/>
              </div>

              {streaming?(
                <button onClick={handleStop} aria-label="Stop generation" style={{
                  width:44,height:44,flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  background:"transparent", border:`2px solid ${CT.chipBorder}`,
                  borderRadius:R.pill, color:CT.t2, cursor:"pointer", fontSize:14,
                }}>■</button>
              ):(
                <button onClick={()=>void handleSend()} disabled={!input.trim()} aria-label="Send message" style={{
                  width:44,height:44,flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  background:input.trim()?CT.send:"#e4e4e7",
                  border:"none", borderRadius:R.pill, color:"#fff",
                  cursor:input.trim()?"pointer":"not-allowed", fontSize:20,
                  transition:`background ${DUR.fast} ${EASE}`,
                }}>↑</button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes streams-blink2  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes streams-pulse2  { 0%,100%{opacity:1} 50%{opacity:0.25} }
        .streams-chat-chips2::-webkit-scrollbar { display:none; }

        .streams-chat-sb2 {
          position:fixed; top:0; left:0;
          height:100dvh; width:260px; z-index:300;
          transform:translateX(-100%);
          transition:transform ${DUR.base} ${EASE};
          border-right:1px solid rgba(0,0,0,0.08);
        }
        .streams-chat-sb2.open { transform:translateX(0); }
        .streams-chat-mhdr2 { display:none; }

        @media (max-width:767px) {
          .streams-chat-mhdr2 { display:flex; }
          .streams-chat-msgs2 { padding:20px 16px 0; }
          .streams-chat-input2 { padding:12px 16px; padding-bottom:calc(16px + env(safe-area-inset-bottom)); }
        }
        @media (min-width:768px) {
          .streams-chat-sb2 { position:relative; height:100%; transform:none; transition:none; z-index:auto; flex-shrink:0; }
          .streams-chat-sb2.open { transform:none; }
        }
      `}</style>
    </div>
  );
}
