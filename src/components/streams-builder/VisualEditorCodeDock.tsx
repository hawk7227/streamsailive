"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import RuntimeCodeEditor from "./RuntimeCodeEditor";

type ActiveFile = { repo?: string; branch?: string; path?: string; folder?: string; sha?: string; content?: string; route?: string };
type CodeSelection = { startLine: number; startColumn: number; endLine: number; endColumn: number; text: string };

function readActiveFile(): ActiveFile {
  try {
    const raw = window.localStorage.getItem("streams-builder:active-file");
    return raw ? JSON.parse(raw) as ActiveFile : {};
  } catch {
    return {};
  }
}

function emit(phase: string, message: string, detail: Record<string, unknown> = {}) {
  const payload = { phase, message, source: "visual-code-dock", at: new Date().toISOString(), ...detail };
  window.dispatchEvent(new CustomEvent("streams-builder:chat-context-event", { detail: payload }));
  window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: payload }));
}

function clean(value?: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function writeActiveFile(next: ActiveFile) {
  try {
    window.localStorage.setItem("streams-builder:active-file", JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("streams-builder:pulled-file", { detail: next }));
  } catch {
    // Ignore storage failures; the visible editor still updates locally.
  }
}

function previewIframe() {
  return document.querySelector<HTMLIFrameElement>(".visualEditor .canvas.editor iframe, .visualEditor .canvas.browser iframe, .visualEditor .splitPreview iframe");
}

function snapshotPreviewScroll(doc: Document) {
  const root = doc.scrollingElement || doc.documentElement;
  const items: Array<{ el: Element; top: number; left: number }> = [];
  if (root) items.push({ el: root, top: root.scrollTop, left: root.scrollLeft });
  doc.querySelectorAll("*").forEach((node) => {
    const el = node as HTMLElement;
    if ((el.scrollTop || el.scrollLeft) && el !== root) items.push({ el, top: el.scrollTop, left: el.scrollLeft });
  });
  return items;
}

function restorePreviewScroll(items: Array<{ el: Element; top: number; left: number }>) {
  items.forEach((item) => {
    try {
      (item.el as HTMLElement).scrollTop = item.top;
      (item.el as HTMLElement).scrollLeft = item.left;
    } catch {
      // ignore detached nodes
    }
  });
}

function highlightPreviewText(text?: string) {
  const needle = clean(text);
  if (!needle || needle.length < 2) return;
  try {
    const doc = previewIframe()?.contentDocument;
    if (!doc?.body) return;
    const scrollSnapshot = snapshotPreviewScroll(doc);
    doc.querySelectorAll("[data-streams-code-selected='true']").forEach((node) => (node as HTMLElement).removeAttribute("data-streams-code-selected"));
    let style = doc.getElementById("streams-code-selected-style");
    if (!style) {
      style = doc.createElement("style");
      style.id = "streams-code-selected-style";
      style.textContent = `[data-streams-code-selected="true"]{outline:3px solid #22c55e!important;box-shadow:0 0 0 2px rgba(34,197,94,.5),0 0 24px rgba(34,197,94,.28)!important;background:rgba(34,197,94,.1)!important}`;
      doc.head.appendChild(style);
    }
    const lower = needle.toLowerCase();
    const nodes = Array.from(doc.body.querySelectorAll<HTMLElement>("[data-streams-editable='true'],h1,h2,h3,h4,h5,h6,p,span,b,strong,a,button,label,li,small,img,section,article,div"));
    const found = nodes.find((el) => clean(el.innerText || el.textContent).toLowerCase().includes(lower) || String(el.getAttribute("src") || "").includes(needle));
    if (!found) {
      restorePreviewScroll(scrollSnapshot);
      return;
    }
    found.dataset.streamsCodeSelected = "true";
    restorePreviewScroll(scrollSnapshot);
    requestAnimationFrame(() => restorePreviewScroll(scrollSnapshot));
  } catch {
    // Preview frame not ready yet.
  }
}

function bestQuery(payload: Record<string, unknown>) {
  return [payload.original, payload.text, payload.src]
    .map((value) => clean(String(value || "")))
    .find((value) => value.length > 2 && value.length < 240) || "";
}

export default function VisualEditorCodeDock() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const [activeFile, setActiveFile] = useState<ActiveFile>({});
  const [draft, setDraft] = useState("");

  function loadLatestFile() {
    const latest = readActiveFile();
    setActiveFile(latest);
    setDraft(latest.content || "");
    emit("code-dock-loaded", `Code editor opened ${latest.path || "the active file"}.`, { filePath: latest.path, repo: latest.repo, branch: latest.branch, route: latest.route, sha: latest.sha });
  }

  useEffect(() => {
    setMounted(true);
    const initial = readActiveFile();
    setActiveFile(initial);
    setDraft(initial.content || "");

    function refreshFile(event?: Event) {
      const detail = (event as CustomEvent<ActiveFile>)?.detail;
      const next = detail?.path ? detail : readActiveFile();
      setActiveFile(next || {});
      setDraft(next?.content || "");
      if (next?.path) emit("file-pulled", `Pulled file active: ${next.path}. Chat is tracking all saved and unsaved code/visual actions.`, { filePath: next.path, repo: next.repo, branch: next.branch, sha: next.sha });
    }

    function attachButton() {
      const visualEditor = document.querySelector<HTMLElement>(".visualEditor");
      const header = visualEditor?.querySelector<HTMLElement>(".top");
      const nextCanvas = visualEditor?.querySelector<HTMLElement>(".canvas.editor") || null;
      setCanvas(nextCanvas);
      if (!visualEditor || !header || header.querySelector("[data-visual-code-dock-button='true']")) return;

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Code Editor";
      button.dataset.visualCodeDockButton = "true";
      button.className = "visualCodeDockButton";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        loadLatestFile();
        setOpen((value) => !value);
      });
      header.append(button);
    }

    function routeFooterCodeButton(event: Event) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest?.("button") as HTMLButtonElement | null;
      if (!button || button.dataset.visualCodeDockButton === "true") return;
      if (button.textContent?.trim() !== "Code Editor") return;
      if (!button.closest(".visualEditor .sourceActionStrip")) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof (event as { stopImmediatePropagation?: () => void }).stopImmediatePropagation === "function") (event as { stopImmediatePropagation: () => void }).stopImmediatePropagation();
      const editorButton = document.querySelector<HTMLButtonElement>(".visualEditor .sourceActionStrip button.active");
      if (!editorButton || editorButton.textContent?.trim() !== "Editor") {
        const footerEditorButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".visualEditor .sourceActionStrip button")).find((item) => item.textContent?.trim() === "Editor");
        footerEditorButton?.click();
      }
      loadLatestFile();
      setOpen(true);
    }

    function onPreviewMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.source !== "streams-editable-preview") return;
      const query = bestQuery(data.payload || {});
      if (query) window.dispatchEvent(new CustomEvent("streams-builder:code-editor-command", { detail: { action: "locate", query } }));
      if (data.type === "streams-editable-select") emit("visual-selection", `Selected preview element: ${query || "element"}. Code editor is locating the source without opening Find/Search.`, { selectedText: query });
      if (data.type === "streams-editable-input") emit("visual-input", `Unsaved visual typing detected: ${query || "text edit"}. Save Draft is required before review.`, { selectedText: query });
      if (String(data.type || "").includes("commit") || String(data.type || "").includes("remove") || String(data.type || "").includes("style") || String(data.type || "").includes("replace")) emit("visual-edit", "Unsaved visual change detected. Save Draft is required before review.", { selectedText: query });
    }

    function onCodeState(event: Event) {
      const selection = (event as CustomEvent<{ selection?: CodeSelection | null }>).detail?.selection;
      if (!selection?.text) return;
      highlightPreviewText(selection.text);
      emit("code-selection", `Selected code lines ${selection.startLine}-${selection.endLine}. Matching preview element is highlighted without scrolling the preview.`, { selectedText: selection.text.slice(0, 160) });
    }

    attachButton();
    window.addEventListener("streams-builder:pulled-file", refreshFile as EventListener);
    window.addEventListener("streams-builder:code-editor-state", onCodeState as EventListener);
    window.addEventListener("message", onPreviewMessage);
    document.addEventListener("click", routeFooterCodeButton, true);
    const timer = window.setInterval(attachButton, 600);
    const observer = new MutationObserver(attachButton);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("streams-builder:pulled-file", refreshFile as EventListener);
      window.removeEventListener("streams-builder:code-editor-state", onCodeState as EventListener);
      window.removeEventListener("message", onPreviewMessage);
      document.removeEventListener("click", routeFooterCodeButton, true);
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const visualEditor = document.querySelector<HTMLElement>(".visualEditor");
    visualEditor?.classList.toggle("visualCodeDockOpen", open);
    const button = visualEditor?.querySelector<HTMLButtonElement>("[data-visual-code-dock-button='true']");
    if (button) button.textContent = open ? "Close Code" : "Code Editor";
    if (button) button.classList.toggle("active", open);
  }, [open]);

  function handleDraftChange(next: string) {
    setDraft(next);
    const merged = { ...activeFile, content: next };
    setActiveFile(merged);
    writeActiveFile(merged);
    window.dispatchEvent(new CustomEvent("streams-builder:code-draft-changed", { detail: { ...merged, content: next, draftDirty: true, saved: false, patchState: "not_generated" } }));
    emit("manual-code-edit", `Manual code edit made in ${merged.path || "the open file"}. Save Draft is required before review.`, { filePath: merged.path, repo: merged.repo, branch: merged.branch, draftDirty: true, saved: false, patchState: "not_generated" });
  }

  if (!mounted || !open || !canvas) {
    return <style jsx global>{`
      .visualCodeDockButton{height:34px!important;border:1px solid rgba(148,163,184,.22)!important;border-radius:10px!important;background:#7c3aed!important;color:#fff!important;padding:0 14px!important;font-size:11px!important;font-weight:900!important;cursor:pointer!important;white-space:nowrap!important;margin-left:8px!important;}
      .visualCodeDockButton.active{background:rgba(6,95,70,.9)!important;border-color:#34d399!important;color:#6ee7b7!important;}
      .visualEditor.visualCodeDockOpen .canvas.editor .desktopFrame{left:50%!important;width:auto!important;}
    `}</style>;
  }

  return <>
    {createPortal(
      <section className="visualCodeDock" aria-label="Visual editor code dock">
        <RuntimeCodeEditor value={draft} filePath={activeFile.path || "no-file-selected"} sha={activeFile.sha} onChange={handleDraftChange} />
      </section>,
      canvas,
    )}
    <style jsx global>{`
      .visualCodeDockButton{height:34px!important;border:1px solid rgba(148,163,184,.22)!important;border-radius:10px!important;background:#7c3aed!important;color:#fff!important;padding:0 14px!important;font-size:11px!important;font-weight:900!important;cursor:pointer!important;white-space:nowrap!important;margin-left:8px!important;}
      .visualCodeDockButton.active{background:rgba(6,95,70,.9)!important;border-color:#34d399!important;color:#6ee7b7!important;}
      .visualEditor.visualCodeDockOpen .canvas.editor .desktopFrame{left:50%!important;width:auto!important;}
      .visualCodeDock{position:absolute;left:10px;top:10px;bottom:10px;width:calc(50% - 15px);z-index:10;display:grid;min-width:520px;overflow:hidden;background:#020617;border:1px solid rgba(124,58,237,.5);border-radius:14px;box-shadow:0 18px 44px rgba(0,0,0,.35);}
      @media(max-width:1180px){.visualCodeDock{width:calc(55% - 15px);min-width:460px}.visualEditor.visualCodeDockOpen .canvas.editor .desktopFrame{left:55%!important;}}
    `}</style>
  </>;
}
