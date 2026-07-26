"use client";

import { useEffect, useRef, useState } from "react";
import {
  BUILDER_VIEW_INTENT_EVENT,
  emitBuilderAgentCommunication,
  emitInferredBuilderView,
  inferBuilderView,
  type BuilderWorkstationView,
} from "./builderAgentInteraction";

type RuntimeEvent = {
  id?: string | number;
  eventType?: string;
  event_type?: string;
  message?: string;
  createdAt?: string;
  created_at?: string;
  path?: string;
  filePath?: string;
  file_path?: string;
  startLine?: number;
  start_line?: number;
  endLine?: number;
  end_line?: number;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

type ViewIntent = {
  view?: BuilderWorkstationView;
  reason?: string;
  confidence?: number;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  source?: string;
};

function clickView(view: BuilderWorkstationView) {
  const labels: Record<BuilderWorkstationView, string> = {
    frontend: "Frontend UI",
    code: "Code Editor",
    diff: "Diff",
    logs: "Logs",
    media: "Media",
    devtools: "DevTools",
  };
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".liveWorkstation .workingTabs button"));
  const target = buttons.find((button) => button.textContent?.trim() === labels[view]);
  target?.click();
  return Boolean(target);
}

function eventText(event: RuntimeEvent) {
  return `${event.eventType || event.event_type || "runtime"}: ${event.message || "event"}`;
}

function runtimeRange(event: RuntimeEvent) {
  const data = { ...(event.payload || {}), ...(event.data || {}) } as Record<string, unknown>;
  const startLine = Number(event.startLine || event.start_line || data.startLine || data.start_line || 0);
  const endLine = Number(event.endLine || event.end_line || data.endLine || data.end_line || startLine || 0);
  const filePath = String(event.path || event.filePath || event.file_path || data.path || data.filePath || data.file_path || "");
  return {
    filePath,
    startLine: Number.isFinite(startLine) && startLine > 0 ? startLine : undefined,
    endLine: Number.isFinite(endLine) && endLine > 0 ? endLine : undefined,
  };
}

export default function BuilderAgentPresenceBridge() {
  const [cue, setCue] = useState("");
  const userViewUntil = useRef(0);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    function rememberManualView(event: Event) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".liveWorkstation .workingTabs")) userViewUntil.current = Date.now() + 12_000;
    }
    document.addEventListener("click", rememberManualView, true);
    return () => document.removeEventListener("click", rememberManualView, true);
  }, []);

  useEffect(() => {
    function onViewIntent(event: Event) {
      const detail = (event as CustomEvent<ViewIntent>).detail || {};
      if (!detail.view) return;
      const confidence = Number(detail.confidence || 0);
      if (Date.now() < userViewUntil.current && confidence < 0.97) return;
      if (!clickView(detail.view)) return;
      setCue(`${detail.view === "frontend" ? "Preview" : detail.view} opened · ${detail.reason || "Builder context changed"}`);
      if (detail.view === "code" && detail.startLine) {
        window.dispatchEvent(new CustomEvent("streams-builder:code-editor-command", {
          detail: { action: "goto-range", startLine: detail.startLine, endLine: detail.endLine || detail.startLine },
        }));
      }
      window.setTimeout(() => setCue(""), 3200);
    }
    window.addEventListener(BUILDER_VIEW_INTENT_EVENT, onViewIntent);
    return () => window.removeEventListener(BUILDER_VIEW_INTENT_EVENT, onViewIntent);
  }, []);

  useEffect(() => {
    function onSummary(event: Event) {
      const detail = (event as CustomEvent<{ phase?: string; message?: string; error?: string; filePath?: string }>).detail || {};
      const message = String(detail.message || detail.error || "").trim();
      if (!message) return;
      const phase = String(detail.phase || "builder.activity");
      const inferred = inferBuilderView({ phase, message, filePath: detail.filePath, hasPreview: true });
      const status = /failed|blocked|error/i.test(message) ? "error" : /verified|completed|passed|pushed|pulled/i.test(message) ? "success" : /waiting|approval|confirm|permission/i.test(message) ? "question" : "working";
      emitBuilderAgentCommunication({
        phase,
        message,
        status,
        view: inferred.view,
        reason: inferred.reason,
        filePath: detail.filePath,
        requiresResponse: status === "question",
      });
    }
    function onPatch(event: Event) {
      const detail = (event as CustomEvent<RuntimeEvent>).detail || {};
      const range = runtimeRange(detail);
      emitBuilderAgentCommunication({
        phase: "builder.editing",
        message: range.startLine ? `Editing ${range.filePath || "the locked file"}, lines ${range.startLine}-${range.endLine || range.startLine}` : `Editing ${range.filePath || "the locked file"}`,
        detail: detail.message || "Applying the worker patch to the visible source.",
        status: "working",
        view: "code",
        reason: "The user should see the exact source range while the agent edits it.",
        ...range,
      });
    }
    window.addEventListener("streams-builder-summary-event", onSummary);
    window.addEventListener("streams-builder:worker-patch", onPatch);
    return () => {
      window.removeEventListener("streams-builder-summary-event", onSummary);
      window.removeEventListener("streams-builder:worker-patch", onPatch);
    };
  }, []);

  useEffect(() => {
    function onRuntimeJob(event: Event) {
      const detail = (event as CustomEvent<{ jobId?: string; path?: string }>).detail || {};
      if (!detail.jobId) return;
      emitBuilderAgentCommunication({
        phase: "builder.runtime.started",
        message: `Started autonomous work on ${detail.path || "the locked source"}.`,
        status: "working",
        view: "logs",
        reason: "The runtime activity stream is the strongest evidence while the worker starts.",
        filePath: detail.path,
      });
      let stopped = false;
      async function poll() {
        try {
          const response = await fetch(`/api/streams-ai/jobs?jobId=${encodeURIComponent(detail.jobId || "")}`, { cache: "no-store", credentials: "same-origin" });
          const payload = await response.json().catch(() => null) as { ok?: boolean; events?: RuntimeEvent[]; job?: { status?: string }; error?: string } | null;
          if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Builder runtime status unavailable");
          if (stopped) return;
          for (const item of payload.events || []) {
            const key = String(item.id || `${item.eventType || item.event_type}:${item.message}:${item.createdAt || item.created_at}`);
            if (seen.current.has(key)) continue;
            seen.current.add(key);
            const text = eventText(item);
            const range = runtimeRange(item);
            const inferred = inferBuilderView({ phase: item.eventType || item.event_type, message: text, filePath: range.filePath, hasPreview: true, hasPatch: Boolean(range.startLine) });
            const status = /failed|blocked|error/i.test(text) ? "error" : /completed|verified|passed|pushed/i.test(text) ? "success" : /permission|confirm|required|waiting/i.test(text) ? "question" : "working";
            emitBuilderAgentCommunication({
              phase: String(item.eventType || item.event_type || "builder.runtime"),
              message: item.message || "Builder runtime event",
              status,
              view: inferred.view,
              reason: inferred.reason,
              requiresResponse: status === "question",
              ...range,
            });
          }
          const jobStatus = String(payload.job?.status || "").toLowerCase();
          if (/completed|failed|cancelled/.test(jobStatus)) {
            stopped = true;
            emitInferredBuilderView({ phase: `job.${jobStatus}`, message: jobStatus === "completed" ? "Verified result ready in preview" : `Job ${jobStatus}`, hasPreview: jobStatus === "completed", force: true });
          }
        } catch (error) {
          if (!stopped) emitBuilderAgentCommunication({
            phase: "builder.runtime.error",
            message: error instanceof Error ? error.message : "Builder runtime status unavailable",
            status: "error",
            view: "logs",
            reason: "The runtime connection failed; logs preserve the evidence.",
          });
        }
      }
      void poll();
      const timer = window.setInterval(() => void poll(), 1200);
      window.setTimeout(() => { stopped = true; window.clearInterval(timer); }, 15 * 60 * 1000);
    }
    window.addEventListener("streams-builder:runtime-job", onRuntimeJob);
    return () => window.removeEventListener("streams-builder:runtime-job", onRuntimeJob);
  }, []);

  return cue ? <div className="builderAdaptiveCue" role="status">{cue}<style jsx>{`.builderAdaptiveCue{position:absolute;z-index:90;top:52px;left:50%;transform:translateX(-50%);max-width:min(720px,78%);padding:7px 12px;border:1px solid rgba(56,189,248,.46);border-radius:999px;background:rgba(3,8,23,.94);box-shadow:0 14px 34px rgba(0,0,0,.42);color:#bae6fd;font-size:10px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}`}</style></div> : null;
}
