"use client";

import { useEffect } from "react";

const THINKING_TEXT = "✦ Thinking…";
const STILL_WORKING_TEXT = "✦ Still working…";
const FALLBACK_TEXT = "The live assistant is taking longer than expected. The message is saved; retry if this does not continue shortly.";
const STALL_NOTICE_MS = 3500;
const FALLBACK_NOTICE_MS = 9000;
const NEAR_BOTTOM_PX = 96;
const FINAL_SETTLE_MS = 650;
const READING_LOCK_MS = 900;

function getChatScroll() {
  return document.querySelector<HTMLElement>(".chatScroll") || document.querySelector<HTMLElement>(".splitChatScroll") || document.querySelector<HTMLElement>(".startChatSurface");
}

function isNearBottom(node: HTMLElement) {
  return node.scrollHeight - node.scrollTop - node.clientHeight <= NEAR_BOTTOM_PX;
}

function scrollToBottom(node: HTMLElement, behavior: ScrollBehavior = "smooth") {
  node.scrollTo({ top: node.scrollHeight, behavior });
}

function ensureResumeButton(node: HTMLElement) {
  let button = node.querySelector<HTMLButtonElement>(":scope > .streamsScrollResumeButton");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "streamsScrollResumeButton";
    button.textContent = "↓";
    button.setAttribute("aria-label", "Jump to latest response");
    button.addEventListener("click", () => {
      node.dataset.streamsReadingLocked = "0";
      node.dataset.streamsAutoScroll = "1";
      button?.classList.remove("visible");
      scrollToBottom(node, "smooth");
    });
    node.appendChild(button);
  }
  return button;
}

function lockReadingMode(node: HTMLElement) {
  node.dataset.streamsReadingLocked = "1";
  node.dataset.streamsAutoScroll = "0";
  node.dataset.streamsLockedScrollTop = String(node.scrollTop);
  node.dataset.streamsLastReadIntent = String(Date.now());
  ensureResumeButton(node).classList.add("visible");
}

function releaseReadingModeIfBottom(node: HTMLElement) {
  if (!isNearBottom(node)) return;
  node.dataset.streamsReadingLocked = "0";
  node.dataset.streamsAutoScroll = "1";
  node.dataset.streamsLockedScrollTop = "";
  ensureResumeButton(node).classList.remove("visible");
}

function restoreReadingPosition(node: HTMLElement) {
  if (node.dataset.streamsReadingLocked !== "1") return;
  const lockedTop = Number(node.dataset.streamsLockedScrollTop || node.scrollTop);
  if (Number.isFinite(lockedTop)) node.scrollTop = lockedTop;
  ensureResumeButton(node).classList.add("visible");
}

function tuneScrollTargets() {
  const node = getChatScroll();
  if (!node) return;

  if (!node.classList.contains("splitChatScroll")) node.classList.add("splitChatScroll");
  node.classList.add("streamsChatScrollTuned");

  if (!node.dataset.streamsAutoScroll) node.dataset.streamsAutoScroll = isNearBottom(node) ? "1" : "0";
  ensureResumeButton(node);
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

    if (!bubble.dataset.streamsThinkingSince) bubble.dataset.streamsThinkingSince = String(Date.now());

    if (!bubble.dataset.streamsStallTimer) {
      const stallTimer = window.setTimeout(() => {
        const currentText = bubble.textContent?.trim() || "";
        if (currentText === THINKING_TEXT) bubble.textContent = STILL_WORKING_TEXT;
        delete bubble.dataset.streamsStallTimer;
      }, STALL_NOTICE_MS);
      bubble.dataset.streamsStallTimer = String(stallTimer);
    }

    if (!bubble.dataset.streamsFallbackTimer) {
      const fallbackTimer = window.setTimeout(() => {
        const currentText = bubble.textContent?.trim() || "";
        if (currentText === THINKING_TEXT || currentText === STILL_WORKING_TEXT) bubble.textContent = FALLBACK_TEXT;
        delete bubble.dataset.streamsFallbackTimer;
      }, FALLBACK_NOTICE_MS);
      bubble.dataset.streamsFallbackTimer = String(fallbackTimer);
    }
  });
}

function tuneStreamingScroll() {
  const node = getChatScroll();
  if (!node) return;

  const resumeButton = ensureResumeButton(node);
  const readingLocked = node.dataset.streamsReadingLocked === "1";

  if (readingLocked) {
    restoreReadingPosition(node);
    return;
  }

  if (isNearBottom(node)) {
    node.dataset.streamsAutoScroll = "1";
    resumeButton.classList.remove("visible");
    window.requestAnimationFrame(() => scrollToBottom(node, "smooth"));
    return;
  }

  node.dataset.streamsAutoScroll = "0";
  resumeButton.classList.add("visible");
}

function finalSettle() {
  const node = getChatScroll();
  if (!node) return;
  window.clearTimeout(Number(node.dataset.streamsFinalSettleTimer || 0));
  const timer = window.setTimeout(() => {
    if (node.dataset.streamsReadingLocked === "1") return;
    if (isNearBottom(node)) scrollToBottom(node, "smooth");
  }, FINAL_SETTLE_MS);
  node.dataset.streamsFinalSettleTimer = String(timer);
}

function injectBehaviorStyles() {
  const id = "streams-ai-non-consolidated-chat-behavior";
  document.getElementById(id)?.remove();
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .streamsChatScrollTuned{position:relative;scroll-behavior:smooth;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;}
    .streamsScrollResumeButton{position:sticky;left:50%;bottom:calc(92px + env(safe-area-inset-bottom));z-index:75;width:38px;height:38px;margin:0 auto;border:1px solid rgba(148,163,184,.28);border-radius:999px;background:rgba(7,12,26,.92);color:#eef6ff;box-shadow:0 14px 38px rgba(0,0,0,.34),0 0 18px rgba(80,160,255,.18);backdrop-filter:blur(14px);display:grid;place-items:center;font-size:18px;line-height:1;opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .18s ease,transform .18s ease;}
    .streamsScrollResumeButton.visible{opacity:1;transform:translateY(0);pointer-events:auto;}
    .streamsChatScrollTuned[data-streams-reading-locked="1"]{scroll-behavior:auto;}
    .streamsChatScrollTuned .msg.assistant .bubble{transition:opacity .16s ease;}
    .streamsChatScrollTuned .msg.assistant .bubble .chatMarkdown{font-variant-ligatures:normal;text-rendering:optimizeLegibility;}
    @media (max-width:760px){.streamsScrollResumeButton{bottom:calc(82px + env(safe-area-inset-bottom));width:36px;height:36px;font-size:17px;}}
  `;
  document.head.appendChild(style);
  return style;
}

export default function StreamsAIChatBehaviorTuning() {
  useEffect(() => {
    const style = injectBehaviorStyles();
    tuneScrollTargets();
    tuneThinkingPlaceholders();
    tuneStreamingScroll();

    let lastKnownScrollTop = 0;
    let readIntentTimer = 0;

    const getNode = () => getChatScroll();

    const markReadIntent = () => {
      const node = getNode();
      if (!node) return;
      lockReadingMode(node);
      window.clearTimeout(readIntentTimer);
      readIntentTimer = window.setTimeout(() => {
        const latest = getNode();
        if (!latest) return;
        if (isNearBottom(latest)) releaseReadingModeIfBottom(latest);
      }, READING_LOCK_MS);
    };

    const handleWheel = (event: WheelEvent) => {
      const node = getNode();
      if (!node || !node.contains(event.target as Node)) return;
      if (event.deltaY < 0 || !isNearBottom(node)) markReadIntent();
    };

    const handlePointerDown = (event: PointerEvent) => {
      const node = getNode();
      if (!node || !node.contains(event.target as Node)) return;
      if ((event.target as HTMLElement).closest(".streamsScrollResumeButton")) return;
      markReadIntent();
    };

    const handleScroll = () => {
      const node = getNode();
      if (!node) return;
      const movedUp = node.scrollTop < lastKnownScrollTop - 6;
      lastKnownScrollTop = node.scrollTop;
      if (movedUp) markReadIntent();
      releaseReadingModeIfBottom(node);
    };

    const observer = new MutationObserver(() => {
      tuneScrollTargets();
      tuneThinkingPlaceholders();
      tuneStreamingScroll();
      finalSettle();
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });

    window.addEventListener("wheel", handleWheel, { passive: true, capture: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true, capture: true });
    window.addEventListener("resize", tuneScrollTargets);
    window.visualViewport?.addEventListener("resize", tuneScrollTargets);
    window.visualViewport?.addEventListener("scroll", tuneScrollTargets);

    const attachScroll = () => getNode()?.addEventListener("scroll", handleScroll, { passive: true });
    const detachScroll = () => getNode()?.removeEventListener("scroll", handleScroll);
    attachScroll();

    return () => {
      observer.disconnect();
      detachScroll();
      style.remove();
      window.clearTimeout(readIntentTimer);
      window.removeEventListener("wheel", handleWheel, { capture: true } as EventListenerOptions);
      window.removeEventListener("pointerdown", handlePointerDown, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", tuneScrollTargets);
      window.visualViewport?.removeEventListener("resize", tuneScrollTargets);
      window.visualViewport?.removeEventListener("scroll", tuneScrollTargets);
    };
  }, []);

  return null;
}
