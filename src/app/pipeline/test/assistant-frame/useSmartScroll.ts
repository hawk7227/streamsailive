/**
 * src/app/pipeline/test/assistant-frame/useSmartScroll.ts
 *
 * Smart scroll hook for the assistant message list.
 *
 * Behaviour:
 *  - Auto-scrolls to bottom when new content arrives and user is at bottom
 *  - Pauses auto-scroll when user scrolls up
 *  - Resumes when user scrolls back to bottom (within THRESHOLD)
 *  - Exposes isAtBottom + jumpToBottom for the "Jump to latest" button
 *
 * Constraints:
 *  - Uses el.scrollTop = el.scrollHeight — no scrollIntoView
 *  - Scroll handler is rAF-throttled and passive
 *  - isAtBottom tracked as both state (render) and ref (effect reads)
 *  - Motion: opacity + transform only in the consuming component
 */

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { AssistantChatMessage } from "./useAssistantSession";

// Distance from scroll bottom that counts as "at bottom"
const AT_BOTTOM_THRESHOLD_PX = 80;

export type UseSmartScrollReturn = {
  /** Attach to the scrollable container div */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** True when the scroll position is within threshold of the bottom */
  isAtBottom: boolean;
  /** Scroll to bottom and resume auto-scroll */
  jumpToBottom: () => void;
};

export function useSmartScroll(
  messages: AssistantChatMessage[],
): UseSmartScrollReturn {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Dual-tracked: state drives render, ref lets effects read without deps
  const [isAtBottom, setIsAtBottom_] = useState(true);
  const isAtBottomRef = useRef(true);

  const setIsAtBottom = useCallback((value: boolean) => {
    isAtBottomRef.current = value;
    setIsAtBottom_(value);
  }, []);

  // rAF-throttled scroll handler — passive, one setState per frame
  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      setIsAtBottom(distanceFromBottom < AT_BOTTOM_THRESHOLD_PX);
    });
  }, [setIsAtBottom]);

  // Wire scroll listener to the container
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [handleScroll]);

  // Content version — changes on new message or streaming delta
  // Avoids passing the full messages array as an effect dep
  const lastMsg = messages[messages.length - 1];
  const contentVersion =
    messages.length * 10000 + (lastMsg?.content.length ?? 0);

  // Auto-scroll when content grows and user is at bottom
  // Reads isAtBottom via ref — no dep on state, avoids re-run on scroll
  useEffect(() => {
    if (!isAtBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [contentVersion]);

  const jumpToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setIsAtBottom(true);
  }, [setIsAtBottom]);

  return { scrollRef, isAtBottom, jumpToBottom };
}
