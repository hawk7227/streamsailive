"use client";

function isMobileComposerViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 900 || window.matchMedia?.("(pointer: coarse)")?.matches;
}

function autosizeComposerTextarea(node) {
  if (!node) return;
  const maxHeight = window.innerWidth < 760 ? Math.min(150, Math.round(window.innerHeight * 0.32)) : 168;
  node.style.height = "0px";
  const nextHeight = Math.min(maxHeight, Math.max(30, node.scrollHeight));
  node.style.height = `${nextHeight}px`;
  node.style.overflowY = node.scrollHeight > maxHeight ? "auto" : "hidden";
}

function insertMobileNewline(textarea) {
  const start = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : textarea.value.length;
  const end = Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : start;
  textarea.setRangeText("\n", start, end, "end");
  textarea.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertLineBreak", data: null }));
  autosizeComposerTextarea(textarea);
}

function installStreamsComposerMobileEnterBridge() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__streamsComposerMobileEnterBridgeInstalled) return;
  window.__streamsComposerMobileEnterBridgeInstalled = true;

  const onKeyDown = (event) => {
    const target = event.target;
    if (!target?.classList?.contains("streamsComposerInput")) return;
    if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
    if (!isMobileComposerViewport()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    insertMobileNewline(target);
  };

  document.addEventListener("keydown", onKeyDown, true);
  window.__streamsComposerMobileEnterBridgeCleanup = () => {
    document.removeEventListener("keydown", onKeyDown, true);
    window.__streamsComposerMobileEnterBridgeInstalled = false;
  };
}

installStreamsComposerMobileEnterBridge();

export default function StreamsAIComposerMobileEnterBridge() {
  return null;
}
