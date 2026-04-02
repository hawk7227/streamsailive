import React from "react";
import { FileText, Download, ExternalLink, PlayCircle, Music2 } from "lucide-react";
import { VerificationBlock } from "./VerificationBlock";
import { AssistantCodeBlock } from "./AssistantCodeBlock";
import type { AssistantMode } from "@/lib/enforcement/types";
import { presentResponse } from "@/lib/assistant-ui/responsePresentation";

export interface MsgContent {
  type: "text" | "image_url" | "video_url" | "audio_url" | "document_url";
  text?: string;
  image_url?: { url: string };
  video_url?: { url: string };
  audio_url?: { url: string };
  document_url?: { url: string; title?: string };
}

export interface AssistantMessageProps {
  role: "user" | "assistant";
  content: MsgContent[];
  mode?: AssistantMode;
}

export type AssistantMessageShape = AssistantMessageProps;

export interface AssistantMessageComponentProps extends AssistantMessageProps {
  message?: AssistantMessageShape;
}

function renderDocument(url: string, title?: string): React.ReactNode {
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2 text-white/90">
        <FileText className="h-4 w-4" />
        <span className="text-sm font-medium">{title || "Document"}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/90 transition hover:bg-white/15"
        >
          <ExternalLink className="h-4 w-4" />
          Open
        </a>
        <a
          href={url}
          download
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/90 transition hover:bg-white/15"
        >
          <Download className="h-4 w-4" />
          Download
        </a>
      </div>
    </div>
  );
}

function renderImage(url: string): React.ReactNode {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <img src={url} alt="Generated image" className="block h-auto w-full object-cover" />
      <div className="flex flex-wrap gap-2 border-t border-white/10 p-3">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/90 transition hover:bg-white/15"
        >
          <ExternalLink className="h-4 w-4" />
          Open
        </a>
        <a
          href={url}
          download
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/90 transition hover:bg-white/15"
        >
          <Download className="h-4 w-4" />
          Download
        </a>
      </div>
    </div>
  );
}

export function AssistantMessage(props: AssistantMessageComponentProps) {
  const resolvedMessage: AssistantMessageShape = props.message ?? {
    role: props.role,
    content: props.content,
    mode: props.mode,
  };

  const { role, content, mode } = resolvedMessage;
  const isUser = role === "user";
  const text = content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("\n\n");

  const presentation = presentResponse(text, mode);
  const blocks = presentation.blocks;
  const proseClass = isUser ? "text-[#0A0C10]/90" : "text-white/84";

  return (
    <div
      className={[
        "max-w-[85%] rounded-3xl px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.18)]",
        isUser
          ? "ml-auto bg-[linear-gradient(180deg,#c9d6ff_0%,#e2e8ff_100%)]"
          : "mr-auto border border-white/10 bg-white/[0.05]",
      ].join(" ")}
    >
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3 key={`heading-${index}`} className="mb-2 text-[15px] font-semibold tracking-[-0.01em] text-white">
              {block.text}
            </h3>
          );
        }

        if (block.type === "bullet_list") {
          return (
            <ul key={`bullets-${index}`} className={`mb-3 ml-5 list-disc space-y-1 text-[15px] leading-7 ${proseClass}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`bullet-${index}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "code_block") {
          return <AssistantCodeBlock key={`code-${index}`} code={block.code} language={block.language} />;
        }

        return (
          <p key={`paragraph-${index}`} className={`mb-3 text-[15px] leading-7 tracking-[-0.01em] ${proseClass}`}>
            {block.text}
          </p>
        );
      })}

      {content.map((part, index) => {
        if (part.type === "image_url" && part.image_url?.url) {
          return <React.Fragment key={`image-${index}`}>{renderImage(part.image_url.url)}</React.Fragment>;
        }

        if (part.type === "video_url" && part.video_url?.url) {
          return (
            <div key={`video-${index}`} className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <video controls className="w-full" src={part.video_url.url} />
              <div className="flex gap-2 border-t border-white/10 p-3">
                <a
                  href={part.video_url.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/90 transition hover:bg-white/15"
                >
                  <PlayCircle className="h-4 w-4" />
                  Open
                </a>
                <a
                  href={part.video_url.url}
                  download
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/90 transition hover:bg-white/15"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </div>
            </div>
          );
        }

        if (part.type === "audio_url" && part.audio_url?.url) {
          return (
            <div key={`audio-${index}`} className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="mb-3 flex items-center gap-2 text-white/90">
                <Music2 className="h-4 w-4" />
                <span className="text-sm font-medium">Audio</span>
              </div>
              <audio controls className="w-full" src={part.audio_url.url} />
              <div className="mt-3 flex gap-2">
                <a
                  href={part.audio_url.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/90 transition hover:bg-white/15"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
                <a
                  href={part.audio_url.url}
                  download
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/90 transition hover:bg-white/15"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </div>
            </div>
          );
        }

        if (part.type === "document_url" && part.document_url?.url) {
          return (
            <React.Fragment key={`document-${index}`}>
              {renderDocument(part.document_url.url, part.document_url.title)}
            </React.Fragment>
          );
        }

        return null;
      })}

      {!isUser && text && /(?:verified|validation|checks? passed|proof)/i.test(text) ? (
        <div className="mt-3">
          <VerificationBlock text={text} />
        </div>
      ) : null}
    </div>
  );
}

export default AssistantMessage;
