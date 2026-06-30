"use client";

import { useEffect, useState } from "react";
import CanonicalPreviewRuntime from "@/components/streams-builder/CanonicalPreviewRuntime";

const OPEN_EVENT = "streams:open-builder-preview";
const ACTIVE_KEY = "streams-ai:active-builder-preview";

export default function StreamsBuilderPreviewHost({ chatRuntime }) {
  const [previewId, setPreviewId] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(ACTIVE_KEY) || "{}");
      if (saved?.previewId && (!saved.sessionId || saved.sessionId === chatRuntime?.sessionId)) {
        setPreviewId(saved.previewId);
        setOpen(Boolean(saved.open));
      }
    } catch {}
  }, [chatRuntime?.sessionId]);

  useEffect(() => {
    function onOpen(event) {
      const detail = event.detail || {};
      if (!detail.previewId) return;
      setPreviewId(detail.previewId);
      setOpen(true);
      try { window.sessionStorage.setItem(ACTIVE_KEY, JSON.stringify({ previewId: detail.previewId, sessionId: detail.sessionId || chatRuntime?.sessionId || "", open: true })); } catch {}
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [chatRuntime?.sessionId]);

  if (!previewId || !open) return null;
  return (
    <section className="builderPreviewHost" aria-label="Streams Builder preview host">
      <header><strong>Streams Builder Preview</strong><div><a href={`/streams-builder/preview/${previewId}`} target="_blank" rel="noreferrer">Open full</a><button type="button" onClick={() => { setOpen(false); try { window.sessionStorage.setItem(ACTIVE_KEY, JSON.stringify({ previewId, sessionId: chatRuntime?.sessionId || "", open: false })); } catch {} }}>Close</button></div></header>
      <CanonicalPreviewRuntime previewId={previewId} embedded />
      <style jsx>{`.builderPreviewHost{position:fixed;right:18px;top:70px;bottom:18px;width:min(700px,calc(100vw - 36px));z-index:58;background:#020713;border:1px solid rgba(77,133,226,.34);border-radius:24px;overflow:hidden;box-shadow:0 24px 90px rgba(0,0,0,.44)}header{height:42px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:#081126;color:#eaf3ff}header div{display:flex;gap:8px;align-items:center}a{color:#37e5ff;text-decoration:none;font-size:12px;font-weight:900}button{height:28px;border:0;border-radius:999px;background:rgba(255,255,255,.08);color:#fff;padding:0 10px}.builderPreviewHost :global(.canonicalPreview.embedded){position:absolute!important;left:0!important;right:0!important;top:42px!important;bottom:0!important;width:auto!important;height:auto!important;border:0!important;border-radius:0!important;box-shadow:none!important}@media(max-width:900px){.builderPreviewHost{left:10px;right:10px;top:68px;bottom:88px;width:auto}}`}</style>
    </section>
  );
}
