'use client';

import { useCallback, useEffect, useRef } from 'react';

export interface SmartAutoScrollOptions {
  bottomThresholdPx?: number;
  throttleMs?: number;
}

export function useSmartAutoScroll<T extends HTMLElement>({
  bottomThresholdPx = 96,
  throttleMs = 100,
}: SmartAutoScrollOptions = {}) {
  const containerRef = useRef<T | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const isFollowingRef = useRef(true);
  const lastScrollAtRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const updateFollowState = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isFollowingRef.current = distanceFromBottom <= bottomThresholdPx;
  }, [bottomThresholdPx]);

  const onScroll = useCallback(() => {
    updateFollowState();
  }, [updateFollowState]);

  const scrollToBottom = useCallback(
    (options?: { force?: boolean; behavior?: ScrollBehavior }) => {
      const force = options?.force ?? false;
      const behavior = options?.behavior ?? 'smooth';
      if (!force && !isFollowingRef.current) return;

      const now = Date.now();
      const elapsed = now - lastScrollAtRef.current;
      if (!force && elapsed < throttleMs) return;
      lastScrollAtRef.current = now;

      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ block: 'end', behavior });
        frameRef.current = null;
      });
    },
    [throttleMs]
  );

  useEffect(() => {
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return {
    containerRef,
    bottomRef,
    onScroll,
    scrollToBottom,
    isFollowingRef,
    updateFollowState,
  };
}
