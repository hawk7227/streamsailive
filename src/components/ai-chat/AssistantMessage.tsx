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
    if (match.index > cursor) parts.push({ type: "text", value: text.slice(cursor, match.index) });
    parts.push({ type: "code", language: match[1], value: match[2].trimEnd() });
    cursor = regex.lastIndex;
  }
  if (cursor < text.length) parts.push({ type: "text", value: text.slice(cursor) });
  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}

// Inline: bold + inline code chip
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code key={i} style={{
              fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
              fontSize: "0.85em",
              color: "#b91c1c",
              background: "#fef2f2",
              borderRadius: 4,
              padding: "1px 5px",
              border: "1px solid rgba(185,28,28,0.15)",
            }}>{part.slice(1, -1)}</code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// Single line — heading, bullet, numbered, or plain
function MarkdownLine({ line, isUser }: { line: string; isUser?: boolean }) {
  const color = isUser ? "rgba(10,12,16,0.9)" : "rgba(255,255,255,0.88)";

  if (/^### /.test(line)) return (
    <p style={{ fontSize: 14, fontWeight: 700, color: isUser ? "#0A0C10" : "#fff", marginTop: 10, marginBottom: 2 }}>
      <InlineText text={line.slice(4)} />
    </p>
  );
  if (/^## /.test(line)) return (
    <p style={{ fontSize: 15, fontWeight: 700, color: isUser ? "#0A0C10" : "#fff", marginTop: 12, marginBottom: 2 }}>
      <InlineText text={line.slice(3)} />
    </p>
  );
  if (/^# /.test(line)) return (
    <p style={{ fontSize: 16, fontWeight: 700, color: isUser ? "#0A0C10" : "#fff", marginTop: 14, marginBottom: 4 }}>
      <InlineText text={line.slice(2)} />
    </p>
  );
  if (/^[-*] /.test(line)) return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", paddingLeft: 4 }}>
      <span style={{ color: isUser ? "rgba(10,12,16,0.4)" : "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 3, flexShrink: 0 }}>•</span>
      <p style={{ fontSize: 14, lineHeight: 1.65, color, margin: 0 }}><InlineText text={line.slice(2)} /></p>
    </div>
  );
  const numMatch = line.match(/^(\d+)\. (.+)/);
  if (numMatch) return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", paddingLeft: 4 }}>
      <span style={{ color: isUser ? "rgba(10,12,16,0.4)" : "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 3, flexShrink: 0, minWidth: 16 }}>{numMatch[1]}.</span>
      <p style={{ fontSize: 14, lineHeight: 1.65, color, margin: 0 }}><InlineText text={numMatch[2]} /></p>
    </div>
  );
  return <p style={{ fontSize: 14, lineHeight: 1.65, color, margin: 0 }}><InlineText text={line} /></p>;
}

function TextBlock({ text, mode, isUser }: { text: string; mode?: AssistantMode; isUser?: boolean }) {
  const hasAnyHeader = /VERIFIED:|NOT VERIFIED:|REQUIRES RUNTIME:|RISKS:/i.test(text);
  const isVerification = mode === "verification" || hasAnyHeader;

  if (isVerification) {
    const sectionStart = text.search(/\bVERIFIED:|\bNOT VERIFIED:|\bREQUIRES RUNTIME:|\bRISKS:/i);
    if (sectionStart === -1) return <p className="text-[13px] text-white/35 italic">Analyzing...</p>;
    return <VerificationBlock text={text.slice(sectionStart)} />;
  }

  const parts = splitCodeFence(text);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {parts.map((part, index) => {
        if (part.type === "code") {
          return <AssistantCodeBlock key={`code-${index}`} code={part.value} language={part.language} />;
        }
        const cleaned = part.value.trim();
        if (!cleaned) return null;
        return (
          <Fragment key={`text-${index}`}>
            {cleaned.split("\n").map((line, li) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={li} style={{ height: 5 }} />;
              return <MarkdownLine key={li} line={trimmed} isUser={isUser} />;
            })}
          </Fragment>
        );
      })}
    </div>
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
          <TextBlock text={message.content} mode={message.mode} isUser={isUser} />
        ) : (
          <div className="grid gap-3">
            {message.content.map((block, index) => (
              <div key={index}>
                {block.type === "text" && block.text
                  ? <TextBlock text={block.text} mode={message.mode} isUser={isUser} />
                  : <MediaBlock block={block} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
