"use client";

import { useEffect } from "react";

function setStyle(node, styles) {
  if (!node) return;
  Object.entries(styles).forEach(([key, value]) => {
    node.style.setProperty(key, value, "important");
  });
}

function applyDesktopVisuals() {
  if (typeof window === "undefined" || window.innerWidth < 900) return;

  document.querySelectorAll(".microbar").forEach((node) => {
    setStyle(node, {
      display: "none",
      visibility: "hidden",
      height: "0",
      overflow: "hidden",
      "pointer-events": "none",
    });
  });

  document.querySelectorAll(".chatScroll").forEach((node) => {
    setStyle(node, {
      "padding-top": "28px",
      "padding-bottom": "120px",
      "scroll-padding-bottom": "120px",
    });
  });

  document.querySelectorAll(".composer").forEach((node) => {
    setStyle(node, {
      left: "24px",
      right: "24px",
      bottom: "24px",
      "z-index": "80",
    });
  });

  document.querySelectorAll(".streamsComposer").forEach((node) => {
    setStyle(node, {
      "min-height": "52px",
      padding: "5px",
      "border-radius": "28px",
      border: "1px solid rgba(168, 85, 247, 0.72)",
      background: "#ffffff",
      "box-shadow": "0 0 0 1px rgba(124, 58, 237, 0.12), 0 1px 2px rgba(0, 0, 0, 0.04), 0 10px 30px rgba(0, 0, 0, 0.08)",
      overflow: "visible",
      color: "#0f172a",
      "backdrop-filter": "none",
      "-webkit-backdrop-filter": "none",
    });
  });

  document.querySelectorAll(".streamsComposerRow").forEach((node) => {
    setStyle(node, {
      "min-height": "42px",
      display: "grid",
      "grid-template-columns": "38px minmax(0, 1fr) auto 34px 42px",
      "grid-template-rows": "42px",
      "grid-template-areas": "\"tools input mode mic send\"",
      "align-items": "center",
      gap: "8px",
      padding: "0",
    });
  });

  document.querySelectorAll(".streamsComposerIconButton").forEach((node) => {
    setStyle(node, {
      "grid-area": "tools",
      width: "34px",
      height: "34px",
      border: "0",
      "border-radius": "999px",
      background: "transparent",
      color: "#111827",
      "box-shadow": "none",
      "font-size": "26px",
      "line-height": "1",
      "font-weight": "300",
      display: "grid",
      "place-items": "center",
    });
  });

  document.querySelectorAll(".streamsComposerInput").forEach((node) => {
    setStyle(node, {
      "grid-area": "input",
      height: "42px",
      "min-width": "0",
      border: "0",
      outline: "none",
      background: "transparent",
      color: "#111827",
      "box-shadow": "none",
      "font-size": "16px",
      "line-height": "42px",
      "font-weight": "400",
      "letter-spacing": "-0.01em",
      "text-shadow": "none",
      transform: "none",
    });
  });

  document.querySelectorAll(".streamsComposerPill").forEach((node) => {
    setStyle(node, {
      "grid-area": "mode",
      height: "34px",
      "min-width": "auto",
      "max-width": "none",
      padding: "0 6px 0 10px",
      border: "0",
      "border-radius": "999px",
      background: "transparent",
      color: "#8a8a8a",
      "box-shadow": "none",
      "font-size": "15px",
      "line-height": "34px",
      "font-weight": "400",
      "white-space": "nowrap",
    });
  });

  document.querySelectorAll(".streamsComposerMicButton").forEach((node) => {
    setStyle(node, {
      "grid-area": "mic",
      width: "34px",
      height: "34px",
      margin: "0",
      padding: "0",
      border: "0",
      "border-radius": "999px",
      background: "transparent",
      color: "#111827",
      "box-shadow": "none",
      "font-size": "20px",
      "line-height": "34px",
      display: "grid",
      "place-items": "center",
    });
  });

  document.querySelectorAll(".streamsComposerSendButton").forEach((node) => {
    setStyle(node, {
      "grid-area": "send",
      width: "42px",
      height: "42px",
      border: "0",
      "border-radius": "999px",
      background: "#000000",
      color: "#ffffff",
      "box-shadow": "none",
      "font-size": "19px",
      "font-weight": "800",
      display: "grid",
      "place-items": "center",
    });
  });

  document.querySelectorAll(".streamsComposerAttachments").forEach((node) => {
    setStyle(node, {
      width: "100%",
      display: "flex",
      gap: "8px",
      "flex-wrap": "wrap",
      padding: "8px 10px 10px",
      "border-bottom": "1px solid rgba(168, 85, 247, 0.18)",
      "margin-bottom": "4px",
      "max-height": "150px",
      "overflow-y": "auto",
    });
  });
}

export default function StreamsAIDesktopVisualBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const id = "streams-ai-desktop-visual-bridge";
    document.getElementById(id)?.remove();
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @media (min-width: 900px) {
        .microbar { display: none !important; visibility: hidden !important; height: 0 !important; overflow: hidden !important; pointer-events: none !important; }
        .chatScroll { padding-top: 28px !important; padding-bottom: 120px !important; scroll-padding-bottom: 120px !important; }
        .composer { left: 24px !important; right: 24px !important; bottom: 24px !important; z-index: 80 !important; }
        .streamsComposer { min-height: 52px !important; padding: 5px !important; border-radius: 28px !important; border: 1px solid rgba(168, 85, 247, 0.72) !important; background: #ffffff !important; box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.12), 0 1px 2px rgba(0, 0, 0, 0.04), 0 10px 30px rgba(0, 0, 0, 0.08) !important; overflow: visible !important; color: #0f172a !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
        .streamsComposer::before, .streamsComposer::after { display: none !important; }
        .streamsComposer:focus-within { border-color: rgba(124, 58, 237, 0.9) !important; box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.18), 0 1px 2px rgba(0, 0, 0, 0.04), 0 10px 30px rgba(0, 0, 0, 0.08) !important; }
        .streamsComposerRow { min-height: 42px !important; display: grid !important; grid-template-columns: 38px minmax(0, 1fr) auto 34px 42px !important; grid-template-rows: 42px !important; grid-template-areas: "tools input mode mic send" !important; align-items: center !important; gap: 8px !important; padding: 0 !important; }
        .streamsComposerIconButton { grid-area: tools !important; width: 34px !important; height: 34px !important; border: 0 !important; border-radius: 999px !important; background: transparent !important; color: #111827 !important; box-shadow: none !important; font-size: 26px !important; line-height: 1 !important; font-weight: 300 !important; display: grid !important; place-items: center !important; }
        .streamsComposerInput { grid-area: input !important; height: 42px !important; min-width: 0 !important; border: 0 !important; outline: none !important; background: transparent !important; color: #111827 !important; box-shadow: none !important; font-size: 16px !important; line-height: 42px !important; font-weight: 400 !important; letter-spacing: -0.01em !important; text-shadow: none !important; transform: none !important; }
        .streamsComposerInput::placeholder { color: #8a8a8a !important; opacity: 1 !important; font-weight: 400 !important; }
        .streamsComposerPill { grid-area: mode !important; height: 34px !important; min-width: auto !important; max-width: none !important; padding: 0 6px 0 10px !important; border: 0 !important; border-radius: 999px !important; background: transparent !important; color: #8a8a8a !important; box-shadow: none !important; font-size: 15px !important; line-height: 34px !important; font-weight: 400 !important; white-space: nowrap !important; }
        .streamsComposerMicButton { grid-area: mic !important; width: 34px !important; height: 34px !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 999px !important; background: transparent !important; color: #111827 !important; box-shadow: none !important; font-size: 20px !important; line-height: 34px !important; display: grid !important; place-items: center !important; }
        .streamsComposerSendButton { grid-area: send !important; width: 42px !important; height: 42px !important; border: 0 !important; border-radius: 999px !important; background: #000000 !important; color: #ffffff !important; box-shadow: none !important; font-size: 19px !important; font-weight: 800 !important; display: grid !important; place-items: center !important; }
        .streamsComposerAttachments { width: 100% !important; display: flex !important; gap: 8px !important; flex-wrap: wrap !important; padding: 8px 10px 10px !important; border-bottom: 1px solid rgba(168, 85, 247, 0.18) !important; margin-bottom: 4px !important; max-height: 150px !important; overflow-y: auto !important; }
      }
    `;
    document.head.appendChild(style);

    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(applyDesktopVisuals);
    };

    run();
    const interval = window.setInterval(run, 600);
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    window.addEventListener("resize", run);

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      observer.disconnect();
      window.removeEventListener("resize", run);
      style.remove();
    };
  }, []);

  return null;
}
