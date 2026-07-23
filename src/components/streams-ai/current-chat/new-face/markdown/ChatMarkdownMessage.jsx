import { memo, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import "./chat-markdown.css";

const STREAM_PACING = { largeDeltaThresholdChars: 220, sentenceChunkMaxChars: 180, lineChunkMaxChars: 160, fallbackChunkMaxChars: 120, minimumChunkDelayMs: 24, maximumChunkDelayMs: 72, millisecondsPerCharacter: 0.55, autoScrollOnlyWithinPx: 220 };

function normalizeMarkdownContent(content) { return String(content || "").replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trimEnd(); }
function getSafeHref(href = "") { const value = String(href || "").trim(); if (!value) return ""; if (/^(https?:|mailto:|tel:)/i.test(value)) return value; if (value.startsWith("/") || value.startsWith("#")) return value; return ""; }
function makeReadableChunks(text = "") { const value = String(text || ""); const pieces = []; const pattern = new RegExp(`([^.!?\\n]{1,${STREAM_PACING.sentenceChunkMaxChars}}[.!?]\\s+|[^\\n]{1,${STREAM_PACING.lineChunkMaxChars}}\\n+|\\S.{0,${STREAM_PACING.fallbackChunkMaxChars}}(?:\\s+|$))`, "g"); let match; while ((match = pattern.exec(value))) pieces.push(match[0]); return pieces.length ? pieces : value.match(new RegExp(`[\\s\\S]{1,${STREAM_PACING.fallbackChunkMaxChars}}`, "g")) || []; }
function scrollStreamingMessage() { if (typeof window === "undefined") return; window.requestAnimationFrame(() => { const node = [document.querySelector(".operatorChatScroll"), document.querySelector(".startChatSurface"), document.querySelector(".chatScroll"), document.querySelector(".splitChatScroll")].filter(Boolean)[0]; if (!node) return; const distance = node.scrollHeight - node.scrollTop - node.clientHeight; if (distance < STREAM_PACING.autoScrollOnlyWithinPx) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" }); }); }

function CopyButton({ value }) { const [copied, setCopied] = useState(false); const copy = async () => { try { if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(value); else { const textarea = document.createElement("textarea"); textarea.value = value; textarea.setAttribute("readonly", ""); textarea.style.position = "fixed"; textarea.style.opacity = "0"; document.body.appendChild(textarea); textarea.select(); document.execCommand("copy"); textarea.remove(); } setCopied(true); window.setTimeout(() => setCopied(false), 1200); } catch { setCopied(false); } }; return <button type="button" className="chatCodeCopyButton chatMarkdownAction" onClick={copy} aria-label="Copy code block">{copied ? "Copied" : "Copy"}</button>; }
function CodeBlock({ inline, className, children }) { const raw = String(children || "").replace(/\n$/, ""); const match = /language-([a-zA-Z0-9_-]+)/.exec(className || ""); const language = match?.[1] || "text"; const isBlock = !inline && (Boolean(match) || raw.includes("\n")); if (!isBlock) return <code className="chatInlineCode chatMarkdownArtifact">{children}</code>; return <figure className="chatCodeBlock chatMarkdownArtifact"><figcaption className="chatCodeHeader"><span>{language}</span><CopyButton value={raw} /></figcaption><pre className="chatCodePre" tabIndex={0}><code className={className}>{raw}</code></pre></figure>; }
function SafeLink({ children, href }) { const safeHref = getSafeHref(href); if (!safeHref) return <span>{children}</span>; const external = /^https?:/i.test(safeHref); return <a className="chatMarkdownLink chatMarkdownArtifact" href={safeHref} target={external ? "_blank" : undefined} rel={external ? "noreferrer noopener" : undefined}>{children}</a>; }
function Table({ children }) { return <div className="chatTableWrap chatMarkdownArtifact" role="region" aria-label="Scrollable table" tabIndex={0}><table>{children}</table></div>; }
function Paragraph({ children }) { return <p className="chatMarkdownBody">{children}</p>; }
function Heading({ level, children }) { const Tag = `h${level}`; return <Tag className="chatMarkdownHeading chatMarkdownArtifact">{children}</Tag>; }

function ChatMarkdownMessage({ content }) {
  const fullMarkdown = useMemo(() => normalizeMarkdownContent(content), [content]);
  const [displayMarkdown, setDisplayMarkdown] = useState(fullMarkdown);
  const initializedRef = useRef(false);
  const previousFullRef = useRef(fullMarkdown);
  const timerRef = useRef(null);

  useEffect(() => {
    window.clearTimeout(timerRef.current);
    if (!initializedRef.current) { initializedRef.current = true; previousFullRef.current = fullMarkdown; setDisplayMarkdown(fullMarkdown); return undefined; }
    const previous = previousFullRef.current || ""; previousFullRef.current = fullMarkdown;
    if (!fullMarkdown.startsWith(previous)) { setDisplayMarkdown(fullMarkdown); return undefined; }
    const delta = fullMarkdown.slice(previous.length); if (!delta) return undefined;
    if (delta.length < STREAM_PACING.largeDeltaThresholdChars) { setDisplayMarkdown(fullMarkdown); scrollStreamingMessage(); return undefined; }
    const chunks = makeReadableChunks(delta); let index = 0; let current = previous;
    const step = () => { const next = chunks[index]; if (!next) return; current += next; index += 1; setDisplayMarkdown(current); scrollStreamingMessage(); if (index < chunks.length) { const delay = Math.max(STREAM_PACING.minimumChunkDelayMs, Math.min(STREAM_PACING.maximumChunkDelayMs, next.length * STREAM_PACING.millisecondsPerCharacter)); timerRef.current = window.setTimeout(step, delay); } };
    step(); return () => window.clearTimeout(timerRef.current);
  }, [fullMarkdown]);

  return <div className="chatMarkdown"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={{ p: Paragraph, code: CodeBlock, table: Table, a: SafeLink, strong: ({ children }) => <strong className="chatMarkdownStrong chatMarkdownArtifact">{children}</strong>, em: ({ children }) => <em className="chatMarkdownEmphasis chatMarkdownArtifact">{children}</em>, h1: ({ children }) => <Heading level={1}>{children}</Heading>, h2: ({ children }) => <Heading level={2}>{children}</Heading>, h3: ({ children }) => <Heading level={3}>{children}</Heading>, h4: ({ children }) => <Heading level={4}>{children}</Heading>, ul: ({ children }) => <ul className="chatMarkdownList chatMarkdownArtifact">{children}</ul>, ol: ({ children }) => <ol className="chatMarkdownList chatMarkdownArtifact">{children}</ol>, li: ({ children }) => <li className="chatMarkdownListItem">{children}</li>, blockquote: ({ children }) => <blockquote className="chatMarkdownQuote chatMarkdownArtifact">{children}</blockquote> }}>{displayMarkdown}</ReactMarkdown></div>;
}

export default memo(ChatMarkdownMessage);
