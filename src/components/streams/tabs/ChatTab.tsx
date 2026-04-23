"use client";

/**
 * ChatTab — AI assistant interface.
 * Mobile-first: sidebar hidden on mobile, bottom sheet pattern.
 * SSE stream correctly parsed (event: name + data: JSON).
 * No backend calls in shell — all state managed locally.
 * Backend: POST /api/ai-assistant (existing route, called as HTTP endpoint)
 */

import { useState, useRef, useEffect } from "react";
import { C, R, S, DUR, EASE } from "../tokens";

type Mode = "Chat" | "Image" | "Video" | "Build";
type MsgRole = "user" | "assistant";

interface Msg {
  id: string;
  role: MsgRole;
  text: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  streaming?: boolean;
}

const SEED_MSGS: Msg[] = [
  { id: "m1", role: "user",      text: "generate an image of a lady walking in the city" },
  { id: "m2", role: "assistant", text: "A cinematic street scene — warm golden hour, a woman in motion against a blur of city life. Generated at full resolution.", mediaUrl: "placeholder", mediaType: "image" as const },
  { id: "m3", role: "user",      text: "make her outfit more formal" },
  { id: "m4", role: "assistant", text: "Updated — sharp blazer, tailored trousers. Same motion, same light, same city energy." },
];

type LibraryItem = { id: string; generation_type: string; output_url: string; created_at: string };

export default function ChatTab() {
  const [msgs,      setMsgs]      = useState<Msg[]>(SEED_MSGS);
  const [input,     setInput]     = useState("");
  const [mode,      setMode]      = useState<Mode>("Chat");
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen,  setSidebar]     = useState(false);
  const [activeNav,    setActiveNav]   = useState("Sessions");
  const [convId,       setConvId]      = useState(() => crypto.randomUUID());
  // ── Session history ──────────────────────────────────────────────────
  type Session = { id: string; title: string; time: string };
  const [sessions,      setSessions]    = useState<Session[]>([
    { id: "current", title: "New conversation", time: "now" },
  ]);
  const [activeSession, setActiveSession] = useState("current");

  const [library,      setLibrary]     = useState<LibraryItem[]>([]);
  const [libraryLoading, setLibLoad]  = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Msg = { id: Date.now().toString(), role: "user", text };
    setMsgs((p: Msg[]) => [...p, userMsg]);
    // Update session title from first user message
    setSessions((prev: Session[]) => prev.map((s: Session) =>
      s.id === activeSession && s.title === "New conversation"
        ? { ...s, title: text.slice(0, 36) + (text.length > 36 ? "…" : "") }
        : s
    ));
    setInput("");
    setStreaming(true);

    const aiId = (Date.now() + 1).toString();
    setMsgs((p: Msg[]) => [...p, { id: aiId, role: "assistant", text: "", streaming: true }]);

    try {
      const res = await fetch("/api/ai-assistant", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: text, mode: mode.toLowerCase(), conversationId: convId }),
      });

      if (!res.ok || !res.body) {
        setMsgs((p: Msg[]) => p.map((m: Msg) => m.id === aiId
          ? { ...m, text: "Error connecting to assistant.", streaming: false } : m));
        setStreaming(false);
        return;
      }

      // Parse SSE stream — orchestrator format:
      //   event: text_delta + data: {"delta":"..."}
      //   event: media      + data: {"kind":"image","url":"..."}
      //   event: done       + data: {...}
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const lines     = chunk.split("\n");
          const eventLine = lines.find(l => l.startsWith("event:"));
          const dataLine  = lines.find(l => l.startsWith("data:"));
          if (!dataLine) continue;

          const eventName = eventLine?.replace("event:", "").trim() ?? "message";
          let payload: Record<string, unknown> = {};
          try { payload = JSON.parse(dataLine.replace("data:", "").trim()); } catch { continue; }

          if (eventName === "text_delta") {
            const delta = String(payload.delta ?? "");
            setMsgs((p: Msg[]) => p.map((m: Msg) =>
              m.id === aiId ? { ...m, text: m.text + delta } : m));
          } else if (eventName === "media") {
            const mediaUrl  = String(payload.url  ?? "");
            const mediaType = String(payload.kind ?? "image") as "image" | "video";
            setMsgs((p: Msg[]) => p.map((m: Msg) =>
              m.id === aiId ? { ...m, mediaUrl, mediaType } : m));
          } else if (eventName === "done") {
            setMsgs((p: Msg[]) => p.map((m: Msg) =>
              m.id === aiId ? { ...m, streaming: false } : m));
            setStreaming(false);
          }
        }
      }
      setMsgs((p: Msg[]) => p.map((m: Msg) =>
        m.id === aiId ? { ...m, streaming: false } : m));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Connection error";
      setMsgs((p: Msg[]) => p.map((m: Msg) =>
        m.id === aiId ? { ...m, text: errMsg, streaming: false } : m));
    } finally {
      setStreaming(false);
    }
  }

  const Sidebar = (
    <div style={{
      width:        260,
      flexShrink:   0,
      borderRight:  `1px solid ${C.bdr}`,
      background:   C.bg,
      display:      "flex",
      flexDirection:"column",
      overflow:     "hidden",
    }}>
      {/* Brand + New */}
      <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${C.bdr}` }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", fontSize: 16, color: C.t1, marginBottom: 4 }}>Streams</div>
        <div style={{ fontSize: 13, color: C.t4, marginBottom: 12 }}>New conversation</div>
        <button
          onClick={() => {
            const newId = crypto.randomUUID();
            const newSession: Session = { id: newId, title: "New conversation", time: "now" };
            setSessions((prev: Session[]) => [newSession, ...prev.slice(0, 9)]);
            setActiveSession(newId);
            setMsgs(SEED_MSGS);
            setConvId(newId);
          }}
          style={{
            width: "100%", padding: "8px 0", borderRadius: R.r1,
            background: C.acc, border: "none", color: "#fff",
            fontSize: 14, fontFamily: "inherit", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <span style={{ fontSize: 14 }}>+</span> New chat
        </button>
      </div>

      {/* Nav */}
      {[
        { icon: "◎", label: "Sessions" },
        { icon: "▤", label: "Library"  },
        { icon: "⊞", label: "Images"   },
      ].map(nav => (
        <button key={nav.label} onClick={() => {
                setActiveNav(nav.label);
                if (nav.label === "Library" && library.length === 0) {
                  setLibLoad(true);
                  fetch("/api/streams/library?limit=20")
                    .then(r => r.json())
                    .then((d: { items?: LibraryItem[] }) => { setLibrary(d.items ?? []); setLibLoad(false); })
                    .catch(() => setLibLoad(false));
                }
              }} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 16px", border: "none",
          background: activeNav === nav.label ? C.surf2 : "transparent",
          color: activeNav === nav.label ? C.t1 : C.t3,
          fontSize: 15, fontFamily: "inherit", cursor: "pointer",
          width: "100%", textAlign: "left",
          borderLeft: activeNav === nav.label ? `2px solid ${C.acc}` : "2px solid transparent",
        }}>
          <span>{nav.icon}</span> {nav.label}
        </button>
      ))}

      {/* Recents */}
      <div style={{ padding: "8px 16px 4px", fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase" }}>Recents</div>
      {activeNav === "Sessions" && sessions.map((s: Session) => (
        <button key={s.id} onClick={() => setActiveSession(s.id)} style={{
          display: "block", textAlign: "left", padding: "8px 16px",
          border: "none", background: s.id === activeSession ? C.surf2 : "transparent",
          color: s.id === activeSession ? C.t1 : C.t3, fontSize: 14, fontFamily: "inherit",
          cursor: "pointer", width: "100%",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          borderLeft: s.id === activeSession ? `2px solid ${C.acc}` : "2px solid transparent",
        }}>
          <div style={{ fontSize: 13, marginBottom: 1 }}>{s.title}</div>
          <div style={{ fontSize: 12, color: C.t4 }}>{s.time}</div>
        </button>
      ))}
      {activeNav === "Library" && (
        <div style={{ padding: "0 8px" }}>
          {libraryLoading && <div style={{ padding: "12px 8px", fontSize: 13, color: C.t4 }}>Loading…</div>}
          {!libraryLoading && library.length === 0 && <div style={{ padding: "12px 8px", fontSize: 13, color: C.t4 }}>No generations yet</div>}
          {library.map((item: LibraryItem) => {
            const typeIcon: Record<string, string> = {
              video_t2v: "🎬", video_i2v: "🎬", image: "🖼", voice: "🎙", music: "🎵",
            };
            const icon = typeIcon[item.generation_type] ?? "✦";
            const hasOutput = !!item.output_url;
            return (
              <div key={item.id} style={{
                padding: "8px 8px", borderRadius: R.r1, marginBottom: 5, cursor: "pointer",
                background: C.surf, border: `1px solid ${C.bdr}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Type icon or video thumbnail placeholder */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 6, flexShrink: 0,
                    background: hasOutput ? C.bg4 : C.bg3,
                    border: `1px solid ${C.bdr}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16,
                  }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.acc2, fontSize: 12, fontWeight: 500, textTransform: "capitalize" }}>
                      {item.generation_type.replace("_", " ")}
                    </div>
                    <div style={{ color: C.t4, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {new Date(item.created_at).toLocaleDateString(undefined, { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                    </div>
                  </div>
                  {hasOutput && (
                    <a href={item.output_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: C.t4, textDecoration: "none", flexShrink: 0 }}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >↗</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* Sidebar — desktop */}
      <div className="streams-chat-sidebar">{Sidebar}</div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* AI assistant header — badge + title + subtitle */}
        <div style={{ padding: "16px 32px 0", flexShrink: 0 }} className="streams-chat-header">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "3px 8px", borderRadius: R.pill, border: `1px solid ${C.accBr}`, background: C.accDim, fontSize: 13, color: C.acc2, marginBottom: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: R.pill, background: C.acc2, display: "inline-block" }} />
            Chat · image · video · build
          </div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: C.t1, marginBottom: 4 }}>AI assistant</div>
          <div style={{ fontSize: 14, color: C.t3, marginBottom: 12, lineHeight: 1.5 }}>Generate images, videos, voice and code directly from conversation.</div>
        </div>

        {/* Mobile top bar */}
        <div className="streams-chat-mobile-bar" style={{
          display: "none", padding: "8px 16px",
          borderBottom: `1px solid ${C.bdr}`,
          alignItems: "center", gap: 10,
        }}>
          <button onClick={() => setSidebar(!sidebarOpen)} style={{
            background: "transparent", border: `1px solid ${C.bdr}`,
            borderRadius: R.r1, padding: "6px 8px", color: C.t3,
            fontSize: 15, cursor: "pointer", fontFamily: "inherit",
          }}>☰</button>
          <span style={{ fontSize: 14, color: C.t3 }}>New conversation</span>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: "auto",
          padding: "24px 32px",
          display: "flex", flexDirection: "column", gap: 20,
        }} className="streams-chat-msgs">
          {msgs.map((msg: Msg) => (
            <div key={msg.id} style={{
              display: "flex",
              flexDirection: msg.role === "user" ? "row-reverse" : "row",
              gap: 10, maxWidth: 680,
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            }}>
              {/* Avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: R.pill, flexShrink: 0,
                background: msg.role === "user" ? C.bg4 : C.acc,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 600, color: "#fff",
                border: msg.role === "user" ? `1px solid ${C.bdr}` : "none",
              }}>
                {msg.role === "user" ? "U" : "S"}
              </div>

              <div>
                {msg.role === "assistant" && (
                  <div style={{ fontSize: 13, color: C.t4, marginBottom: 4, letterSpacing: ".04em" }}>
                    Streams, now
                  </div>
                )}
                <div style={{
                  padding: "8px 16px",
                  borderRadius: msg.role === "user" ? `${R.r2}px 4px ${R.r2}px ${R.r2}px` : `4px ${R.r2}px ${R.r2}px ${R.r2}px`,
                  background: msg.role === "user" ? C.acc : C.surf,
                  border: msg.role === "user" ? "none" : `1px solid ${C.bdr}`,
                  color: C.t1, fontSize: 16, lineHeight: 1.65,
                }}>
                  {msg.text}
                  {msg.streaming && (
                    <span style={{
                      display: "inline-block", width: 5, height: 13,
                      background: C.acc2, borderRadius: 2, marginLeft: 2,
                      animation: "streams-blink 1s ease infinite",
                    }} />
                  )}
                </div>
                {/* Inline media placeholder */}
                {msg.mediaType === "image" && msg.mediaUrl && (
                  <div style={{ width: "100%", maxWidth: 260, aspectRatio: "1/1", marginTop: 8, borderRadius: R.r2, background: C.bg4, border: `1px solid ${C.bdr}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                      <rect x="2" y="2" width="32" height="32" rx="5" stroke="#3D2E8A" strokeWidth="1.5"/>
                      <path d="M2 25l9-9 6 6 6-8 11 11" stroke="#3D2E8A" strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="11" cy="12" r="3" fill="#3D2E8A"/>
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input area */}
        <div style={{
          padding: "12px 32px 20px",
          borderTop: `1px solid ${C.bdr}`,
          background: C.bg,
          flexShrink: 0,
        }} className="streams-chat-input">
          {/* Mode chips */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {(["Chat","Image","Video","Build"] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: "4px 12px", borderRadius: R.pill,
                  border: `1px solid ${mode === m ? C.acc : C.bdr}`,
                  background: mode === m ? C.accDim : "transparent",
                  color: mode === m ? C.acc2 : C.t3,
                  fontSize: 14, fontFamily: "inherit", cursor: "pointer",
                  transition: `all ${DUR.fast} ${EASE}`,
                }}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div style={{
            display: "flex", gap: 8, alignItems: "flex-end",
            background: C.bg3, border: `1px solid ${C.bdr}`,
            borderRadius: R.r3, padding: "8px 12px",
          }}>
            {/* Attach */}
            <button style={{
              background: "transparent", border: "none", color: C.t4,
              fontSize: 16, cursor: "pointer", padding: 2, flexShrink: 0,
            }}>⊕</button>

            <textarea
              value={input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
              placeholder={`Message Streams — ${mode} mode`}
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                fontFamily: "inherit", fontSize: 16, color: C.t1, resize: "none",
                lineHeight: 1.5, minHeight: 24,
              }}
            />

            <button
              onClick={handleSend}
              disabled={!input.trim() || streaming}
              style={{
                padding: "6px 16px", borderRadius: R.r1,
                background: input.trim() && !streaming ? C.acc : C.bg4,
                border: "none", color: input.trim() && !streaming ? "#fff" : C.t4,
                fontSize: 14, fontFamily: "inherit", fontWeight: 500,
                cursor: input.trim() && !streaming ? "pointer" : "not-allowed",
                transition: `all ${DUR.fast} ${EASE}`, flexShrink: 0,
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes streams-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @media (max-width: 768px) {
          .streams-chat-sidebar { display: none !important; }
          .streams-chat-mobile-bar { display: flex !important; }
          .streams-chat-msgs { padding: 16px !important; }
          .streams-chat-header { padding: 8px 16px 0 !important; }
          .streams-chat-input { padding: 8px 16px 16px !important; }
        }
      `}</style>
    </div>
  );
}
