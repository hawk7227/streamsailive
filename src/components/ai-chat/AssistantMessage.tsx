"use client";

import React, { Fragment } from "react";
import { VerificationBlock } from "./VerificationBlock";
import { AssistantCodeBlock } from "./AssistantCodeBlock";
import type { AssistantMode } from "@/lib/enforcement/types";
import { presentResponse } from "@/lib/assistant-ui/responsePresentation";
export interface MsgContent {
  type: "text" | "image_url" | "video_url" | "audio_url" | "document";
  text?: string;
  image_url?: { url: string };
  audio_url?: { url: string };
  document?: { url?: string; label?: string };
}

export interface AssistantMessageShape {
  role: "user" | "assistant" | "system" | "tool";
  content: string | MsgContent[];
  mode?: AssistantMode;
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold text-current">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return <code key={i} className="rounded-md border border-black/8 bg-black/[0.04] px-1.5 py-0.5 font-mono text-[0.84em] text-current/90 dark:border-white/10 dark:bg-white/[0.06]">{part.slice(1, -1)}</code>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function TextBlock({ text, mode, isUser }: { text: string; mode?: AssistantMode; isUser?: boolean }) {
  const hasAnyHeader = /VERIFIED:|NOT VERIFIED:|REQUIRES RUNTIME:|RISKS:/i.test(text);
  const isVerification = mode === "verification" || hasAnyHeader;

  if (isVerification) {
    const sectionStart = text.search(/VERIFIED:|NOT VERIFIED:|REQUIRES RUNTIME:|RISKS:/i);
    if (sectionStart === -1) return <p className="text-[13px] italic text-white/35">Analyzing...</p>;
    return <VerificationBlock text={text.slice(sectionStart)} />;
  }

  presentResponse(...)
 const presentation = presentResponse(text, mode);
 const blocks = presentation.blocks;
  const prose = isUser ? "text-[#0A0C10]/90" : "text-white/84";
  const heading = isUser ? "text-[#0A0C10]" : "text-white";

  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block, index) => {
        if (block.kind === "code") {
          return <AssistantCodeBlock key={`code-${index}`} code={block.code} language={block.language} />;
        }
        if (block.kind === "spacer") {
          return <div key={`spacer-${index}`} className="h-1.5" />;
        }
        if (block.kind === "heading") {
          const sizes = block.level === 1 ? "text-[15px]" : block.level === 2 ? "text-[14px]" : "text-[13px]";
          return <p key={`heading-${index}`} className={`${sizes} ${heading} font-semibold leading-6 tracking-[-0.01em]`}><InlineText text={block.text} /></p>;
        }
        if (block.kind === "bullet") {
          return (
            <div key={`bullet-${index}`} className="flex items-start gap-2 pl-0.5">
              <span className={`mt-1.5 min-w-[14px] text-[11px] ${isUser ? 'text-[#0A0C10]/45' : 'text-white/35'}`}>
                {block.ordered ? `${block.ordered}.` : '•'}
              </span>
              <p className={`m-0 text-[14px] leading-7 ${prose}`}><InlineText text={block.text} /></p>
            </div>
          );
        }
        return <p key={`paragraph-${index}`} className={`m-0 text-[14px] leading-7 ${prose} ${plan.density === 'light' ? 'max-w-[70ch]' : 'max-w-[78ch]'}`}><InlineText text={block.text} /></p>;
      })}
    </div>
  );
}

function MediaBlock({ block }: { block: MsgContent }) {
  if (block.type === "image_url" && block.image_url?.url) {
    return (
      <div className="mt-3 overflow-hidden rounded-2xl border border-white/8 bg-black/15">
        <img src={block.image_url.url} alt="assistant output" className="max-h-[420px] w-full object-cover" />
        <div className="flex items-center justify-end gap-2 border-t border-white/8 px-3 py-2 text-[11px] text-white/60">
          <a href={block.image_url.url} target="_blank" rel="noreferrer" className="rounded-full border border-white/12 px-3 py-1 hover:border-white/20 hover:text-white">Open</a>
          <a href={block.image_url.url} download className="rounded-full border border-white/12 px-3 py-1 hover:border-white/20 hover:text-white">Download</a>
        </div>
      </div>
    );
  }
  if (block.type === "video_url" && block.image_url?.url) {
    return <video src={block.image_url.url} className="mt-3 max-h-[360px] w-full rounded-2xl border border-white/10 bg-black/20" controls playsInline preload="metadata" />;
  }
  if (block.type === "audio_url" && block.audio_url?.url) {
    return <audio src={block.audio_url.url} className="mt-3 w-full" controls preload="metadata" />;
  }
  if (block.type === "document") {
    const href = block.document?.url;
    const label = block.document?.label ?? block.text ?? "Open document";
    return (
      <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
        {href ? <a href={href} target="_blank" rel="noreferrer" className="underline decoration-white/30 underline-offset-4">{label}</a> : label}
      </div>
    );
  }
  return null;
}

function ClipboardIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function AssistantMessage({ message }: { message: AssistantMessageShape }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isTool = message.role === "tool";
  const [copied, setCopied] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  function copyText() {
    const raw = typeof message.content === "string"
      ? message.content
      : message.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
    navigator.clipboard.writeText(raw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }).catch(() => {});
  }

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[10px] font-medium tracking-[0.14em] text-white/45">
          {typeof message.content === "string" ? message.content : "System"}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className={[
        "max-w-[88%] px-4 py-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.12)]",
        isUser
          ? "rounded-[26px] rounded-br-xl bg-white text-[#0A0C10]"
          : isTool
            ? "rounded-[26px] rounded-bl-xl border border-fuchsia-400/18 bg-fuchsia-500/8"
            : "rounded-[26px] rounded-bl-xl border border-white/8 bg-white/[0.045] backdrop-blur-xl",
      ].join(" ")}>
        {typeof message.content === "string" ? (
          <TextBlock text={message.content} mode={message.mode} isUser={isUser} />
        ) : (
          <div className="grid gap-3">
            {message.content.map((block, index) => (
              <div key={index}>
                {block.type === "text" && block.text ? <TextBlock text={block.text} mode={message.mode} isUser={isUser} /> : <MediaBlock block={block} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {!isUser && !isSystem && (
        <div className="mt-1.5 flex items-center gap-1.5 transition-opacity" style={{ opacity: hovered ? 1 : 0, pointerEvents: hovered ? 'auto' : 'none' }}>
          <button type="button" onClick={copyText} title={copied ? "Copied" : "Copy"} className="rounded-full border border-white/8 bg-white/[0.03] p-2 text-white/45 hover:border-white/16 hover:text-white/75">
            {copied ? <CheckIcon /> : <ClipboardIcon />}
          </button>
        </div>
      )}
    </div>
  );
}
