"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import RuntimeCodeEditor from "./RuntimeCodeEditor";

type ActiveFile = { repo?: string; branch?: string; path?: string; folder?: string; sha?: string; content?: string; route?: string };

function readActiveFile(): ActiveFile {
  try {
    const raw = window.localStorage.getItem("streams-builder:active-file");
    return raw ? JSON.parse(raw) as ActiveFile : {};
  } catch {
    return {};
  }
}

function writeActiveFile(next: ActiveFile) {
  try {
    window.localStorage.setItem("streams-builder:active-file", JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("streams-builder:pulled-file", { detail: next }));
  } catch {
    // Ignore storage failures; the visible editor still updates locally.
  }
}

export default function VisualEditorCodeDock() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const [activeFile, setActiveFile] = useState<ActiveFile>({});
  const [draft, setDraft] = useState("");

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
        const latest = readActiveFile();
        setActiveFile(latest);
        setDraft(latest.content || "");
        setOpen((value) => !value);
      });
      header.append(button);
    }

    attachButton();
    window.addEventListener("streams-builder:pulled-file", refreshFile as EventListener);
    const timer = window.setInterval(attachButton, 600);
    const observer = new MutationObserver(attachButton);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("streams-builder:pulled-file", refreshFile as EventListener);
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
