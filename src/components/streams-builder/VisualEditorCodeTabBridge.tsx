"use client";

import { useEffect } from "react";

function modeText(root: HTMLElement) {
  return root.querySelector<HTMLElement>(".sourceActionStrip div:nth-child(5) b")?.textContent || "";
}

function clickFooterMode(root: HTMLElement, label: string) {
  const footer = root.querySelector<HTMLElement>(".sourceActionStrip");
  const buttons = Array.from((footer || root).querySelectorAll<HTMLButtonElement>("button"));
  const target = buttons.find((button) => button.textContent?.trim() === label && !button.closest(".visualEditorModeTabs"));
  if (!target) return false;
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  target.click();
  return true;
}

export default function VisualEditorCodeTabBridge() {
  useEffect(() => {
    function syncTabs(root: HTMLElement) {
      const tabs = root.querySelector<HTMLElement>(".visualEditorModeTabs");
      if (!tabs) return;
      const isSplit = /code/i.test(modeText(root));
      tabs.querySelector<HTMLButtonElement>("[data-visual-tab='editor']")?.classList.toggle("active", !isSplit);
      tabs.querySelector<HTMLButtonElement>("[data-visual-tab='code']")?.classList.toggle("active", isSplit);
    }

    function wireVisualEditorCodeTab() {
      const visualEditor = document.querySelector<HTMLElement>(".visualEditor");
      if (!visualEditor) return;
      const header = visualEditor.querySelector<HTMLElement>(".top");
      if (!header) return;

      if (!header.querySelector("[data-visual-code-tab='true']")) {
        const tabWrap = document.createElement("div");
        tabWrap.className = "visualEditorModeTabs";
        tabWrap.dataset.visualCodeTab = "true";

        const visualTab = document.createElement("button");
        visualTab.type = "button";
        visualTab.textContent = "Visual Editor";
        visualTab.className = "visualEditorModeTab active";
        visualTab.dataset.visualTab = "editor";
        visualTab.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          clickFooterMode(visualEditor, "Editor");
          window.setTimeout(() => clickFooterMode(visualEditor, "Editor"), 80);
          window.setTimeout(() => syncTabs(visualEditor), 140);
        });

        const codeTab = document.createElement("button");
        codeTab.type = "button";
        codeTab.textContent = "Code Editor";
        codeTab.className = "visualEditorModeTab";
        codeTab.dataset.visualTab = "code";
        codeTab.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          clickFooterMode(visualEditor, "Code Editor");
          window.setTimeout(() => syncTabs(visualEditor), 140);
        });

        tabWrap.append(visualTab, codeTab);
        header.append(tabWrap);
      }
      syncTabs(visualEditor);
    }

    wireVisualEditorCodeTab();
    const timer = window.setInterval(wireVisualEditorCodeTab, 500);
    const observer = new MutationObserver(wireVisualEditorCodeTab);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); window.clearInterval(timer); };
  }, []);

  return <style jsx global>{`
    .visualEditorModeTabs { display: flex; align-items: center; gap: 8px; margin-left: auto; margin-right: 8px; }
    .visualEditorModeTab { height: 34px !important; border: 1px solid rgba(148, 163, 184, 0.22) !important; border-radius: 10px !important; background: #7c3aed !important; color: #fff !important; padding: 0 14px !important; font-size: 11px !important; font-weight: 900 !important; cursor: pointer !important; white-space: nowrap !important; }
    .visualEditorModeTab.active { background: rgba(6, 95, 70, 0.9) !important; border-color: #34d399 !important; color: #6ee7b7 !important; }
    .visualEditor .top { flex-wrap: nowrap !important; }
  `}</style>;
}
