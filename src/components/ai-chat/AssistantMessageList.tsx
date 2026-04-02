"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssistantMessage, type AssistantMessageShape } from "./AssistantMessage";

interface AssistantMessageListProps {
  messages: AssistantMessageShape[];
  streamingText?: string;
  streamingMode?: AssistantMessageShape["mode"];
  pending: boolean;
}

const BOTTOM_THRESHOLD = 72;

export function AssistantMessageList({ messages, streamingText, streamingMode, pending }: AssistantMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [followMode, setFollowMode] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);

  const updateFollowState = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - BOTTOM_THRESHOLD;
    setFollowMode(atBottom);
    if (atBottom) setUnseenCount(0);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (followMode) {
      anchorRef.current?.scrollIntoView({ block: "end", behavior: pending ? "auto" : "smooth" });
    } else {
      setUnseenCount((count) => count + 1);
    }
  }, [messages, pending, streamingText, followMode]);

  const jumpToLatest = useCallback(() => {
    anchorRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    setFollowMode(true);
    setUnseenCount(0);
  }, []);

  const statusCopy = useMemo(() => {
    if (!pending) return null;
    if (streamingText) return 'Responding…';
    return 'Thinking…';
  }, [pending, streamingText]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        onScroll={updateFollowState}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ minHeight: 0, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' as never }}
      >
        <div className="mx-auto flex max-w-[760px] flex-col gap-4">
          {messages.map((message, index) => (
            <AssistantMessage key={`${message.role}-${index}`} message={message} />
          ))}

          {pending && streamingText ? (
            <AssistantMessage message={{ role: "assistant", content: [{ type: "text", text: streamingText }], mode: streamingMode }} />
          ) : null}

          {statusCopy ? (
            <div className="flex items-center gap-2 pl-2 text-[12px] text-white/38">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cyan-300/70" />
              <span>{statusCopy}</span>
            </div>
          ) : null}

          <div ref={anchorRef} />
        </div>
      </div>

      {!followMode && unseenCount > 0 ? (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-[#0A0C10]/85 px-3 py-1.5 text-[12px] text-white/72 shadow-[0_8px_20px_rgba(0,0,0,0.28)] backdrop-blur-xl hover:border-white/20 hover:text-white"
          aria-label="Jump to latest"
        >
          Jump to latest{unseenCount > 1 ? ` · ${unseenCount}` : ''}
        </button>
      ) : null}
    </div>
  );
}
