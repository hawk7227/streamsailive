"use client";

import { useEffect } from "react";

export default function StreamsAIMobileKeyboardBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const shell = document.querySelector(".shell.mobile");
        if (!shell) return;
        const vv = window.visualViewport;
        const height = vv?.height || window.innerHeight;
        const offsetTop = vv?.offsetTop || 0;
        const keyboard = Math.max(0, Math.round(window.innerHeight - height - offsetTop));
        shell.classList.toggle("keyboardOpen", keyboard > 80);
        shell.style.setProperty("--keyboard", `${keyboard}px`);
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
      document.querySelector(".shell.mobile")?.classList.remove("keyboardOpen");
    };
  }, []);

  return null;
}
