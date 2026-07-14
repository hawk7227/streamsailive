"use client";

import { useEffect } from "react";

function activeMobileShell() {
  return document.querySelector(".streamsOperator");
}

export default function StreamsAIMobileKeyboardBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const shell = activeMobileShell();
        if (!shell || window.innerWidth >= 900) return;

        const viewport = window.visualViewport;
        const visibleHeight = viewport?.height || window.innerHeight;
        const offsetTop = viewport?.offsetTop || 0;
        const keyboardHeight = Math.max(0, Math.round(window.innerHeight - visibleHeight - offsetTop));

        shell.classList.toggle("keyboardOpen", keyboardHeight > 80);
        shell.style.setProperty("--streams-mobile-vh", `${Math.round(visibleHeight)}px`);
        shell.style.setProperty("--streams-keyboard-height", `${keyboardHeight}px`);
        shell.style.setProperty("--streams-viewport-offset-top", `${Math.round(offsetTop)}px`);
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    document.addEventListener("focusin", update, true);
    document.addEventListener("focusout", update, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update, true);
      document.removeEventListener("focusout", update, true);
      const shell = activeMobileShell();
      shell?.classList.remove("keyboardOpen");
      shell?.style.removeProperty("--streams-mobile-vh");
      shell?.style.removeProperty("--streams-keyboard-height");
      shell?.style.removeProperty("--streams-viewport-offset-top");
    };
  }, []);

  return null;
}
