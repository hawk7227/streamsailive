"use client";

import { useEffect, useMemo, useState } from "react";

const STREAM_PREFIX = "streams-ai:streaming-state:";

function key(sessionId = "new") {
  return `${STREAM_PREFIX}${sessionId || "new"}`;
}

function latestUserMessage(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (item?.role === "user" && String(item.content || "").trim()) return item;
  }
  return null;
}

export default function StreamingRecoveryBanner({ chatRuntime }) {
  const [recovery, setRecovery] = useState(null);
  const sessionId = chatRuntime?.sessionId || "new";
  const userMessage = useMemo(() => latestUserMessage(chatRuntime?.messages || []), [chatRuntime?.messages]);

  useEffect(() => {
    if (!sessionId) return;
    if (chatRuntime?.isStreaming && userMessage?.content) {
      try {
        window.localStorage.setItem(key(sessionId), JSON.stringify({ sessionId, userMessage: userMessage.content, at: new Date().toISOString() }));
      } catch {}
    }
    if (!chatRuntime?.isStreaming) {
      try { window.localStorage.removeItem(key(sessionId)); } catch {}
    }
  }, [sessionId, chatRuntime?.isStreaming, userMessage?.content]);

  useEffect(() => {
    if (!sessionId || chatRuntime?.isStreaming) return;
    try {
      const raw = window.localStorage.getItem(key(sessionId));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.userMessage) setRecovery(parsed);
    } catch {}
  }, [sessionId, chatRuntime?.isStreaming]);

  if (!recovery || chatRuntime?.isStreaming) return null;

  return (
    <div className="streamsRecoveryBanner" role="status">
      <span>Previous response may have been interrupted.</span>
      <button type="button" onClick={() => { setRecovery(null); chatRuntime?.sendMessage?.({ message: `Continue from my previous request: ${recovery.userMessage}` }); }}>Continue</button>
      <button type="button" onClick={() => { try { window.localStorage.removeItem(key(sessionId)); } catch {}; setRecovery(null); }}>Dismiss</button>
      <style jsx>{`
        .streamsRecoveryBanner{position:fixed;right:24px;bottom:98px;z-index:70;display:flex;align-items:center;gap:10px;max-width:min(520px,calc(100vw - 48px));border:1px solid rgba(77,133,226,.34);background:#081126;color:#eef6ff;border-radius:16px;padding:10px 12px;box-shadow:0 18px 60px rgba(0,0,0,.28);font-size:13px;font-weight:760}
        .streamsRecoveryBanner span{flex:1}.streamsRecoveryBanner button{height:30px;border:0;border-radius:999px;padding:0 12px;background:#37e5ff;color:#03111c;font-weight:900;cursor:pointer}.streamsRecoveryBanner button:last-child{background:rgba(255,255,255,.08);color:#eaf3ff}@media(max-width:760px){.streamsRecoveryBanner{left:12px;right:12px;bottom:calc(90px + env(safe-area-inset-bottom,0px))}}
      `}</style>
    </div>
  );
}
