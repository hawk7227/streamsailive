"use client";

import { useEffect } from "react";

function setImportant(node, styles) {
  if (!node) return;
  for (const [key, value] of Object.entries(styles)) {
    node.style.setProperty(key, value, "important");
  }
}

function panelMetrics(main, panel) {
  const rect = (main || panel).getBoundingClientRect();
  const safeWidth = Math.max(280, Math.min(1120, Math.round(rect.width - 48)));
  const left = Math.round(rect.left + Math.max(24, (rect.width - safeWidth) / 2));
  return { rect, safeWidth, left };
}

function positionComposer() {
  if (typeof window === "undefined" || window.innerWidth < 900) return;

  const main = document.querySelector(".shell.desktop main, .shell.expanded main, .shell.collapsed main");
  const panel = document.querySelector(".chatPanel");
  const empty = document.querySelector(".chatPanel .empty");
  const composer = document.querySelector(".chatPanel .composer");
  const chatScroll = document.querySelector(".chatPanel .chatScroll");
  if (!panel || !composer || !chatScroll) return;

  const { safeWidth, left } = panelMetrics(main, panel);
  const widthPx = `${safeWidth}px`;
  const leftPx = `${left}px`;

  if (main) {
    setImportant(main, {
      height: "100%",
      "min-height": "0",
      overflow: "hidden",
    });
  }

  if (empty) {
    setImportant(panel, {
      height: "100%",
      "min-height": "0",
      display: "block",
      overflow: "hidden",
      position: "relative",
    });

    setImportant(chatScroll, {
      "min-height": "0",
      height: "100%",
      overflow: "auto",
      "padding-bottom": "138px",
      "scroll-padding-bottom": "138px",
    });

    const panelRect = panel.getBoundingClientRect();
    const emptyRect = empty.getBoundingClientRect();
    const top = Math.round(Math.min(emptyRect.bottom - panelRect.top + 28, panelRect.height - 124));
    setImportant(composer, {
      position: "absolute",
      left: "50%",
      right: "auto",
      top: `${Math.max(260, top)}px`,
      bottom: "auto",
      width: "min(1120px, calc(100% - 48px))",
      "min-width": "0",
      "max-width": "calc(100% - 48px)",
      transform: "translateX(-50%)",
      margin: "0",
      "z-index": "90",
      display: "block",
      "flex-shrink": "0",
    });
    panel.setAttribute("data-streams-empty-chat", "true");
    return;
  }

  const composerHeight = Math.max(72, Math.round(composer.getBoundingClientRect().height || 72));

  setImportant(panel, {
    height: "100%",
    "min-height": "0",
    display: "block",
    overflow: "hidden",
    position: "relative",
  });

  setImportant(chatScroll, {
    height: "100%",
    "min-height": "0",
    overflow: "auto",
    "overflow-y": "auto",
    "padding-bottom": `${composerHeight + 48}px`,
    "scroll-padding-bottom": `${composerHeight + 48}px`,
  });

  setImportant(composer, {
    position: "fixed",
    left: leftPx,
    right: "auto",
    top: "auto",
    bottom: "24px",
    width: widthPx,
    "min-width": "0",
    "max-width": "calc(100vw - 48px)",
    transform: "none",
    margin: "0",
    "z-index": "999",
    display: "block",
    "flex": "0 0 auto",
    "flex-shrink": "0",
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
    const interval = window.setInterval(run, 200);
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    window.addEventListener("resize", run);
    window.visualViewport?.addEventListener("resize", run);
    window.visualViewport?.addEventListener("scroll", run);

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      observer.disconnect();
      window.removeEventListener("resize", run);
      window.visualViewport?.removeEventListener("resize", run);
      window.visualViewport?.removeEventListener("scroll", run);
    };
  }, []);

  return null;
}
