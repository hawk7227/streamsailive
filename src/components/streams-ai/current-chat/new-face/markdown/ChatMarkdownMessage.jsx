import { memo, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import "./chat-markdown.css";

const FRAME_MS = 18;
const SETTLE_MS = 220;
const AUTO_SCROLL_WITHIN_PX = 220;

function normalizeMarkdownContent(content) {
  return String(content || "").replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
}

function getSafeHref(href = "") {
  const value = String(href || "").trim();
  if (!value) return "";
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  if (value.startsWith("/") || value.startsWith("#")) return value;
  return "";
}

function scrollStreamingMessage() {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    const node = [
      document.querySelector(".operatorChatScroll"),
      document.querySelector(".startChatSurface"),
      document.querySelector(".chatScroll"),
      document.querySelector(".splitChatScroll"),
    ].find(Boolean);
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    if (distance < AUTO_SCROLL_WITHIN_PX) node.scrollTop = node.scrollHeight;
  });
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };
  return <button type="button" className="chatCodeCopyButton" onClick={copy} aria-label="Copy code block">{copied ? "Copied" : "Copy"}</button>;
}

function CodeBlock({ inline, className, children }) {
  const raw = String(children || "").replace(/\n$/, "");
  const match = /language-([a-zA-Z0-9_-]+)/.exec(className || "");
  const language = match?.[1] || "text";
  const isBlock = !inline && (Boolean(match) || raw.includes("\n"));
  if (!isBlock) return <code className="chatInlineCode">{children}</code>;
  return <figure className="chatCodeBlock"><figcaption className="chatCodeHeader"><span>{language}</span><CopyButton value={raw} /></figcaption><pre className="chatCodePre" tabIndex={0}><code className={className}>{raw}</code></pre></figure>;
}

function SafeLink({ children, href }) {
  const safeHref = getSafeHref(href);
  if (!safeHref) return <span>{children}</span>;
  const external = /^https?:/i.test(safeHref);
  return <a href={safeHref} target={external ? "_blank" : undefined} rel={external ? "noreferrer noopener" : undefined}>{children}</a>;
}

function Table({ children }) {
  return <div className="chatTableWrap" role="region" aria-label="Scrollable table" tabIndex={0}><table>{children}</table></div>;
}

function Paragraph({ children }) {
  return <p>{children}</p>;
}

function nextFrameLength(currentLength, targetLength) {
  const remaining = targetLength - currentLength;
  if (remaining <= 0) return targetLength;
  if (remaining > 240) return Math.min(targetLength, currentLength + 24);
  if (remaining > 80) return Math.min(targetLength, currentLength + 12);
  return Math.min(targetLength, currentLength + 5);
}

function ChatMarkdownMessage({ content }) {
  const canonical = useMemo(() => normalizeMarkdownContent(content), [content]);
  const [displayText, setDisplayText] = useState(canonical);
  const [settled, setSettled] = useState(true);
  const targetRef = useRef(canonical);
  const displayRef = useRef(canonical);
  const frameRef = useRef(null);
  const settleRef = useRef(null);

  useEffect(() => {
    targetRef.current = canonical;
    window.clearTimeout(settleRef.current);

    if (!canonical.startsWith(displayRef.current)) {
      displayRef.current = canonical;
      setDisplayText(canonical);
      setSettled(false);
    } else if (canonical !== displayRef.current) {
      setSettled(false);
    }

    const pump = () => {
      frameRef.current = null;
      const target = targetRef.current;
      const current = displayRef.current;
      if (current === target) {
        settleRef.current = window.setTimeout(() => setSettled(true), SETTLE_MS);
        return;
      }
      const end = nextFrameLength(current.length, target.length);
      const next = target.slice(0, end);
      displayRef.current = next;
      setDisplayText(next);
      scrollStreamingMessage();
      frameRef.current = window.setTimeout(pump, FRAME_MS);
    };

    if (!frameRef.current) frameRef.current = window.setTimeout(pump, FRAME_MS);
    return undefined;
  }, [canonical]);

  useEffect(() => () => {
    window.clearTimeout(frameRef.current);
    window.clearTimeout(settleRef.current);
  }, []);

  if (!settled) {
    return <div className="chatMarkdown chatMarkdownStreaming" aria-live="polite" aria-atomic="false">{displayText}<span className="chatStreamingCaret" aria-hidden="true" /></div>;
  }

  return <div className="chatMarkdown"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={{ p: Paragraph, code: CodeBlock, table: Table, a: SafeLink, h1: ({ children }) => <h1>{children}</h1>, h2: ({ children }) => <h2>{children}</h2>, h3: ({ children }) => <h3>{children}</h3>, h4: ({ children }) => <h4>{children}</h4>, ul: ({ children }) => <ul>{children}</ul>, ol: ({ children }) => <ol>{children}</ol>, li: ({ children }) => <li>{children}</li>, blockquote: ({ children }) => <blockquote>{children}</blockquote> }}>{displayText}</ReactMarkdown><style jsx>{`
    .chatMarkdownStreaming{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;min-height:1.5em}
    .chatStreamingCaret{display:inline-block;width:2px;height:1em;margin-left:2px;vertical-align:-.12em;background:currentColor;opacity:.7;animation:calmCaret 1s steps(1,end) infinite}
    @keyframes calmCaret{0%,48%{opacity:.7}49%,100%{opacity:0}}
  `}</style></div>;
}

export default memo(ChatMarkdownMessage);