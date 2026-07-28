import { memo, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import "./chat-markdown.css";

const STREAM_FRAME_MS = 48;
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
    if (distance < AUTO_SCROLL_WITHIN_PX) node.scrollTo({ top: node.scrollHeight, behavior: "auto" });
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

function ChatMarkdownMessage({ content }) {
  const fullMarkdown = useMemo(() => normalizeMarkdownContent(content), [content]);
  const [displayMarkdown, setDisplayMarkdown] = useState(fullMarkdown);
  const latestRef = useRef(fullMarkdown);
  const displayedRef = useRef(fullMarkdown);
  const timerRef = useRef(null);

  useEffect(() => {
    latestRef.current = fullMarkdown;

    if (!fullMarkdown.startsWith(displayedRef.current)) {
      displayedRef.current = fullMarkdown;
      setDisplayMarkdown(fullMarkdown);
      return undefined;
    }

    if (timerRef.current) return undefined;

    const flush = () => {
      timerRef.current = null;
      const latest = latestRef.current;
      if (latest === displayedRef.current) return;
      displayedRef.current = latest;
      setDisplayMarkdown(latest);
      scrollStreamingMessage();
    };

    timerRef.current = window.setTimeout(flush, STREAM_FRAME_MS);
    return undefined;
  }, [fullMarkdown]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  return <div className="chatMarkdown"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={{ p: Paragraph, code: CodeBlock, table: Table, a: SafeLink, h1: ({ children }) => <h1>{children}</h1>, h2: ({ children }) => <h2>{children}</h2>, h3: ({ children }) => <h3>{children}</h3>, h4: ({ children }) => <h4>{children}</h4>, ul: ({ children }) => <ul>{children}</ul>, ol: ({ children }) => <ol>{children}</ol>, li: ({ children }) => <li>{children}</li>, blockquote: ({ children }) => <blockquote>{children}</blockquote> }}>{displayMarkdown}</ReactMarkdown></div>;
}

export default memo(ChatMarkdownMessage);