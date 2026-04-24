"use client";

/**
 * ChatTab — claude.ai-style light theme with ActivityConversation + MediaGenerationStage
 *
 * Integration rules (from spec):
 *   1. On Send: immediately mount ActivityConversation (<50ms)
 *   2. If image/video route detected: also mount MediaGenerationStage in-thread
 *   3. MediaGenerationStage renders IN the message, where final media will appear
 *   4. State flows: phase prop advances (real phases only)
 *   5. Handoff: first token → remove ActivityConversation | media complete → replace animation
 *   6. Never blank, never fake states, never separate preview area
 *
 * Rules: CSS.1, 4.1–4.3, 2.1–2.2, 3.1–3.2, 1.5, 9.1 all respected.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import MediaPlayer from "../VideoPlayer";
import { R, S, DUR, EASE } from "../tokens";
import { streamDirectFromOpenAI } from "@/lib/streams/openai-direct";
import { ActivityConversation } from "@/components/assistant/ActivityConversation";
import { MediaGenerationStage } from "@/components/assistant/MediaGenerationStage";
import type { ActivityPhase } from "@/lib/assistant-ui/activityConversations";
import type { MediaGenerationState } from "@/components/assistant/MediaGenerationStage";

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
  id:             string;
  role:           MsgRole;
  text:           string;
  // Phase drives ActivityConversation — real system state only
  phase?:         ActivityPhase;
  // Media generation
  mediaStage?:    MediaGenerationState;
  mediaKind?:     "image" | "video";
  mediaUrl?:      string;
  // First output visible = hide ActivityConversation
  firstOutput?:   boolean;
  streaming?:     boolean;
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

  // AbortController for cancelling in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  // RAF streaming buffer — prevents React 18 batch-dump
  const tokenBufRef    = useRef<string>("");
  const rafRef         = useRef<number | null>(null);
  const streamingIdRef = useRef<string | null>(null);

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

  // ── RAF streaming buffer ───────────────────────────────────────────────────
  function startTokenFlush(id: string) {
    streamingIdRef.current = id;
    tokenBufRef.current = "";
    function flush() {
      const tok = tokenBufRef.current;
      if (tok) {
        tokenBufRef.current = "";
        setMsgs(p => p.map(m => m.id === id
          ? { ...m, text: m.text + tok, phase: undefined, firstOutput: true }
          : m));
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }
      if (streamingIdRef.current === id) rafRef.current = requestAnimationFrame(flush);
    }
    rafRef.current = requestAnimationFrame(flush);
  }

  function stopTokenFlush(id: string) {
    streamingIdRef.current = null;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const remaining = tokenBufRef.current;
    tokenBufRef.current = "";
    if (remaining) {
      setMsgs(p => p.map(m => m.id === id
        ? { ...m, text: m.text + remaining, phase: undefined, firstOutput: true }
        : m));
    }
  }

  // ── Phase helper ──────────────────────────────────────────────────────────
  function advancePhase(id: string, phase: ActivityPhase, mediaStage?: MediaGenerationState) {
    setMsgs(p => p.map(m => m.id === id
      ? { ...m, phase, ...(mediaStage ? { mediaStage } : {}) }
      : m));
  }

  // ── Finish helpers ────────────────────────────────────────────────────────
  function finishMsg(id: string) {
    stopTokenFlush(id);
    setMsgs(p => p.map(m => m.id === id
      ? { ...m, streaming: false, phase: undefined, firstOutput: true }
      : m));
    setStreaming(false);
    abortRef.current = null;
  }

  function errorMsg(id: string, text: string) {
    stopTokenFlush(id);
    setMsgs(p => p.map(m => m.id === id
      ? { ...m, text, streaming: false, phase: undefined, firstOutput: true, mediaStage: "error" }
      : m));
    setStreaming(false);
    abortRef.current = null;
  }

  function completeMedia(id: string, mediaUrl: string, kind: "image"|"video") {
    setMsgs(p => p.map(m => m.id === id
      ? { ...m, mediaUrl, mediaKind: kind, mediaStage: "complete", streaming: false, phase: undefined, firstOutput: true }
      : m));
    setStreaming(false);
    abortRef.current = null;
  }

  // ── Stop ──────────────────────────────────────────────────────────────────
  function handleStop() {
    abortRef.current?.abort();
    stopTokenFlush(streamingIdRef.current ?? "");
    setMsgs(p => p.map(m => m.streaming
      ? { ...m, streaming: false, phase: undefined, firstOutput: true }
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

    // ── IMAGE ─────────────────────────────────────────────────────────────────
    if (mode === "Image") {
      // Immediately mount: ActivityConversation (chat_thinking→image_submitting)
      // AND MediaGenerationStage (starting) in the same message node
      setMsgs(p => [...p, {
        id: aiId, role: "assistant", text: "",
        phase: "image_submitting",
        mediaStage: "starting",
        mediaKind: "image",
        streaming: true,
      }]);

      if (falKey) {
        const { submitDirectToFal, extractImageUrl } = await import("@/lib/streams/fal-direct");
        await submitDirectToFal({
          endpoint: "fal-ai/flux-pro/kontext/text-to-image",
          input:    { prompt: text, aspect_ratio: "1:1" },
          signal:   ctrl.signal,
          onProgress: (status) => {
            const isGenerating = status.includes("Progress") || status.includes("Generating");
            advancePhase(aiId,
              isGenerating ? "image_generating" : "image_queued",
              isGenerating ? "generating" : "queued"
            );
          },
          onDone: (raw) => {
            const url = extractImageUrl(raw);
            if (url) {
              // Advance to finalizing briefly before complete
              advancePhase(aiId, "image_finalizing", "finalizing");
              setTimeout(() => {
                completeMedia(aiId, url, "image");
                void saveToLibrary({ type: "image", outputUrl: url, prompt: text, provider: "fal", model: "flux-pro" });
              }, 400);
            } else { errorMsg(aiId, "Image completed but no URL returned — try again."); }
          },
          onError: (err) => errorMsg(aiId,
            err.includes("key not set") ? "fal key not set — go to Settings → API Keys, paste your fal key, then Save." :
            err.includes("401") ? "fal key invalid — go to Settings → API Keys and re-enter your fal key." :
            err.includes("429") ? "fal rate limit — wait 30 seconds and try again." : err),
        });
        return;
      }

      if (openaiKey) {
        advancePhase(aiId, "image_submitting", "starting");
        try {
          const res = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST", signal: ctrl.signal,
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
            body: JSON.stringify({ model: "gpt-image-1", prompt: text, n: 1, size: "1024x1024", quality: "standard" }),
          });
          advancePhase(aiId, "image_generating", "generating");
          const data = await res.json() as { data?: Array<{ url?: string; b64_json?: string }>; error?: { message: string } };
          if (!res.ok || data.error) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
          const item = data.data?.[0];
          const url  = item?.url ?? (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : null);
          if (url) {
            advancePhase(aiId, "image_finalizing", "finalizing");
            setTimeout(() => {
              completeMedia(aiId, url, "image");
              if (!url.startsWith("data:"))
                void saveToLibrary({ type: "image", outputUrl: url, prompt: text, provider: "openai", model: "gpt-image-1" });
            }, 400);
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

    // ── VIDEO ─────────────────────────────────────────────────────────────────
    if (mode === "Video") {
      setMsgs(p => [...p, {
        id: aiId, role: "assistant", text: "",
        phase: "video_submitting",
        mediaStage: "starting",
        mediaKind: "video",
        streaming: true,
      }]);

      if (!falKey) { errorMsg(aiId, "fal key not set — go to Settings → API Keys, paste your fal key, then Save."); return; }

      const { submitDirectToFal, extractVideoUrl } = await import("@/lib/streams/fal-direct");
      await submitDirectToFal({
        endpoint: "fal-ai/kling-video/v3/standard/text-to-video",
        input:    { prompt: text, duration: "5", aspect_ratio: "16:9" },
        signal:   ctrl.signal,
        pollMs:   4000,
        maxPolls: 60,
        onProgress: (status) => {
          const isGenerating = status.includes("Progress") || status.includes("Generating");
          advancePhase(aiId,
            isGenerating ? "video_generating" : "video_queued",
            isGenerating ? "generating" : "queued"
          );
        },
        onDone: (raw) => {
          const url = extractVideoUrl(raw);
          if (url) {
            advancePhase(aiId, "video_finalizing", "finalizing");
            setTimeout(() => {
              completeMedia(aiId, url, "video");
              void saveToLibrary({ type: "video", outputUrl: url, prompt: text, provider: "fal", model: "kling-v3" });
            }, 400);
          } else { errorMsg(aiId, "Video completed but no URL returned — try again."); }
        },
        onError: (err) => errorMsg(aiId, err),
      });
      return;
    }

    // ── CHAT / BUILD — OpenAI direct stream with RAF buffer ──────────────────
    const isBuild = mode === "Build";
    // Immediately show ActivityConversation — no MediaGenerationStage for text
    setMsgs(p => [...p, {
      id: aiId, role: "assistant", text: "",
      phase: isBuild ? "build_starting" : "chat_thinking",
      streaming: true,
    }]);

    const history = msgs.slice(-12).map(m => ({ role: m.role as "user"|"assistant", content: m.text }));
    let firstDelta = true;

    if (isBuild) {
      // Advance build phases on timers while waiting for first token
      const t1 = setTimeout(() => advancePhase(aiId, "build_planning"), 700);
      const t2 = setTimeout(() => advancePhase(aiId, "build_writing"), 1600);
      const cleanTimers = () => { clearTimeout(t1); clearTimeout(t2); };

      await streamDirectFromOpenAI({
        message: `[Build mode] ${text}`,
        history,
        signal: ctrl.signal,
        onDelta: (delta) => {
          if (firstDelta) { firstDelta = false; cleanTimers(); startTokenFlush(aiId); }
          tokenBufRef.current += delta;
        },
        onDone: () => { cleanTimers(); finishMsg(aiId); },
        onError: (err) => { cleanTimers(); if (err.includes("aborted")) { finishMsg(aiId); return; } errorMsg(aiId, err); },
      });
    } else {
      // Chat: advance phase on timers while waiting
      const t1 = setTimeout(() => advancePhase(aiId, "chat_thinking"), 1400);
      const t2 = setTimeout(() => advancePhase(aiId, "chat_thinking"), 3000);
      const cleanTimers = () => { clearTimeout(t1); clearTimeout(t2); };

      await streamDirectFromOpenAI({
        message: text,
        history,
        signal: ctrl.signal,
        onDelta: (delta) => {
          if (firstDelta) { firstDelta = false; cleanTimers(); startTokenFlush(aiId); }
          tokenBufRef.current += delta;
        },
        onDone: () => { cleanTimers(); finishMsg(aiId); },
        onError: (err) => { cleanTimers(); if (err.includes("aborted")) { finishMsg(aiId); return; } errorMsg(aiId, err); },
      });
    }
  }

  function handleNewChat() {
    msgHistoryRef.current[activeSession] = msgs;
    const newId = crypto.randomUUID();
    msgHistoryRef.current[newId] = [];
    setSessions(prev => [{ id: newId, title: "New conversation", time: "now" }, ...prev.slice(0,9)]);
    setActiveSession(newId); setMsgs([]); setSidebarOpen(false);
  }

  const Sidebar = (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:CT.sbBg, overflow:"hidden" }}>
      <div style={{ padding:"16px 16px 12px", borderBottom:`1px solid ${CT.border}`, flexShrink:0 }}>
        <div style={{ fontSize:12, color:CT.t4, letterSpacing:".18em", textTransform:"uppercase", marginBottom:S.s3 }}>Streams</div>
        <button onClick={handleNewChat} style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"100%", padding:"9px 0", background:CT.send, border:"none", borderRadius:R.r2, color:"#fff", fontSize:14, fontFamily:"inherit", cursor:"pointer", minHeight:44 }}>+ New chat</button>
      </div>
      <nav aria-label="Sidebar navigation" style={{ padding:S.s2, borderBottom:`1px solid ${CT.border}`, flexShrink:0 }}>
        {(["Sessions","Library","Images"] as const).map(id => (
          <button key={id} onClick={() => { setActiveNav(id); if (id==="Library"||id==="Images") void loadLibrary(); }}
            style={{ display:"flex", alignItems:"center", width:"100%", padding:"8px 12px", background:activeNav===id?"rgba(0,0,0,0.06)":"transparent", border:"none", borderRadius:R.r1, color:activeNav===id?CT.t1:CT.t2, fontSize:14, fontFamily:"inherit", cursor:"pointer", textAlign:"left", minHeight:44 }}>{id}</button>
        ))}
      </nav>
      <div style={{ flex:1, overflowY:"auto" }}>
        <div style={{ padding:"12px 16px 4px", fontSize:12, color:CT.t4, letterSpacing:".1em", textTransform:"uppercase" }}>Recents</div>
        {activeNav==="Sessions" && sessions.map(s => (
          <button key={s.id} onClick={() => { msgHistoryRef.current[activeSession]=msgs; setActiveSession(s.id); setMsgs(msgHistoryRef.current[s.id]??[]); setSidebarOpen(false); }}
            style={{ display:"block", textAlign:"left", padding:"8px 16px", width:"100%", border:"none", background:s.id===activeSession?"rgba(0,0,0,0.06)":"transparent", color:s.id===activeSession?CT.t1:CT.t2, fontSize:14, fontFamily:"inherit", cursor:"pointer" }}>
            <div style={{ fontSize:13, marginBottom:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.title}</div>
            <div style={{ fontSize:12, color:CT.t4 }}>{s.time}</div>
          </button>
        ))}
        {(activeNav==="Library"||activeNav==="Images") && (
          <div style={{ padding:S.s2 }}>
            {libraryLoading && <div style={{ padding:"12px 8px", fontSize:14, color:CT.t4 }}>Loading…</div>}
            {!libraryLoading && library.length===0 && (
              <div style={{ padding:"12px 8px", fontSize:13, color:CT.t4 }}>{activeNav==="Images"?"No images yet":"No generations yet"}</div>
            )}
            {!libraryLoading && library.filter(i => activeNav==="Images"?i.generation_type==="image":true).map((item:LibraryItem) => {
              const icons: Record<string,string> = { video_t2v:"🎬",video_i2v:"🎬",image:"🖼",voice:"🎙",music:"🎵" };
              return (
                <div key={item.id} role="button" tabIndex={0}
                  onKeyDown={(e:React.KeyboardEvent) => { if(e.key==="Enter"||e.key===" ") setExpandedLib(expandedLib===item.id?null:item.id); }}
                  onClick={() => setExpandedLib(expandedLib===item.id?null:item.id)}
                  style={{ padding:S.s2, borderRadius:R.r1, marginBottom:S.s1, cursor:"pointer", border:`0.5px solid ${CT.border}`, background:"transparent" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:S.s2 }}>
                    <span style={{ fontSize:16, width:24, textAlign:"center", flexShrink:0 }}>{icons[item.generation_type]??"✦"}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:CT.t1, fontSize:13, textTransform:"capitalize", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.generation_type.replace("_"," ")}</div>
                      <div style={{ color:CT.t4, fontSize:12 }}>{new Date(item.created_at).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</div>
                    </div>
                  </div>
                  {item.output_url && expandedLib===item.id && (
                    <div style={{ borderRadius:R.r1, overflow:"hidden", marginTop:S.s2 }}>
                      <MediaPlayer src={item.output_url} kind={item.generation_type==="image"?"image":item.generation_type==="voice"||item.generation_type==="music"?"audio":"video"} aspectRatio={item.generation_type==="image"?"1/1":"16/9"} showDownload label={item.generation_type}/>
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
      <div onClick={() => setSidebarOpen(false)} aria-hidden="true" style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:299, opacity:sidebarOpen?1:0, pointerEvents:sidebarOpen?"auto":"none", transition:`opacity ${DUR.base} ${EASE}` }}/>

      {/* Lightbox */}
      {lightboxUrl && (
        <div role="dialog" aria-label="Image lightbox" aria-modal="true" onClick={() => setLightboxUrl(null)}
          style={{ position:"fixed", inset:0, zIndex:500, background:"rgba(0,0,0,0.9)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"zoom-out", padding:20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="Full size" onClick={e=>e.stopPropagation()} style={{ maxWidth:"100%", maxHeight:"90vh", borderRadius:R.r2, boxShadow:"0 24px 80px rgba(0,0,0,0.6)", cursor:"default" }}/>
          <button aria-label="Close lightbox" onClick={() => setLightboxUrl(null)}
            style={{ position:"absolute", top:20, right:20, width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.15)", border:"none", borderRadius:R.pill, color:"#fff", fontSize:20, cursor:"pointer" }}>×</button>
        </div>
      )}

      <div ref={inputContainerRef} style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:CT.bg }}>

        <div className="streams-chat-mhdr2" style={{ padding:"12px 16px", borderBottom:`1px solid ${CT.border}`, alignItems:"center", gap:S.s3 }}>
          <button aria-label="Open sidebar" onClick={() => setSidebarOpen(v=>!v)} style={{ background:"transparent", border:`1px solid ${CT.border}`, borderRadius:R.r1, color:CT.t2, cursor:"pointer", fontFamily:"inherit", minWidth:44, minHeight:44, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>☰</button>
          <span style={{ fontSize:15, color:CT.t1 }}>Streams</span>
        </div>

        {/* Messages */}
        <div role="log" aria-live="polite" aria-atomic="false" aria-label="Conversation messages"
          style={{ flex:1, overflowY:"auto", overscrollBehavior:"contain", paddingBottom:inputBarH+S.s4 }}>

          {msgs.length===0 && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60%", padding:"40px 32px", textAlign:"center" }}>
              <div style={{ fontSize:22, color:CT.t1, marginBottom:S.s2 }}>AI assistant</div>
              <div style={{ fontSize:15, color:CT.t3, lineHeight:1.6, maxWidth:360 }}>Generate images, videos, voice and code directly from conversation.</div>
            </div>
          )}

          {msgs.length>0 && (
            <div className="streams-chat-msgs2" style={{ maxWidth:820, margin:"0 auto", padding:"32px 32px 0", display:"flex", flexDirection:"column", gap:S.s5 }}>
              {msgs.map((msg:Msg) => (
                <div key={msg.id} style={{ display:"flex", flexDirection:"column", alignItems:msg.role==="user"?"flex-end":"flex-start" }}>

                  {msg.role==="assistant" && (
                    <div style={{ fontSize:12, letterSpacing:".14em", textTransform:"uppercase", color:CT.t4, marginBottom:S.s2 }}>STREAMS</div>
                  )}

                  {/* ── ActivityConversation — mounts immediately, hides on firstOutput ── */}
                  {msg.role==="assistant" && msg.phase && !msg.firstOutput && (
                    <ActivityConversation
                      phase={msg.phase}
                      userText={msgs.filter(m=>m.role==="user").slice(-1)[0]?.text}
                      mode={msg.mediaKind ? (msg.mediaKind as "image"|"video") : undefined}
                      active={msg.streaming}
                      firstOutputVisible={msg.firstOutput}
                    />
                  )}

                  {/* ── MediaGenerationStage — renders IN the message, exact spot where output appears ── */}
                  {msg.role==="assistant" && msg.mediaKind && msg.mediaStage && (
                    <div style={{ width:"100%", maxWidth:460, marginTop: msg.phase && !msg.firstOutput ? S.s3 : 0 }}>
                      <MediaGenerationStage
                        kind={msg.mediaKind}
                        state={msg.mediaStage}
                        outputUrl={msg.mediaUrl}
                        active={msg.streaming || msg.mediaStage === "complete"}
                      />
                    </div>
                  )}

                  {/* Text stream (chat/build) */}
                  {msg.text && (
                    <div style={{ maxWidth:msg.role==="user"?"72%":"100%", color:CT.t1, fontSize:16, lineHeight:1.75, overflowWrap:"break-word", textAlign:msg.role==="user"?"right":"left", whiteSpace:"pre-wrap" }}>
                      {msg.text}
                      {msg.streaming && msg.text && (
                        <span style={{ display:"inline-block", width:2, height:16, background:CT.t1, borderRadius:1, marginLeft:2, verticalAlign:"text-bottom", animation:"streams-blink2 0.8s ease infinite" }}/>
                      )}
                    </div>
                  )}

                  {/* Completed image (if mediaStage=complete but using legacy MediaPlayer for lightbox) */}
                  {msg.role==="assistant" && msg.mediaUrl && msg.mediaKind==="image" && msg.mediaStage==="complete" && (
                    <div
                      role="button" aria-label="View full size" tabIndex={0}
                      onClick={() => setLightboxUrl(msg.mediaUrl!)}
                      onKeyDown={(e:React.KeyboardEvent) => { if(e.key==="Enter"||e.key===" ") setLightboxUrl(msg.mediaUrl!); }}
                      style={{ cursor:"zoom-in", borderRadius:R.r2, overflow:"hidden", display:"inline-block", maxWidth:400, width:"100%", boxShadow:"0 4px 20px rgba(0,0,0,0.10)", marginTop:-4 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={msg.mediaUrl} alt="Generated" style={{ width:"100%", height:"auto", display:"block" }}/>
                      <div style={{ padding:"5px 10px", background:"rgba(0,0,0,0.04)", fontSize:12, color:CT.t4, display:"flex", gap:8 }}>
                        <span>🔍 Enlarge</span>
                        <a href={msg.mediaUrl} download onClick={e=>e.stopPropagation()} style={{ color:CT.send, textDecoration:"none" }}>↓ Download</a>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={endRef} style={{ height:1 }}/>
            </div>
          )}
        </div>

        {/* Input */}
        <div ref={inputAreaRef} className="streams-chat-input2" style={{ borderTop:`1px solid ${CT.border}`, background:CT.bg, flexShrink:0, padding:"16px 24px", paddingBottom:"calc(20px + env(safe-area-inset-bottom))" }}>
          <div style={{ maxWidth:820, margin:"0 auto" }}>
            {attachMode && (
              <div style={{ display:"flex", gap:S.s2, marginBottom:S.s2 }}>
                <input value={attachUrl} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setAttachUrl(e.target.value)} placeholder="Paste image or video URL…"
                  style={{ flex:1, background:"#f4f4f5", border:"none", borderRadius:R.r2, padding:"8px 12px", color:CT.t1, fontSize:16, fontFamily:"inherit", outline:"none" }}
                  onKeyDown={(e:React.KeyboardEvent<HTMLInputElement>)=>{ if(e.key==="Enter"&&attachUrl.trim()){setInput(p=>p+(p?" ":"")+attachUrl.trim());setAttachUrl("");setAttachMode(false);} if(e.key==="Escape") setAttachMode(false); }}/>
                <button onClick={()=>{setInput(p=>p+(p?" ":"")+attachUrl.trim());setAttachUrl("");setAttachMode(false);}} style={{ padding:"8px 16px", borderRadius:R.r2, background:CT.send, border:"none", color:"#fff", fontSize:14, fontFamily:"inherit", cursor:"pointer", minHeight:44 }}>Attach</button>
              </div>
            )}
            <div className="streams-chat-chips2" style={{ display:"flex", gap:S.s2, marginBottom:S.s3, overflowX:"auto", scrollbarWidth:"none" as React.CSSProperties["scrollbarWidth"] }}>
              {(["Chat","Image","Video","Build"] as Mode[]).map(m=>(
                <button key={m} onClick={()=>setMode(m)} style={{ padding:"6px 14px", borderRadius:R.pill, border:`1px solid ${mode===m?CT.chipActive:CT.chipBorder}`, background:mode===m?CT.chipActive:"transparent", color:mode===m?"#fff":CT.t2, fontSize:13, fontFamily:"inherit", cursor:"pointer", flexShrink:0, minHeight:32, transition:`background ${DUR.fast} ${EASE}, border-color ${DUR.fast} ${EASE}, color ${DUR.fast} ${EASE}` }}>{m}</button>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:S.s2 }}>
              <button aria-label="Attach URL" onClick={()=>setAttachMode(v=>!v)} style={{ width:44, height:44, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:attachMode?"rgba(217,91,42,0.08)":"transparent", border:`1px solid ${attachMode?CT.send:CT.chipBorder}`, borderRadius:R.r2, color:attachMode?CT.send:CT.t3, fontSize:18, cursor:"pointer" }}>⊕</button>
              <div style={{ flex:1, border:`2px solid ${inputFocused?CT.inputFocus:CT.inputBorder}`, borderRadius:24, padding:"12px 16px", background:CT.bg, transition:`border-color ${DUR.fast} ${EASE}` }}>
                <textarea ref={textareaRef} value={input} maxLength={2000} aria-label="Message input" aria-multiline="true"
                  onFocus={()=>setInputFocused(true)} onBlur={()=>setInputFocused(false)}
                  onChange={(e:React.ChangeEvent<HTMLTextAreaElement>)=>{ setInput(e.target.value); e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,160)+"px"; }}
                  onKeyDown={(e:React.KeyboardEvent<HTMLTextAreaElement>)=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void handleSend();} }}
                  placeholder={`Message Streams — ${mode} mode`} rows={1}
                  style={{ width:"100%", background:"transparent", border:"none", outline:"none", fontFamily:"inherit", fontSize:16, color:CT.t1, resize:"none", lineHeight:1.5, minHeight:24 }}/>
              </div>
              {streaming?(
                <button onClick={handleStop} aria-label="Stop generation" style={{ width:44,height:44,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"transparent",border:`2px solid ${CT.chipBorder}`,borderRadius:R.pill,color:CT.t2,cursor:"pointer",fontSize:14 }}>■</button>
              ):(
                <button onClick={()=>void handleSend()} disabled={!input.trim()} aria-label="Send message" style={{ width:44,height:44,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:input.trim()?CT.send:"#e4e4e7",border:"none",borderRadius:R.pill,color:"#fff",cursor:input.trim()?"pointer":"not-allowed",fontSize:20,transition:`background ${DUR.fast} ${EASE}` }}>↑</button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes streams-blink2 { 0%,100%{opacity:1} 50%{opacity:0} }
        .streams-chat-chips2::-webkit-scrollbar { display:none; }
        .streams-chat-sb2 { position:fixed;top:0;left:0;height:100dvh;width:260px;z-index:300;transform:translateX(-100%);transition:transform ${DUR.base} ${EASE};border-right:1px solid rgba(0,0,0,0.08); }
        .streams-chat-sb2.open { transform:translateX(0); }
        .streams-chat-mhdr2 { display:none; }
        @media (max-width:767px) {
          .streams-chat-mhdr2 { display:flex; }
          .streams-chat-msgs2 { padding:20px 16px 0; }
          .streams-chat-input2 { padding:12px 16px;padding-bottom:calc(16px + env(safe-area-inset-bottom)); }
        }
        @media (min-width:768px) {
          .streams-chat-sb2 { position:relative;height:100%;transform:none;transition:none;z-index:auto;flex-shrink:0; }
          .streams-chat-sb2.open { transform:none; }
        }
      `}</style>
    </div>
  );
}
