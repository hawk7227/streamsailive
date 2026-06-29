"use client";

import { useEffect } from "react";

export default function VisualEditorCodeTabBridge() {
  useEffect(() => {
    function wireVisualEditorCodeTab() {
      const visualEditor = document.querySelector<HTMLElement>(".visualEditor");
      if (!visualEditor) return;

      const header = visualEditor.querySelector<HTMLElement>(".top");
      if (!header || header.querySelector("[data-visual-code-tab='true']")) return;

      const tabWrap = document.createElement("div");
      tabWrap.className = "visualEditorModeTabs";
      tabWrap.dataset.visualCodeTab = "true";

      const visualTab = document.createElement("button");
      visualTab.type = "button";
      visualTab.textContent = "Visual Editor";
      visualTab.className = "visualEditorModeTab active";
      visualTab.onclick = () => {
        const footer = visualEditor.querySelector<HTMLElement>(".sourceActionStrip");
        const editorButton = Array.from((footer || visualEditor).querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Editor");
        editorButton?.click();
      };

      const codeTab = document.createElement("button");
      codeTab.type = "button";
      codeTab.textContent = "Code Editor";
      codeTab.className = "visualEditorModeTab";
      codeTab.onclick = () => {
        const footer = visualEditor.querySelector<HTMLElement>(".sourceActionStrip");
        const codeButton = Array.from((footer || visualEditor).querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Code Editor");
        codeButton?.click();
      };

      tabWrap.append(visualTab, codeTab);
      header.append(tabWrap);
    }

    wireVisualEditorCodeTab();
    const observer = new MutationObserver(wireVisualEditorCodeTab);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <style jsx global>{`
    .visualEditorModeTabs { display: flex; align-items: center; gap: 8px; margin-left: auto; margin-right: 8px; }
    .visualEditorModeTab { height: 34px !important; border: 1px solid rgba(148, 163, 184, 0.22) !important; border-radius: 10px !important; background: #7c3aed !important; color: #fff !important; padding: 0 14px !important; font-size: 11px !important; font-weight: 900 !important; cursor: pointer !important; white-space: nowrap !important; }
    .visualEditorModeTab.active { background: rgba(6, 95, 70, 0.9) !important; border-color: #34d399 !important; color: #6ee7b7 !important; }
    .visualEditor .top { flex-wrap: nowrap !important; }
  `}</style>;
}
