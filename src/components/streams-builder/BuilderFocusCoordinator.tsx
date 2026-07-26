"use client";

import { useEffect, useState } from "react";
import { BUILDER_AGENT_FOCUS_EVENT, BUILDER_CONTEXT_EVENT, type BuilderSelectionRange } from "./builderLiveSourceTruth";

type FocusDetail = {
  repo?: string;
  branch?: string;
  filePath?: string;
  sourceSha?: string;
  phase?: "inspect" | "working" | "applied" | "verified" | "failed";
  selectedRange?: BuilderSelectionRange | null;
  message?: string;
  jobId?: string;
};

function clickCodeTab() {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".builderResearchSource .topTabs button"));
  buttons.find((button) => button.textContent?.trim() === "Code Editor")?.click();
}

export default function BuilderFocusCoordinator() {
  const [focus, setFocus] = useState<FocusDetail | null>(null);

  useEffect(() => {
    function onFocus(event: Event) {
      const detail = (event as CustomEvent<FocusDetail>).detail || {};
      setFocus(detail);
      clickCodeTab();
      const query = detail.selectedRange?.text?.trim();
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("streams-builder:code-editor-command", { detail: query ? { action: "select-source", query } : { action: "focus" } }));
      }, 60);
      window.dispatchEvent(new CustomEvent(BUILDER_CONTEXT_EVENT, { detail: { kind: "agent-focus", ...detail } }));
      if (detail.phase === "verified" || detail.phase === "failed") window.setTimeout(() => setFocus(null), 1800);
    }
    window.addEventListener(BUILDER_AGENT_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(BUILDER_AGENT_FOCUS_EVENT, onFocus);
  }, []);

  if (!focus) return null;
  return (
    <div className="builderFocusCue" role="status" aria-live="polite">
      <span />
      <b>{focus.phase === "inspect" ? "Inspecting" : focus.phase === "working" ? "Editing" : focus.phase || "Working"}</b>
      <em>{focus.filePath || "shared preview"}{focus.selectedRange ? ` · ${focus.selectedRange.startLine}-${focus.selectedRange.endLine}` : ""}</em>
      <style jsx>{`
        .builderFocusCue{position:absolute;z-index:40;left:50%;top:6px;transform:translateX(-50%);max-width:min(520px,70%);height:26px;display:flex;align-items:center;gap:7px;padding:0 10px;border:1px solid rgba(45,212,191,.28);border-radius:999px;background:rgba(2,6,23,.86);box-shadow:0 8px 30px rgba(0,0,0,.28);pointer-events:none;color:#fff;backdrop-filter:blur(10px)}
        span{width:7px;height:7px;border-radius:50%;background:#2dd4bf;box-shadow:0 0 12px #2dd4bf;animation:pulse 1.1s ease-in-out infinite}b{font-size:9px;text-transform:uppercase;color:#99f6e4}em{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;font-style:normal;color:#cbd5e1}@keyframes pulse{50%{opacity:.35;transform:scale(.75)}}
      `}</style>
    </div>
  );
}
