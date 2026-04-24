"use client";

/**
 * ChatTab — claude.ai-style light theme.
 * Rule 4.1: no bubbles — user = right-aligned plain text, zero bg.
 * Rule 4.2: no AI cards — bare text on white, "STREAMS" label.
 * Rule 4.3: no avatars.
 * Rule 2.1: sidebarOpen consumed in className expression.
 * Rule 2.2: drawer = transform/overlay pattern.
 * Rule 3.1: visualViewport listener on inputContainerRef.
 * Rule 3.2: paddingBottom measured via ResizeObserver on inputAreaRef.
 * Rule 1.5: safe-area-inset-bottom on input.
 * CSS.1: zero !important — mobile header via CSS class, focus via inputFocused state.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import MediaPlayer from "../VideoPlayer";
import { R, S, DUR, EASE } from "../tokens";
import { streamDirectFromOpenAI } from "@/lib/streams/openai-direct";

// ── Claude-style light theme tokens ─────────────────────────────────────────
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
  send:        "#d95b2a",   // claude.ai orange
  inputBorder: "#d4d4d8",
  inputFocus:  "#a1a1aa",
} as const;

type Mode    = "Chat" | "Image" | "Video" | "Build";
type MsgRole = "user" | "assistant";

interface Msg {
  id: string; role: MsgRole; text: string;
  mediaUrl?: string; mediaType?: "image" | "video"; streaming?: boolean;
}
type Session     = { id: string; title: string; time: string };
type LibraryItem = { id: string; generation_type: string; output_url: string; created_at: string; cost_usd?: number | null };

export default function ChatTab() {
  const [msgs,          setMsgs]         = useState<Msg[]>([]);
  const [input,         setInput]        = useState("");
  const [mode,          setMode]         = useState<Mode>("Chat");
  const [streaming,     setStreaming]    = useState(false);
  const [sidebarOpen,   setSidebarOpen]  = useState(false);
  const [activeNav,     setActiveNav]    = useState<"Sessions"|"Library"|"Images">("Sessions");
  const [convId,        setConvId]       = useState(() => crypto.randomUUID());
  const [sessions,      setSessions]     = useState<Session[]>([{ id: "current", title: "New conversation", time: "now" }]);
  const [activeSession, setActiveSession] = useState("current");
  const msgHistoryRef  = useRef<Record<string, Msg[]>>({ current: [] });
  const [library,       setLibrary]      = useState<LibraryItem[]>([]);
  const [libraryLoading, setLibLoad]     = useState(false);
  const [expandedLib,   setExpandedLib]  = useState<string|null>(null);
  const [attachMode,    setAttachMode]   = useState(false);
  const [attachUrl,     setAttachUrl]    = useState("");
  const [inputFocused,  setInputFocused] = useState(false);
  const [inputBarH,     setInputBarH]    = useState(0);

  const endRef            = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef      = useRef<HTMLDivElement>(null);
  const textareaRef       = useRef<HTMLTextAreaElement>(null);

  // Rule 3.2 — measure input bar for paddingBottom
  useEffect(() => {
    const el = inputAreaRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setInputBarH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Rule 3.1 — stay above iOS keyboard
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

  const loadLibrary = useCallback(async () => {
    if (libraryLoading) return;
    setLibLoad(true);
    try {
      const res = await fetch("/api/streams/library?limit=20", { credentials: "include" });
      if (res.ok) { const j = await res.json() as { data?: LibraryItem[] }; setLibrary(j.data ?? []); }
    } catch { /* empty state */ } finally { setLibLoad(false); }
  }, [libraryLoading]);

  // ── Send message ─────────────────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Msg = { id: Date.now().toString(), role: "user", text };
    setMsgs(p => [...p, userMsg]);
    setSessions(prev => prev.map(s =>
      s.id === activeSession && s.title === "New conversation"
        ? { ...s, title: text.slice(0, 36) + (text.length > 36 ? "…" : "") } : s));
    setInput(""); setStreaming(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const aiId = (Date.now() + 1).toString();

    // ── Image mode — generate image directly, show inline ──────────────────
    if (mode === "Image") {
      setMsgs(p => [...p, { id: aiId, role: "assistant", text: "Generating image…", streaming: true }]);

      const { getProviderKey } = await import("@/lib/streams/provider-keys");
      const { submitDirectToFal, extractImageUrl } = await import("@/lib/streams/fal-direct");
      const falKey = getProviderKey("fal");
      const openaiKey = getProviderKey("openai");

      if (falKey) {
        // fal FLUX — fastest, best quality
        await submitDirectToFal({
          endpoint: "fal-ai/flux-pro/kontext/text-to-image",
          input:    { prompt: text, aspect_ratio: "1:1" },
          onProgress: (status) => {
            setMsgs(p => p.map(m => m.id === aiId ? { ...m, text: status } : m));
          },
          onDone: (raw) => {
            const url = extractImageUrl(raw);
            if (url) {
              setMsgs(p => p.map(m => m.id === aiId
                ? { ...m, text: "", mediaUrl: url, mediaType: "image" as const, streaming: false }
                : m));
            } else {
              setMsgs(p => p.map(m => m.id === aiId
                ? { ...m, text: "Image generated but URL could not be read.", streaming: false }
                : m));
            }
            setStreaming(false);
          },
          onError: (err) => {
            setMsgs(p => p.map(m => m.id === aiId ? { ...m, text: err, streaming: false } : m));
            setStreaming(false);
          },
        });
        return;
      }

      if (openaiKey) {
        // OpenAI gpt-image-1 — direct from browser
        try {
          const res = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
              "Content-Type":  "application/json",
              "Authorization": `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model:   "gpt-image-1",
              prompt:  text,
              n:       1,
              size:    "1024x1024",
              quality: "standard",
            }),
          });
          const data = await res.json() as {
            data?: Array<{ url?: string; b64_json?: string }>;
            error?: { message: string };
          };
          if (!res.ok || data.error) {
            throw new Error(data.error?.message ?? `HTTP ${res.status}`);
          }
          const item = data.data?.[0];
          const url  = item?.url ?? (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : null);
          if (url) {
            setMsgs(p => p.map(m => m.id === aiId
              ? { ...m, text: "", mediaUrl: url, mediaType: "image" as const, streaming: false }
              : m));
          } else {
            setMsgs(p => p.map(m => m.id === aiId
              ? { ...m, text: "Image generated but no URL returned.", streaming: false }
              : m));
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Image generation failed";
          setMsgs(p => p.map(m => m.id === aiId ? { ...m, text: msg, streaming: false } : m));
        } finally {
          setStreaming(false);
        }
        return;
      }

      // No key set
      setMsgs(p => p.map(m => m.id === aiId
        ? { ...m, text: "No image key set — go to Settings → API Keys and add a fal or OpenAI key.", streaming: false }
        : m));
      setStreaming(false);
      return;
    }

    // ── Chat / Build mode — stream text from OpenAI directly ───────────────
    setMsgs(p => [...p, { id: aiId, role: "assistant", text: "", streaming: true }]);

    const history = msgs.slice(-12).map(m => ({
      role:    m.role as "user" | "assistant",
      content: m.text,
    }));

    await streamDirectFromOpenAI({
      message: text,
      history,
      onDelta: (delta) => {
        setMsgs(p => p.map(m => m.id === aiId ? { ...m, text: m.text + delta } : m));
      },
      onDone: () => {
        setMsgs(p => p.map(m => m.id === aiId ? { ...m, streaming: false } : m));
        setStreaming(false);
      },
      onError: (err) => {
        setMsgs(p => p.map(m => m.id === aiId ? { ...m, text: err, streaming: false } : m));
        setStreaming(false);
      },
    });
  }

  function handleNewChat() {
    msgHistoryRef.current[activeSession] = msgs;
    const newId = crypto.randomUUID();
    msgHistoryRef.current[newId] = [];
    setSessions(prev => [{ id: newId, title: "New conversation", time: "now" }, ...prev.slice(0,9)]);
    setActiveSession(newId); setMsgs([]); setConvId(newId); setSidebarOpen(false);
  }

  const Sidebar = (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:CT.sbBg, overflow:"hidden" }}>
      {/* Brand */}
      <div style={{ padding:"16px 16px 12px", borderBottom:`1px solid ${CT.border}`, flexShrink:0 }}>
        <div style={{ fontSize:12, fontWeight:500, color:CT.t4, letterSpacing:".18em", textTransform:"uppercase", marginBottom:S.s3 }}>Streams</div>
        <button onClick={handleNewChat} style={{
          display:"flex", alignItems:"center", justifyContent:"center", gap:S.s2,
          width:"100%", padding:"9px 0", background:CT.send, border:"none",
          borderRadius:R.r2, color:"#fff", fontSize:14, fontWeight:500,
          fontFamily:"inherit", cursor:"pointer", minHeight:44,
        }}>+ New chat</button>
      </div>

      {/* Nav */}
      <nav aria-label="Sidebar navigation" style={{ padding:S.s2, borderBottom:`1px solid ${CT.border}`, flexShrink:0 }}>
        {(["Sessions","Library","Images"] as const).map(id => (
          <button key={id} onClick={() => { setActiveNav(id); if (id==="Library"||id==="Images") void loadLibrary(); }}
            style={{
              display:"flex", alignItems:"center", gap:S.s3,
              width:"100%", padding:"8px 12px",
              background:activeNav===id?"rgba(0,0,0,0.06)":"transparent",
              border:"none", borderRadius:R.r1,
              color:activeNav===id?CT.t1:CT.t2, fontSize:14,
              fontFamily:"inherit", cursor:"pointer", textAlign:"left", minHeight:44,
            }}>{id}</button>
        ))}
      </nav>

      {/* Recents */}
      <div style={{ flex:1, overflowY:"auto" }}>
        <div style={{ padding:"12px 16px 4px", fontSize:12, fontWeight:500, color:CT.t4, letterSpacing:".1em", textTransform:"uppercase" }}>Recents</div>

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
                {activeNav==="Images"?"No images yet — generate in the Generate tab":"No generations yet"}
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
                        <div style={{ color:CT.t1, fontSize:13, fontWeight:500, textTransform:"capitalize", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
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

      {/* Sidebar — Rule 2.1: sidebarOpen consumed in className */}
      <div className={`streams-chat-sb2${sidebarOpen?" open":""}`}>{Sidebar}</div>

      {/* Rule 2.2 — mobile overlay */}
      <div onClick={() => setSidebarOpen(false)} aria-hidden="true" style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:299,
        opacity:sidebarOpen?1:0, pointerEvents:sidebarOpen?"auto":"none",
        transition:`opacity ${DUR.base} ${EASE}`,
      }}/>

      {/* Main */}
      <div ref={inputContainerRef} style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:CT.bg }}>

        {/* Mobile header — visibility via CSS class only, no inline display/!important */}
        <div className="streams-chat-mhdr2" style={{
          padding:"12px 16px", borderBottom:`1px solid ${CT.border}`,
          alignItems:"center", gap:S.s3,
        }}>
          <button aria-label="Open sidebar" onClick={() => setSidebarOpen(v=>!v)} style={{
            background:"transparent", border:`1px solid ${CT.border}`,
            borderRadius:R.r1, color:CT.t2, cursor:"pointer", fontFamily:"inherit",
            minWidth:44, minHeight:44, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
          }}>☰</button>
          <span style={{ fontSize:15, color:CT.t1, fontWeight:500 }}>Streams</span>
        </div>

        {/* Messages */}
        <div role="log" aria-live="polite" aria-atomic="false" aria-label="Conversation messages"
          style={{ flex:1, overflowY:"auto", overscrollBehavior:"contain", paddingBottom:inputBarH+S.s4 }}>

          {/* Empty state */}
          {msgs.length===0 && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60%", padding:"40px 32px", textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:500, color:CT.t1, marginBottom:S.s2 }}>AI assistant</div>
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

                  {/* Rule 4.3: no avatar. AI label only. */}
                  {msg.role==="assistant" && (
                    <div style={{ fontSize:12, fontWeight:500, letterSpacing:".14em", textTransform:"uppercase", color:CT.t4, marginBottom:S.s2, lineHeight:1.4 }}>
                      STREAMS
                    </div>
                  )}

                  {/* Rule 4.1+4.2: zero background on both roles */}
                  <div style={{
                    maxWidth:msg.role==="user"?"72%":"100%",
                    color:CT.t1, fontSize:16, lineHeight:1.75,
                    overflowWrap:"break-word",
                    textAlign:msg.role==="user"?"right":"left",
                  }}>
                    {msg.text}
                    {msg.streaming && (
                      <span style={{
                        display:"inline-block", width:4, height:14,
                        background:CT.t4, borderRadius:2, marginLeft:3,
                        verticalAlign:"text-bottom",
                        animation:"streams-blink2 1s ease infinite",
                      }}/>
                    )}
                  </div>

                  {msg.role==="assistant" && msg.mediaUrl && (
                    <div style={{ width:"100%", maxWidth:360, marginTop:S.s2 }}>
                      <MediaPlayer src={msg.mediaUrl}
                        kind={msg.mediaType==="video"?"video":"image"}
                        aspectRatio={msg.mediaType==="video"?"16/9":"1/1"}
                        showDownload label="Generated"/>
                    </div>
                  )}
                </div>
              ))}
              <div ref={endRef} style={{ height:1 }}/>
            </div>
          )}
        </div>

        {/* Input area */}
        <div ref={inputAreaRef} className="streams-chat-input2" style={{
          borderTop:`1px solid ${CT.border}`, background:CT.bg, flexShrink:0,
          padding:"16px 24px",
          paddingBottom:"calc(20px + env(safe-area-inset-bottom))",
        }}>
          <div style={{ maxWidth:820, margin:"0 auto" }}>

            {/* Attach URL row */}
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

            {/* Mode chips */}
            <div className="streams-chat-chips2" style={{ display:"flex", gap:S.s2, marginBottom:S.s3, overflowX:"auto", scrollbarWidth:"none" as React.CSSProperties["scrollbarWidth"] }}>
              {(["Chat","Image","Video","Build"] as Mode[]).map(m=>(
                <button key={m} onClick={()=>setMode(m)} style={{
                  padding:"6px 14px", borderRadius:R.pill,
                  border:`1px solid ${mode===m?CT.chipActive:CT.chipBorder}`,
                  background:mode===m?CT.chipActive:"transparent",
                  color:mode===m?"#fff":CT.t2,
                  fontSize:13, fontWeight:500, fontFamily:"inherit", cursor:"pointer",
                  flexShrink:0, minHeight:32,
                  transition:`background ${DUR.fast} ${EASE}, border-color ${DUR.fast} ${EASE}, color ${DUR.fast} ${EASE}`,
                }}>{m}</button>
              ))}
            </div>

            {/* Input row */}
            <div style={{ display:"flex", alignItems:"flex-end", gap:S.s2 }}>

              {/* Attach button */}
              <button aria-label="Attach URL" title="Attach URL" onClick={()=>setAttachMode(v=>!v)} style={{
                width:44, height:44, flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                background:attachMode?"rgba(217,91,42,0.08)":"transparent",
                border:`1px solid ${attachMode?CT.send:CT.chipBorder}`,
                borderRadius:R.r2, color:attachMode?CT.send:CT.t3, fontSize:18, cursor:"pointer",
              }}>⊕</button>

              {/* Textarea wrapper — focus border via inputFocused state (no !important) */}
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

              {/* Send (orange circle ↑) / Stop (■) */}
              {streaming?(
                <button onClick={()=>{setMsgs(p=>p.map(m=>m.streaming?{...m,streaming:false}:m));setStreaming(false);}}
                  aria-label="Stop generation" style={{
                    width:44,height:44,flexShrink:0,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    background:"transparent", border:`2px solid ${CT.chipBorder}`,
                    borderRadius:R.pill, color:CT.t2, cursor:"pointer", fontSize:14,
                  }}>■</button>
              ):(
                <button onClick={()=>void handleSend()} disabled={!input.trim()}
                  aria-label="Send message" style={{
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
        @keyframes streams-blink2 { 0%,100%{opacity:1} 50%{opacity:0} }
        .streams-chat-chips2::-webkit-scrollbar { display:none; }

        /* Sidebar: fixed drawer on mobile, inline on desktop */
        .streams-chat-sb2 {
          position:fixed; top:0; left:0;
          height:100dvh; width:260px; z-index:300;
          transform:translateX(-100%);
          transition:transform ${DUR.base} ${EASE};
          border-right:1px solid rgba(0,0,0,0.08);
        }
        .streams-chat-sb2.open { transform:translateX(0); }

        /* Mobile header hidden on desktop, shown on mobile */
        .streams-chat-mhdr2 { display:none; }

        @media (max-width:767px) {
          .streams-chat-mhdr2 { display:flex; }
          .streams-chat-msgs2 { padding:20px 16px 0; }
          .streams-chat-input2 { padding:12px 16px; padding-bottom:calc(16px + env(safe-area-inset-bottom)); }
        }

        @media (min-width:768px) {
          .streams-chat-sb2 {
            position:relative; height:100%;
            transform:none; transition:none;
            z-index:auto; flex-shrink:0;
          }
          .streams-chat-sb2.open { transform:none; }
        }
      `}</style>
    </div>
  );
}
