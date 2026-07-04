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
  if (!panel || !composer) return;

  const baseStyles = {
    left: "50%",
    right: "auto",
    width: "min(1120px, calc(100vw - 520px))",
    "min-width": "640px",
    transform: "translateX(-50%)",
    "z-index": "90",
  };

  if (empty) {
    const panelRect = panel.getBoundingClientRect();
    const emptyRect = empty.getBoundingClientRect();
    const top = Math.round(Math.min(emptyRect.bottom - panelRect.top + 28, panelRect.height - 124));
    setImportant(composer, {
      ...baseStyles,
      top: `${Math.max(260, top)}px`,
      bottom: "auto",
    });
    panel.setAttribute("data-streams-empty-chat", "true");
    return;
  }

  setImportant(composer, {
    ...baseStyles,
    top: "auto",
    bottom: "24px",
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
