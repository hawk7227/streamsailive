"use client";

import { useEffect } from "react";
import { planMinimalLinePatch } from "@/lib/streams-builder/line-patch-planner";

type ActiveFile = { repo?: string; branch?: string; path?: string; sha?: string; content?: string; route?: string };
type EditablePayload = { selector?: string; kind?: string; original?: string; text?: string; src?: string; parentLayerId?: string; childLayers?: Array<{ layerId?: string }> };

function readActiveFile(): ActiveFile | null {
  try {
    const raw = window.localStorage.getItem("streams-builder:active-file");
    return raw ? JSON.parse(raw) as ActiveFile : null;
  } catch {
    return null;
  }
}

function isLinePatchRequest(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  return url.includes("/api/streams-builder/line-patches") && String(init?.method || "GET").toUpperCase() === "POST";
}

export default function BuilderPrecisionCompatibilityBridge() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!isLinePatchRequest(input, init) || typeof init?.body !== "string") return originalFetch(input, init);
      try {
        const body = JSON.parse(init.body) as Record<string, any>;
        const operations = Array.isArray(body.operations) ? body.operations : [];
        const fullReplacement = operations.length === 1 && operations[0]?.type === "replace_full_file";
        const activeFile = readActiveFile();
        if (fullReplacement && activeFile?.content != null && String(body.filePath || "") === String(activeFile.path || "")) {
          const planned = planMinimalLinePatch(String(body.filePath || ""), String(activeFile.content || ""), String(operations[0]?.content || ""));
          if (planned.operations.length && planned.strategy !== "replace_full_file") {
            body.operations = planned.operations;
            body.allowLargeReplacement = false;
            body.patchStrategy = planned.strategy;
            body.changedStartLine = planned.changedStartLine;
            body.changedEndLine = planned.changedEndLine;
            init = { ...init, body: JSON.stringify(body) };
            window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: {
              phase: "patch.precise_planned",
              message: `Prepared ${planned.strategy} for lines ${planned.changedStartLine}-${planned.changedEndLine}; full-file replacement remains available as fallback.`,
              patchStrategy: planned.strategy,
              changedStartLine: planned.changedStartLine,
              changedEndLine: planned.changedEndLine,
            } }));
          }
        }
      } catch {
        // Preserve the original request whenever safe transformation cannot be proven.
      }
      return originalFetch(input, init);
    };

    async function onEditableMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.source !== "streams-editable-preview") return;
      if (event.data?.type !== "streams-editable-select") return;
      const activeFile = readActiveFile();
      if (!activeFile?.repo || !activeFile.branch || !activeFile.path) return;
      const payload = (event.data.payload || {}) as EditablePayload;
      try {
        const response = await originalFetch("/api/v1/builder/element-mappings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            repo: activeFile.repo,
            branch: activeFile.branch,
            sourceFile: activeFile.path,
            route: activeFile.route || "/",
            selector: payload.selector,
            kind: payload.kind,
            original: payload.original,
            text: payload.text,
            src: payload.src,
            parentLayerId: payload.parentLayerId,
            childLayerIds: (payload.childLayers || []).map((item) => item.layerId).filter(Boolean),
          }),
        });
        const data = await response.json().catch(() => ({})) as { ok?: boolean; mapping?: Record<string, any> };
        if (!response.ok || !data.ok || !data.mapping) return;
        const mapping = data.mapping;
        window.dispatchEvent(new CustomEvent("streams-builder:element-source-mapped", { detail: mapping }));
        window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: {
          phase: "visual.layer.mapped",
          message: mapping.sourceStartLine
            ? `Mapped selected ${payload.kind || "element"} to ${mapping.sourceFile} lines ${mapping.sourceStartLine}-${mapping.sourceEndLine}.`
            : `Selected ${payload.kind || "element"} retained direct-value fallback because no safe source range was proven.`,
          mapping,
        } }));
        if (mapping.sourceStartLine) {
          window.dispatchEvent(new CustomEvent("streams-builder:code-editor-command", { detail: {
            action: "highlight-lines",
            startLine: mapping.sourceStartLine,
            endLine: mapping.sourceEndLine,
            query: mapping.matchedValue || "",
          } }));
        }
      } catch {
        // Existing visual-to-code lookup remains authoritative fallback.
      }
    }

    window.addEventListener("message", onEditableMessage);
    return () => {
      window.fetch = originalFetch;
      window.removeEventListener("message", onEditableMessage);
    };
  }, []);

  return null;
}
