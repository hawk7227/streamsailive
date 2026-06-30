"use client";

import { useEffect, useState } from "react";
import CanonicalPreviewRuntime from "./CanonicalPreviewRuntime";

const ACTIVE_KEY = "streams-ai:active-builder-preview";
const OPEN_EVENT = "streams:open-builder-preview";

function readActive() {
  try { return JSON.parse(window.sessionStorage.getItem(ACTIVE_KEY) || "{}"); } catch { return {}; }
}

export default function CanonicalPreviewWorkspaceSurface() {
  const [active, setActive] = useState({});
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const saved = readActive();
    if (saved?.previewId) {
      setActive(saved);
      setVisible(Boolean(saved.open));
    }
    function onOpen(event) {
      const detail = event.detail || {};
      if (!detail.previewId) return;
      const next = { ...readActive(), ...detail, open: true };
      try { window.sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(next)); } catch {}
      setActive(next);
      setVisible(true);
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!visible || !active?.previewId) return null;
  return (
    <section className="builderCanonicalSurface" aria-label="Canonical Streams Builder preview">
      <div className="surfaceTop"><b>Canonical Preview</b><span>{active.activeBuilderRunId ? `Run ${active.activeBuilderRunId}` : active.previewUrl || `/streams-builder/preview/${active.previewId}`}</span><button type="button" onClick={() => setVisible(false)}>Hide</button></div>
      <CanonicalPreviewRuntime previewId={active.previewId} embedded />
      <style jsx>{`.builderCanonicalSurface{position:fixed;right:12px;top:46px;bottom:12px;width:min(980px,calc(100vw - 430px));z-index:75;border:1px solid rgba(56,189,248,.36);border-radius:22px;background:#020713;overflow:hidden;box-shadow:0 28px 100px rgba(0,0,0,.48)}.surfaceTop{height:40px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;padding:0 12px;background:#081126;border-bottom:1px solid rgba(148,163,184,.18);color:#eaf3ff}.surfaceTop b{font-size:12px}.surfaceTop span{min-width:0;color:#8dabdb;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.surfaceTop button{height:28px;border:0;border-radius:999px;background:rgba(255,255,255,.08);color:#fff;font-size:11px;font-weight:900;padding:0 10px}.builderCanonicalSurface :global(.canonicalPreview.embedded){position:absolute!important;left:0!important;right:0!important;top:40px!important;bottom:0!important;width:auto!important;height:auto!important;border:0!important;border-radius:0!important;box-shadow:none!important}@media(max-width:1100px){.builderCanonicalSurface{left:10px;right:10px;width:auto}}`}</style>
    </section>
  );
}
