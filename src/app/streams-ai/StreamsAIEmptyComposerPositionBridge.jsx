"use client";

import { useEffect } from "react";

function setImportant(node, styles) {
  if (!node) return;
  for (const [key, value] of Object.entries(styles)) {
    node.style.setProperty(key, value, "important");
  }
}

function positionComposer() {
  if (typeof window === "undefined" || window.innerWidth < 900) return;

  const panel = document.querySelector(".chatPanel");
  const empty = document.querySelector(".chatPanel .empty");
  const composer = document.querySelector(".chatPanel .composer");
  const chatScroll = document.querySelector(".chatPanel .chatScroll");
  if (!panel || !composer || !chatScroll) return;

  const width = "min(1120px, calc(100vw - 520px))";

  setImportant(panel, {
    height: "100%",
    "min-height": "0",
    display: "grid",
    "grid-template-rows": "minmax(0, 1fr) auto",
    overflow: "hidden",
  });

  setImportant(chatScroll, {
    "min-height": "0",
    "overflow-y": "auto",
  });

  if (empty) {
    const panelRect = panel.getBoundingClientRect();
    const emptyRect = empty.getBoundingClientRect();
    const top = Math.round(Math.min(emptyRect.bottom - panelRect.top + 28, panelRect.height - 124));
    setImportant(composer, {
      position: "absolute",
      left: "50%",
      right: "auto",
      top: `${Math.max(260, top)}px`,
      bottom: "auto",
      width,
      "min-width": "640px",
      transform: "translateX(-50%)",
      margin: "0",
      "z-index": "90",
    });
    panel.setAttribute("data-streams-empty-chat", "true");
    return;
  }

  setImportant(composer, {
    position: "relative",
    left: "auto",
    right: "auto",
    top: "auto",
    bottom: "auto",
    width,
    "min-width": "640px",
    transform: "none",
    margin: "0 auto 24px",
    "z-index": "90",
  });

  panel.removeAttribute("data-streams-empty-chat");
}

export default function StreamsAIEmptyComposerPositionBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(positionComposer);
    };

    run();
    const interval = window.setInterval(run, 350);
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    window.addEventListener("resize", run);

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      observer.disconnect();
      window.removeEventListener("resize", run);
    };
  }, []);

  return null;
}
