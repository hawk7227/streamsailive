"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function title(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export default function MemoryControlsPanel() {
  const [target, setTarget] = useState(null);
  const [open, setOpen] = useState(false);
  const [memories, setMemories] = useState([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/streams-ai/memory?limit=20", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      setMemories(Array.isArray(data.memories) ? data.memories : []);
    } catch {
      setMemories([]);
    }
  }

  async function remember() {
    const content = draft.trim();
    if (!content) return;
    setStatus("Saving…");
    const response = await fetch("/api/streams-ai/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "user", memoryType: "fact", content, importance: 0.7, confidence: 0.8, metadata: { source: "memory-controls-ui" } }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) {
      setStatus(data?.error || "Memory save failed");
      return;
    }
    setDraft("");
    setStatus("Saved");
    await load();
  }

  async function forget(memory) {
    if (!memory?.id) return;
    setStatus("Forgetting…");
    const response = await fetch("/api/streams-ai/memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryId: memory.id }),
    });
    const data = await response.json().catch(() => ({}));
    setStatus(response.ok && data?.ok !== false ? "Forgotten" : data?.error || "Forget failed");
    await load();
  }

  useEffect(() => {
    function locate() {
      setTarget(document.querySelector(".desktopSide:not(.collapsed) .sideProfile") || null);
    }
    locate();
    const timer = window.setInterval(locate, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open]);

  if (!target) return null;

  return createPortal(
    <div className="memoryControlsHost">
      <button type="button" className="memoryControlsButton" onClick={() => setOpen((value) => !value)}>Memory</button>
      {open ? (
        <div className="memoryControlsPanel" role="dialog" aria-label="Memory controls">
          <div className="memoryControlsTop"><b>Memory</b><button type="button" onClick={() => setOpen(false)}>×</button></div>
          <p>View, add, or forget saved user/project context.</p>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Remember this…" />
          <button type="button" className="primary" onClick={remember}>Remember</button>
          <div className="memoryList">
            {memories.length ? memories.map((memory) => (
              <div key={memory.id || memory.content} className="memoryItem">
                <span>{title(memory.summary || memory.content)}</span>
                <button type="button" onClick={() => forget(memory)}>Forget</button>
              </div>
            )) : <em>No saved memory found.</em>}
          </div>
          {status ? <small>{status}</small> : null}
        </div>
      ) : null}
      <style jsx>{`
        .memoryControlsHost{position:relative;margin:0 8px 8px}.memoryControlsButton{width:100%;height:32px;border:1px solid rgba(77,133,226,.3);border-radius:12px;background:rgba(13,29,60,.72);color:#eef6ff;font-weight:900;cursor:pointer}.memoryControlsPanel{position:absolute;left:0;bottom:40px;width:280px;z-index:220;border:1px solid rgba(77,133,226,.34);border-radius:18px;background:#081126;color:#eef6ff;box-shadow:0 20px 80px rgba(0,0,0,.4);padding:12px}.memoryControlsTop{display:flex;align-items:center;justify-content:space-between}.memoryControlsTop button{border:0;background:transparent;color:#eef6ff;font-size:18px}.memoryControlsPanel p{margin:6px 0 10px;color:#9fb8e8;font-size:12px}.memoryControlsPanel textarea{width:100%;min-height:70px;border:1px solid rgba(77,133,226,.3);border-radius:12px;background:rgba(255,255,255,.06);color:#eef6ff;padding:8px;resize:vertical}.memoryControlsPanel .primary{width:100%;height:34px;margin:8px 0;border:0;border-radius:12px;background:#37e5ff;color:#03111c;font-weight:900}.memoryList{display:flex;flex-direction:column;gap:6px;max-height:210px;overflow:auto}.memoryItem{display:flex;gap:6px;align-items:center;border:1px solid rgba(77,133,226,.18);border-radius:10px;padding:6px}.memoryItem span{flex:1;font-size:12px;line-height:1.3}.memoryItem button{border:0;border-radius:999px;background:rgba(255,255,255,.08);color:#ffb4b4;font-size:11px;padding:4px 8px}.memoryControlsPanel small,.memoryList em{color:#9fb8e8;font-size:12px}
      `}</style>
    </div>,
    target
  );
}
