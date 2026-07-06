"use client";

import { useEffect, useState } from "react";
import { canShowStreamsStatus, isVisibleSafeStatus, normalizeStatusText } from "./runtime/streamsStatusRegistry";

export default function StreamsAIStatusBridge({ chatRuntime }) {
  const [externalStatus, setExternalStatus] = useState(null);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const id = "streams-ai-status-bridge-style";
    document.getElementById(id)?.remove();
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .streamsStatusBridge{position:fixed;left:50%;bottom:calc(118px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:72;max-width:min(720px,calc(100vw - 28px));display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border-radius:999px;border:1px solid rgba(148,163,184,.16);background:rgba(15,23,42,.42);color:rgba(226,232,240,.78);font:750 12px/1.25 Inter,system-ui,sans-serif;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 12px 38px rgba(0,0,0,.20);pointer-events:none}.streamsStatusBridge:before{content:"";width:6px;height:6px;border-radius:999px;background:rgba(34,211,238,.78);box-shadow:0 0 14px rgba(34,211,238,.45)}.streamsStatusBridge.idle{display:none}@media(max-width:899px){.streamsStatusBridge{bottom:calc(142px + env(safe-area-inset-bottom));font-size:11px}.shell.mobile.keyboardOpen ~ .streamsStatusBridge,.shell.mobile:focus-within ~ .streamsStatusBridge{bottom:calc(var(--keyboard,0px) + 72px + env(safe-area-inset-bottom))}}
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onStatus = (event) => {
      const detail = event?.detail || {};
      const text = normalizeStatusText(detail.statusText || detail.text || "");
      if (!canShowStreamsStatus(text)) return;
      setExternalStatus({ statusText: text, visible: true, createdAt: Date.now() });
      window.clearTimeout(window.__streamsStatusBridgeTimer);
      window.__streamsStatusBridgeTimer = window.setTimeout(() => setExternalStatus(null), detail.durationMs || 3200);
    };
    window.addEventListener("streams:live-status", onStatus);
    return () => window.removeEventListener("streams:live-status", onStatus);
  }, []);

  const runtimeText = normalizeStatusText(chatRuntime?.activity?.statusText || "");
  const runtimeShow = isVisibleSafeStatus(chatRuntime?.activity, Boolean(chatRuntime?.isStreaming));
  const text = externalStatus?.statusText || runtimeText;
  const show = Boolean(externalStatus?.visible || runtimeShow);
  return <div className={show ? "streamsStatusBridge" : "streamsStatusBridge idle"}>{text}</div>;
}
