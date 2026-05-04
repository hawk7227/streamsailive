'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  brandedEventBus,
  ActivityTimingController,
  ACTIVITY_STREAM_CONFIG,
  type BrandedEvent,
  type ActivityStreamState,
} from './index';

// ── Hook ──────────────────────────────────────────────────────────────────────

const INITIAL_STATE: ActivityStreamState = {
  current: null,
  queue: [],
  history: [],
  isActive: false,
  startedAt: null,
  completedAt: null,
};

export function useActivityStream() {
  const [state, setState] = useState<ActivityStreamState>(INITIAL_STATE);
  const timingRef = useRef(new ActivityTimingController());
  const visibleSinceRef = useRef<number | null>(null);
  const queueRef = useRef<BrandedEvent[]>([]);
  const currentRef = useRef<BrandedEvent | null>(null);

  const flushNext = () => {
    setState((prev) => {
      const nextQueue = [...queueRef.current];
      const nextEvent = nextQueue.shift() ?? null;
      queueRef.current = nextQueue;
      currentRef.current = nextEvent;
      visibleSinceRef.current = nextEvent ? Date.now() : null;
      return {
        ...prev,
        current: nextEvent,
        queue: nextQueue,
        history: nextEvent
          ? [...prev.history, nextEvent].slice(-ACTIVITY_STREAM_CONFIG.maxHistory)
          : prev.history,
        isActive: Boolean(nextEvent),
        startedAt: prev.startedAt ?? (nextEvent ? Date.now() : null),
        completedAt: nextEvent ? null : Date.now(),
      };
    });
  };

  useEffect(() => {
    const unsubscribe = brandedEventBus.subscribe((event) => {
      if (timingRef.current.shouldDrop(event)) return;
      timingRef.current.markShown(event);

      const current = currentRef.current;
      const visibleSince = visibleSinceRef.current;
      const elapsed = current && visibleSince
        ? Date.now() - visibleSince
        : ACTIVITY_STREAM_CONFIG.minVisibleMs;

      if (!current) {
        queueRef.current = [];
        currentRef.current = event;
        visibleSinceRef.current = Date.now();
        setState((prev) => ({
          ...prev,
          current: event,
          queue: [],
          history: [...prev.history, event].slice(-ACTIVITY_STREAM_CONFIG.maxHistory),
          isActive: true,
          startedAt: prev.startedAt ?? Date.now(),
          completedAt: null,
        }));
        return;
      }

      queueRef.current = [...queueRef.current, event];
      setState((prev) => ({ ...prev, queue: [...queueRef.current] }));
      timingRef.current.scheduleNext(() => { flushNext(); }, elapsed);
    });

    return () => {
      unsubscribe();
      timingRef.current.clearPending();
    };

  }, []);

  return useMemo(() => ({
    current: state.current,
    queue: state.queue,
    history: state.history,
    isActive: state.isActive,
    reset: () => {
      queueRef.current = [];
      currentRef.current = null;
      visibleSinceRef.current = null;
      timingRef.current.clearPending();
      setState(INITIAL_STATE);
    },
    complete: () => {
      queueRef.current = [];
      currentRef.current = null;
      visibleSinceRef.current = null;
      timingRef.current.clearPending();
      setState((prev) => ({ ...prev, current: null, queue: [], isActive: false, completedAt: Date.now() }));
    },
  }), [state]);
}

// ── ActivityStreamBar component ───────────────────────────────────────────────
// Subtle inline status for the active assistant turn. No console-style panel.

export function ActivityStreamBar() {
  const { current, isActive } = useActivityStream();

  const label = isActive && current
    ? current.detail ?? current.label
    : 'Ready';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minHeight: 18,
      padding: '0 2px',
      color: isActive && current ? 'rgba(255,255,255,0.46)' : 'rgba(255,255,255,0.28)',
      fontSize: 11,
      lineHeight: 1.4,
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: isActive && current ? '#67e8f9' : 'rgba(255,255,255,0.22)',
        boxShadow: isActive && current ? '0 0 10px rgba(103,232,249,0.35)' : 'none',
        flexShrink: 0,
      }} />
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
    </div>
  );
}
