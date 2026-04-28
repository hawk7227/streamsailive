'use client';

import { useCallback, useEffect, useRef } from 'react';

export interface CalmStreamOptions {
  tickMs?: number;
  minCharsPerTick?: number;
  maxCharsPerTick?: number;
  maxWordsPerTick?: number;
  commaPauseMs?: number;
  periodPauseMs?: number;
  paragraphPauseMs?: number;
}

export interface CalmStreamController {
  enqueue: (delta: string) => void;
  reset: (initialValue?: string) => void;
  flush: () => void;
  getVisibleText: () => string;
  getRawText: () => string;
}

const DEFAULTS: Required<CalmStreamOptions> = {
  tickMs: 45,
  minCharsPerTick: 6,
  maxCharsPerTick: 22,
  maxWordsPerTick: 4,
  commaPauseMs: 60,
  periodPauseMs: 120,
  paragraphPauseMs: 160,
};

function nextChunk(raw: string, visibleLength: number, options: Required<CalmStreamOptions>): string {
  const remaining = raw.slice(visibleLength);
  if (!remaining) return '';

  const hardLimit = Math.min(remaining.length, options.maxCharsPerTick);
  let end = Math.min(hardLimit, Math.max(options.minCharsPerTick, hardLimit));
  const slice = remaining.slice(0, hardLimit);

  let wordCount = 0;
  for (let i = 0; i < slice.length; i += 1) {
    const ch = slice[i];
    if (/\s/.test(ch)) wordCount += 1;
    if (wordCount >= options.maxWordsPerTick) {
      end = i + 1;
      break;
    }
  }

  const punctuationBreak = slice.search(/[,.!?;:]\s/);
  if (punctuationBreak >= options.minCharsPerTick - 1) {
    end = Math.min(end, punctuationBreak + 2);
  }

  const newlineBreak = slice.indexOf('\n');
  if (newlineBreak >= 0 && newlineBreak <= end && newlineBreak >= options.minCharsPerTick - 1) {
    end = newlineBreak + 1;
  }

  return remaining.slice(0, Math.max(1, end));
}

function pauseFor(chunk: string, options: Required<CalmStreamOptions>): number {
  if (/\n\s*\n$/.test(chunk)) return options.paragraphPauseMs;
  if (/[.!?]\s*$/.test(chunk)) return options.periodPauseMs;
  if (/[,;:]\s*$/.test(chunk)) return options.commaPauseMs;
  return 0;
}

export function useCalmStream(
  onVisibleText: (text: string) => void,
  options: CalmStreamOptions = {}
): CalmStreamController {
  const configRef = useRef<Required<CalmStreamOptions>>({ ...DEFAULTS, ...options });
  const onVisibleTextRef = useRef(onVisibleText);
  const rawRef = useRef('');
  const visibleRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    configRef.current = { ...DEFAULTS, ...options };
  }, [options]);

  useEffect(() => {
    onVisibleTextRef.current = onVisibleText;
  }, [onVisibleText]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pump = useCallback(() => {
    stopTimer();
    const options = configRef.current;

    if (visibleRef.current.length >= rawRef.current.length) return;

    const chunk = nextChunk(rawRef.current, visibleRef.current.length, options);
    if (!chunk) return;

    visibleRef.current += chunk;
    onVisibleTextRef.current(visibleRef.current);

    const extraPause = pauseFor(chunk, options);
    timerRef.current = setTimeout(pump, options.tickMs + extraPause);
  }, [stopTimer]);

  const enqueue = useCallback(
    (delta: string) => {
      if (!delta) return;
      rawRef.current += delta;
      if (!timerRef.current) {
        timerRef.current = setTimeout(pump, configRef.current.tickMs);
      }
    },
    [pump]
  );

  const reset = useCallback(
    (initialValue = '') => {
      stopTimer();
      rawRef.current = initialValue;
      visibleRef.current = initialValue;
      onVisibleTextRef.current(initialValue);
    },
    [stopTimer]
  );

  const flush = useCallback(() => {
    stopTimer();
    visibleRef.current = rawRef.current;
    onVisibleTextRef.current(visibleRef.current);
  }, [stopTimer]);

  const getVisibleText = useCallback(() => visibleRef.current, []);
  const getRawText = useCallback(() => rawRef.current, []);

  useEffect(() => stopTimer, [stopTimer]);

  return { enqueue, reset, flush, getVisibleText, getRawText };
}
