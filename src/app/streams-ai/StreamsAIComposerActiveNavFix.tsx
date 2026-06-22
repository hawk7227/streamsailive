"use client";

import { useEffect } from "react";

export default function StreamsAIComposerActiveNavFix() {
  useEffect(() => {
    const id = "streams-ai-composer-active-nav-fix";
    document.getElementById(id)?.remove();

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .shell.mobile:has(.streamsComposer:focus-within) .mobileNav {
        transform: translateY(calc(100% + env(safe-area-inset-bottom))) !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      .shell.mobile:has(.streamsComposer:focus-within) .composer {
        bottom: calc(10px + env(safe-area-inset-bottom) + var(--keyboard)) !important;
      }

      .shell.mobile:has(.streamsComposer:focus-within) .chatScroll {
        padding-bottom: calc(98px + env(safe-area-inset-bottom) + var(--keyboard)) !important;
        scroll-padding-bottom: calc(98px + env(safe-area-inset-bottom) + var(--keyboard)) !important;
      }

      .shell.mobile .mobileNav {
        transition: transform 180ms ease, opacity 160ms ease, visibility 160ms ease !important;
      }

      .shell.mobile .composer {
        transition: bottom 180ms ease !important;
      }
    `;

    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return null;
}
