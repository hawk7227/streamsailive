"use client";

import { useEffect } from "react";

const ACTION_ORDER = [
  "Editor",
  "Browser",
  "Mobile",
  "Advanced",
  "Attach",
  "Refresh",
  "Proof",
  "Dup",
  "Reset",
  "Code Editor",
  "Diff",
  "Logs",
  "Media",
  "Frontend UI",
] as const;

function normalizeLabel(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export default function BuilderUnifiedTopRowBridge() {
  useEffect(() => {
    let disposed = false;

    function sourceButtons() {
      const toolButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".liveWorkstation .toolStrip button"));
      const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".liveWorkstation .topTabs button"));
      return [...toolButtons, ...tabButtons];
    }

    function findSource(label: string) {
      return sourceButtons().find((button) => normalizeLabel(button.textContent || "") === label) || null;
    }

    function syncProxy(proxy: HTMLButtonElement, source: HTMLButtonElement) {
      proxy.disabled = source.disabled;
      proxy.classList.toggle("active", source.classList.contains("active"));
      proxy.setAttribute("aria-pressed", source.classList.contains("active") ? "true" : "false");
      proxy.title = source.title || source.getAttribute("aria-label") || normalizeLabel(source.textContent || "");
    }

    function install() {
      if (disposed) return;
      const topRow = document.querySelector<HTMLElement>(".streamsBuilderShell .topRow");
      if (!topRow) return;

      let actions = topRow.querySelector<HTMLElement>(".builderUnifiedTopRowActions");
      if (!actions) {
        actions = document.createElement("nav");
        actions.className = "builderUnifiedTopRowActions";
        actions.setAttribute("aria-label", "Builder view and preview actions");
        topRow.appendChild(actions);
      }

      for (const label of ACTION_ORDER) {
        const source = findSource(label);
        if (!source) continue;
        let proxy = actions.querySelector<HTMLButtonElement>(`button[data-unified-action="${CSS.escape(label)}"]`);
        if (!proxy) {
          proxy = document.createElement("button");
          proxy.type = "button";
          proxy.textContent = label;
          proxy.dataset.unifiedAction = label;
          proxy.addEventListener("click", () => {
            const current = findSource(label);
            current?.click();
            window.setTimeout(install, 0);
          });
          actions.appendChild(proxy);
        }
        syncProxy(proxy, source);
      }

      for (const proxy of Array.from(actions.querySelectorAll<HTMLButtonElement>("button[data-unified-action]"))) {
        const label = proxy.dataset.unifiedAction || "";
        const source = findSource(label);
        if (!source) proxy.remove();
      }

      const originalHeader = document.querySelector<HTMLElement>(".liveWorkstation .workstationHeader");
      const originalStrip = document.querySelector<HTMLElement>(".liveWorkstation .toolStrip");
      if (originalHeader) originalHeader.dataset.unifiedDuplicate = "hidden";
      if (originalStrip) originalStrip.dataset.unifiedDuplicate = "hidden";
    }

    install();
    const observer = new MutationObserver(install);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "disabled"],
    });

    return () => {
      disposed = true;
      observer.disconnect();
      document.querySelectorAll(".builderUnifiedTopRowActions").forEach((element) => element.remove());
      document.querySelectorAll<HTMLElement>('[data-unified-duplicate="hidden"]').forEach((element) => delete element.dataset.unifiedDuplicate);
    };
  }, []);

  return null;
}
