"use client";

import React, { useEffect, useRef } from "react";
import { AssistantMessage, type AssistantMessageShape } from "./AssistantMessage";

interface AssistantMessageListProps {
  messages: AssistantMessageShape[];
  streamingText?: string;
  streamingMode?: AssistantMessageShape["mode"];
  pending: boolean;
}

export function AssistantMessageList({ messages, streamingText, streamingMode, pending }: AssistantMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    anchorRef.current?.scrollIntoView({ block: "end", behavior: pending ? "auto" : "smooth" });
  }, [messages, pending, streamingText]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 [scrollbar-gutter:stable]">
      <div className="mx-auto flex max-w-[760px] flex-col gap-4">
        {messages.map((message, index) => (
          <AssistantMessage key={`${message.role}-${index}`} message={message} />
        ))}

        {pending && streamingText ? (
          <AssistantMessage
            message={{
              role: "assistant",
              content: [{ type: "text", text: streamingText }],
              mode: streamingMode,
            }}
          />
        ) : null}

        <div ref={anchorRef} />
      </div>
    </div>
  );
}
