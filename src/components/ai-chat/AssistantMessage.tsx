"use client";

import React, { Fragment } from "react";
import { VerificationBlock } from "./VerificationBlock";
import { AssistantCodeBlock } from "./AssistantCodeBlock";
import type { AssistantMode } from "@/lib/enforcement/types";

export interface MsgContent {
  type: "text" | "image_url" | "video_url" | "document";
  text?: string;
  image_url?: { url: string };
}

export interface AssistantMessageShape {
  role: "user" | "assistant" | "system" | "tool";
  content: string | MsgContent[];
  mode?: AssistantMode;
}

function splitCodeFence(text: string): Array<{ type: "text" | "code"; value: string; language?: string }> {
  const parts: Array<{ type: "text" | "code"; value: string; language?: string }> = [];
  const regex = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > cursor) {
      parts.push({ type: "text", value: text.slice(cursor, match.index) });
    }
    parts.push({ type: "code", language: match[1], value: match[2].trimEnd() });
    cursor = regex.lastIndex;
  }
  if (cursor < text.length) parts.push({ type: "text", value: text.slice(cursor) });
  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}

function TextBlock({ text, mode }: { text: string; mode?: AssistantMode }) {
  const parts = splitCodeFence(text);
  const isVerification = mode === "verification" || /VERIFIED:/i.test(text);

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "code") {
          return <AssistantCodeBlock key={`code-${index}`} code={part.value} language={part.language} />;
        }

        const cleaned = part.value.trim();
        if (!cleaned) return null;
        const paragraphs = cleaned.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);

        return (
          <Fragment key={`text-${index}`}>
            {paragraphs.map((paragraph, paragraphIndex) => (
              <p key={`p-${paragraphIndex}`} className="whitespace-pre-wrap text-[15px] leading-7 text-white/90">
                {paragraph}
              </p>
            ))}
            {isVerification && <VerificationBlock text={cleaned} />}
          </Fragment>
        );
      })}
    </>
  );
}

function MediaBlock({ block }: { block: MsgContent }) {
  if (block.type === "image_url" && block.image_url?.url) {
    return <img src={block.image_url.url} alt="assistant output" className="mt-3 max-h-[320px] w-full rounded-2xl object-cover" />;
  }
  if (block.type === "video_url" && block.image_url?.url) {
    return <video src={block.image_url.url} className="mt-3 max-h-[320px] w-full rounded-2xl" controls playsInline />;
  }
  if (block.type === "document" && block.text) {
    return <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">{block.text}</div>;
  }
  return null;
}

export function AssistantMessage({ message }: { message: AssistantMessageShape }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isTool = message.role === "tool";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          {typeof message.content === "string" ? message.content : "System"}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[88%] rounded-[24px] px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.16)]",
          isUser
            ? "rounded-br-lg bg-white text-[#0A0C10]"
            : isTool
              ? "rounded-bl-lg border border-fuchsia-400/20 bg-fuchsia-500/10"
              : "rounded-bl-lg border border-white/10 bg-white/[0.06] backdrop-blur-xl",
        ].join(" ")}
      >
        {typeof message.content === "string" ? (
          <TextBlock text={message.content} mode={message.mode} />
        ) : (
          <div className="grid gap-3">
            {message.content.map((block, index) => (
              <div key={index}>
                {block.type === "text" && block.text ? <TextBlock text={block.text} mode={message.mode} /> : <MediaBlock block={block} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
