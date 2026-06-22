"use client";

import { useEffect } from "react";

const THINKING_TEXT = "✦ Thinking…";
const STILL_WORKING_TEXT = "✦ Still working…";
const FALLBACK_TEXT = "The live assistant is taking longer than expected. The message is saved; retry if this does not continue shortly.";
const STALL_NOTICE_MS = 3500;
const FALLBACK_NOTICE_MS = 9000;

function tuneScrollTargets() {
  document.querySelectorAll<HTMLElement>(".chatScroll").forEach((node) => {
    if (!node.classList.contains("splitChatScroll")) {
      node.classList.add("splitChatScroll");
    }
  });
}

function tuneThinkingPlaceholders() {
  const assistantBubbles = Array.from(document.querySelectorAll<HTMLElement>(".chatScroll .msg.assistant .bubble"));

  assistantBubbles.forEach((bubble) => {
    const text = bubble.textContent?.trim() || "";
    const isWaitingState = text === THINKING_TEXT || text === STILL_WORKING_TEXT;

    if (!isWaitingState) {
      delete bubble.dataset.streamsThinkingSince;
      delete bubble.dataset.streamsStallTimer;
      delete bubble.dataset.streamsFallbackTimer;
      return;
    }

    if (!bubble.dataset.streamsThinkingSince) {
      bubble.dataset.streamsThinkingSince = String(Date.now());
    }

    if (!bubble.dataset.streamsStallTimer) {
      const stallTimer = window.setTimeout(() => {
        const currentText = bubble.textContent?.trim() || "";
        if (currentText === THINKING_TEXT) {
          bubble.textContent = STILL_WORKING_TEXT;
        }
        delete bubble.dataset.streamsStallTimer;
      }, STALL_NOTICE_MS);

      bubble.dataset.streamsStallTimer = String(stallTimer);
    }

    if (!bubble.dataset.streamsFallbackTimer) {
      const fallbackTimer = window.setTimeout(() => {
        const currentText = bubble.textContent?.trim() || "";
        if (currentText === THINKING_TEXT || currentText === STILL_WORKING_TEXT) {
          bubble.textContent = FALLBACK_TEXT;
        }
        delete bubble.dataset.streamsFallbackTimer;
      }, FALLBACK_NOTICE_MS);

      bubble.dataset.streamsFallbackTimer = String(fallbackTimer);
    }
  });
}

export default function StreamsAIChatBehaviorTuning() {
  useEffect(() => {
    tuneScrollTargets();
    tuneThinkingPlaceholders();

    const observer = new MutationObserver(() => {
      tuneScrollTargets();
      tuneThinkingPlaceholders();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("resize", tuneScrollTargets);
    window.visualViewport?.addEventListener("resize", tuneScrollTargets);
    window.visualViewport?.addEventListener("scroll", tuneScrollTargets);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", tuneScrollTargets);
      window.visualViewport?.removeEventListener("resize", tuneScrollTargets);
      window.visualViewport?.removeEventListener("scroll", tuneScrollTargets);
    };
  }, []);

  return null;
}
