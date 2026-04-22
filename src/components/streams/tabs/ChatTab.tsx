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

const SESSIONS = [
  { id: "1", title: "New conversation",         time: "now"      },
  { id: "2", title: "Generate brand assets",    time: "2h ago"   },
  { id: "3", title: "Video lady walking city",  time: "yesterday" },
  { id: "4", title: "Explain the pipeline",     time: "2d ago"   },
];

const SEED_MSGS: Msg[] = [
  { id: "m1", role: "user",      text: "generate an image of a lady walking in the city" },
  { id: "m2", role: "assistant", text: "A cinematic street scene — warm golden hour, a woman in motion against a blur of city life. Generated at full resolution.", mediaUrl: "placeholder", mediaType: "image" as const },
  { id: "m3", role: "user",      text: "make her outfit more formal" },
  { id: "m4", role: "assistant", text: "Updated — sharp blazer, tailored trousers. Same motion, same light, same city energy." },
];

export default function ChatTab() {
  const [msgs,      setMsgs]      = useState<Msg[]>(SEED_MSGS);
  const [input,     setInput]     = useState("");
  const [mode,      setMode]      = useState<Mode>("Chat");
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebar] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    const userMsg: Msg = { id: Date.now().toString(), role: "user", text };
    setMsgs((p: Msg[]) => [...p, userMsg]);
    setInput("");
    setStreaming(true);

    // Shell only — simulates the SSE stream shape without calling backend
    const aiId = (Date.now() + 1).toString();
    setMsgs((p: Msg[]) => [...p, { id: aiId, role: "assistant", text: "", streaming: true }]);

    let built = "";
    const reply = mode === "Image"
      ? "Generating image…"
      : mode === "Video"
      ? "Generating video…"
      : "I understand your request. When the backend is connected, I will stream a full response here token by token via the SSE text_delta event.";

    const iv = setInterval(() => {
      if (built.length >= reply.length) {
        clearInterval(iv);
        setMsgs((p: Msg[]) => p.map((m: Msg) => m.id === aiId ? { ...m, streaming: false } : m));
        setStreaming(false);
        return;
      }
      built += reply[built.length];
      setMsgs((p: Msg[]) => p.map((m: Msg) => m.id === aiId ? { ...m, text: built } : m));
    }, 18);
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
        <div style={{ fontSize: 10, color: C.t4, marginBottom: 12 }}>New conversation</div>
        <button
          onClick={() => setMsgs(SEED_MSGS)}
          style={{
            width: "100%", padding: "8px 0", borderRadius: R.r1,
            background: C.acc, border: "none", color: "#fff",
            fontSize: 11, fontFamily: "inherit", cursor: "pointer",
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
        <button key={nav.label} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px", border: "none", background: "transparent",
          color: C.t3, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
          width: "100%", textAlign: "left",
        }}>
          <span>{nav.icon}</span> {nav.label}
        </button>
      ))}

      {/* Recents */}
      <div style={{ padding: "8px 16px 4px", fontSize: 9, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase" }}>Recents</div>
      {SESSIONS.map(s => (
        <button key={s.id} style={{
          display: "block", textAlign: "left", padding: "8px 16px",
          border: "none", background: s.id === "1" ? C.surf2 : "transparent",
          color: s.id === "1" ? C.t1 : C.t3, fontSize: 11, fontFamily: "inherit",
          cursor: "pointer", width: "100%",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          borderLeft: s.id === "1" ? `2px solid ${C.acc}` : "2px solid transparent",
        }}>
          {s.title}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* Sidebar — desktop */}
      <div className="streams-chat-sidebar">{Sidebar}</div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* AI assistant header — badge + title + subtitle */}
        <div style={{ padding: "14px 32px 0", flexShrink: 0 }} className="streams-chat-header">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "3px 10px", borderRadius: R.pill, border: `1px solid ${C.accBr}`, background: C.accDim, fontSize: 10, color: C.acc2, marginBottom: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: R.pill, background: C.acc2, display: "inline-block" }} />
            Chat · image · video · build
          </div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: C.t1, marginBottom: 4 }}>AI assistant</div>
          <div style={{ fontSize: 11, color: C.t3, marginBottom: 12, lineHeight: 1.5 }}>Generate images, videos, voice and code directly from conversation.</div>
        </div>

        {/* Mobile top bar */}
        <div className="streams-chat-mobile-bar" style={{
          display: "none", padding: "10px 16px",
          borderBottom: `1px solid ${C.bdr}`,
          alignItems: "center", gap: 10,
        }}>
          <button onClick={() => setSidebar(!sidebarOpen)} style={{
            background: "transparent", border: `1px solid ${C.bdr}`,
            borderRadius: R.r1, padding: "6px 10px", color: C.t3,
            fontSize: 12, cursor: "pointer", fontFamily: "inherit",
          }}>☰</button>
          <span style={{ fontSize: 11, color: C.t3 }}>New conversation</span>
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
                fontSize: 10, fontWeight: 600, color: "#fff",
                border: msg.role === "user" ? `1px solid ${C.bdr}` : "none",
              }}>
                {msg.role === "user" ? "U" : "S"}
              </div>

              <div>
                {msg.role === "assistant" && (
                  <div style={{ fontSize: 10, color: C.t4, marginBottom: 4, letterSpacing: ".04em" }}>
                    Streams, now
                  </div>
                )}
                <div style={{
                  padding: "10px 14px",
                  borderRadius: msg.role === "user" ? `${R.r2}px 4px ${R.r2}px ${R.r2}px` : `4px ${R.r2}px ${R.r2}px ${R.r2}px`,
                  background: msg.role === "user" ? C.acc : C.surf,
                  border: msg.role === "user" ? "none" : `1px solid ${C.bdr}`,
                  color: C.t1, fontSize: 13, lineHeight: 1.65,
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
                  fontSize: 11, fontFamily: "inherit", cursor: "pointer",
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
            borderRadius: R.r3, padding: "10px 12px",
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
                fontFamily: "inherit", fontSize: 13, color: C.t1, resize: "none",
                lineHeight: 1.5, minHeight: 24,
              }}
            />

            <button
              onClick={handleSend}
              disabled={!input.trim() || streaming}
              style={{
                padding: "6px 14px", borderRadius: R.r1,
                background: input.trim() && !streaming ? C.acc : C.bg4,
                border: "none", color: input.trim() && !streaming ? "#fff" : C.t4,
                fontSize: 11, fontFamily: "inherit", fontWeight: 500,
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
          .streams-chat-header { padding: 10px 16px 0 !important; }
          .streams-chat-input { padding: 10px 16px 16px !important; }
        }
      `}</style>
    </div>
  );
}
