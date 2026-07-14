import { memo, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import "./chat-markdown.css";

const STREAM_PACING = { largeDeltaThresholdChars: 220, sentenceChunkMaxChars: 180, lineChunkMaxChars: 160, fallbackChunkMaxChars: 120, minimumChunkDelayMs: 24, maximumChunkDelayMs: 72, millisecondsPerCharacter: 0.55, autoScrollOnlyWithinPx: 220 };
const ACTION_STYLES = `
.startAssistantBody > .assistantMessageActions{display:none!important}
.chatResponseFooter{position:relative;display:flex;align-items:center;gap:10px;margin-top:14px;min-height:34px;color:#94a3b8;font-size:12px}
.chatResponseActions{display:flex;align-items:center;gap:3px}
.chatResponseActions>button,.chatResponseMore>button{width:32px;height:32px;border:0;border-radius:9px;background:transparent;color:#9aa6b8;font-size:17px;cursor:pointer;display:grid;place-items:center}
.chatResponseActions>button:hover,.chatResponseMore>button:hover,.chatResponseActions>button.isActive{background:rgba(148,163,184,.12);color:#f8fafc}
.chatResponseActions button:disabled{opacity:.45;cursor:not-allowed}
.chatResponseMore{position:relative}
.chatResponseMenu{position:absolute;left:0;bottom:40px;z-index:90;width:210px;padding:8px;border:1px solid rgba(148,163,184,.22);border-radius:16px;background:#fff;color:#111827;box-shadow:0 18px 50px rgba(0,0,0,.25)}
.chatResponseMenu button{width:100%;display:flex;align-items:center;gap:10px;border:0;background:transparent;color:#111827;padding:10px 12px;border-radius:10px;text-align:left;cursor:pointer;font-size:14px}
.chatResponseMenu button:hover{background:#f3f4f6}
.chatResponseTimestamp{padding:8px 12px;color:#8b8b8b;font-size:13px;border-bottom:1px solid #ececec;margin-bottom:4px}
.chatResponseTime{margin-left:auto;color:#7c8798;font-size:11px}
.chatResponseStatus{color:#c4b5fd;font-size:12px}
@media(max-width:640px){.chatResponseFooter{flex-wrap:wrap}.chatResponseTime{width:100%;margin-left:0}.chatResponseMenu{left:auto;right:0}}
`;

function normalizeMarkdownContent(content) { return String(content || "").replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trimEnd(); }
function getSafeHref(href = "") { const value = String(href || "").trim(); if (!value) return ""; if (/^(https?:|mailto:|tel:)/i.test(value)) return value; if (value.startsWith("/") || value.startsWith("#")) return value; return ""; }
function makeReadableChunks(text = "") { const value = String(text || ""); const pieces = []; const pattern = new RegExp(`([^.!?\\n]{1,${STREAM_PACING.sentenceChunkMaxChars}}[.!?]\\s+|[^\\n]{1,${STREAM_PACING.lineChunkMaxChars}}\\n+|\\S.{0,${STREAM_PACING.fallbackChunkMaxChars}}(?:\\s+|$))`, "g"); let match; while ((match = pattern.exec(value))) pieces.push(match[0]); return pieces.length ? pieces : value.match(new RegExp(`[\\s\\S]{1,${STREAM_PACING.fallbackChunkMaxChars}}`, "g")) || []; }
function scrollStreamingMessage() { if (typeof window === "undefined") return; window.requestAnimationFrame(() => { const node = [document.querySelector(".startChatSurface"), document.querySelector(".chatScroll"), document.querySelector(".splitChatScroll")].filter(Boolean)[0]; if (!node) return; const distance = node.scrollHeight - node.scrollTop - node.clientHeight; if (distance < STREAM_PACING.autoScrollOnlyWithinPx) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" }); }); }
function currentSessionId() { if (typeof window === "undefined") return ""; const parts = window.location.pathname.split("/").filter(Boolean); return parts[0] === "streams-ai" ? parts[1] || "" : ""; }
async function postMessageAction(payload) { const response = await fetch("/api/streams-ai/message-actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json().catch(() => ({})); if (!response.ok || data?.ok === false) throw new Error(data?.error || "Message action failed"); return data; }
function formatTimestamp(value) { const date = value ? new Date(value) : new Date(); if (Number.isNaN(date.getTime())) return ""; return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date); }

function CopyButton({ value }) { const [copied, setCopied] = useState(false); const copy = async () => { try { if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(value); else { const textarea = document.createElement("textarea"); textarea.value = value; textarea.setAttribute("readonly", ""); textarea.style.position = "fixed"; textarea.style.opacity = "0"; document.body.appendChild(textarea); textarea.select(); document.execCommand("copy"); textarea.remove(); } setCopied(true); window.setTimeout(() => setCopied(false), 1200); } catch { setCopied(false); } }; return <button type="button" className="chatCodeCopyButton" onClick={copy} aria-label="Copy code block">{copied ? "Copied" : "Copy"}</button>; }
function CodeBlock({ inline, className, children }) { const raw = String(children || "").replace(/\n$/, ""); const match = /language-([a-zA-Z0-9_-]+)/.exec(className || ""); const language = match?.[1] || "text"; const isBlock = !inline && (Boolean(match) || raw.includes("\n")); if (!isBlock) return <code className="chatInlineCode">{children}</code>; return <figure className="chatCodeBlock"><figcaption className="chatCodeHeader"><span>{language}</span><CopyButton value={raw} /></figcaption><pre className="chatCodePre" tabIndex={0}><code className={className}>{raw}</code></pre></figure>; }
function SafeLink({ children, href }) { const safeHref = getSafeHref(href); if (!safeHref) return <span>{children}</span>; const external = /^https?:/i.test(safeHref); return <a href={safeHref} target={external ? "_blank" : undefined} rel={external ? "noreferrer noopener" : undefined}>{children}</a>; }
function Table({ children }) { return <div className="chatTableWrap" role="region" aria-label="Scrollable table" tabIndex={0}><table>{children}</table></div>; }
function Paragraph({ children }) { return <p>{children}</p>; }

function ResponseActions({ content }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [messageMeta, setMessageMeta] = useState({ id: "", createdAt: "" });
  const wrapRef = useRef(null);
  const sessionId = currentSessionId();

  useEffect(() => {
    if (!sessionId || !content) return undefined;
    let cancelled = false;
    fetch(`/api/streams-ai/messages?sessionId=${encodeURIComponent(sessionId)}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.messages) ? data.messages : [];
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          const row = rows[index];
          if (row?.role === "assistant" && String(row?.content || "").trim() === content.trim()) {
            setMessageMeta({ id: row.id || "", createdAt: row.created_at || row.createdAt || "" });
            break;
          }
        }
      }).catch(() => {});
    return () => { cancelled = true; };
  }, [sessionId, content]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => { if (event.key === "Escape" || (event.type === "pointerdown" && wrapRef.current && !wrapRef.current.contains(event.target))) setMenuOpen(false); };
    window.addEventListener("keydown", close); window.addEventListener("pointerdown", close);
    return () => { window.removeEventListener("keydown", close); window.removeEventListener("pointerdown", close); };
  }, [menuOpen]);

  const log = (action, metadata = {}) => postMessageAction({ action, sessionId, messageId: messageMeta.id, content, metadata }).catch(() => {});
  const copy = async () => { await navigator.clipboard.writeText(content); setStatus("Copied"); log("copied"); window.setTimeout(() => setStatus(""), 1200); };
  const rate = (value) => { setFeedback(value); setStatus(value === "feedback_up" ? "Thanks for the feedback" : "Feedback recorded"); log(value); window.setTimeout(() => setStatus(""), 1400); };
  const share = async () => { if (navigator.share) await navigator.share({ title: "Streams response", text: content }); else await navigator.clipboard.writeText(content); setStatus(navigator.share ? "Shared" : "Copied for sharing"); log("shared"); window.setTimeout(() => setStatus(""), 1400); };
  const regenerate = async () => { if (busy) return; setBusy(true); setMenuOpen(false); setStatus("Regenerating…"); try { const key = `regenerate:${messageMeta.id || content.slice(0, 48)}`; await postMessageAction({ action: "regenerate", sessionId, messageId: messageMeta.id, content, idempotencyKey: key }); window.location.reload(); } catch (error) { setStatus(error instanceof Error ? error.message : "Regeneration failed"); setBusy(false); } };
  const branch = async () => { if (busy) return; setBusy(true); setStatus("Creating branch…"); try { const data = await postMessageAction({ action: "branch", sessionId, messageId: messageMeta.id, content }); window.location.assign(data.href || `/streams-ai/${data.sessionId}`); } catch (error) { setStatus(error instanceof Error ? error.message : "Branch failed"); setBusy(false); } };
  const readAloud = () => { setMenuOpen(false); if (!("speechSynthesis" in window)) { setStatus("Read aloud is unavailable in this browser"); return; } window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(content.replace(/```[\s\S]*?```/g, "Code block omitted.")); utterance.onstart = () => { setStatus("Reading aloud…"); log("read_aloud_started"); }; utterance.onend = () => { setStatus(""); log("read_aloud_completed"); }; utterance.onerror = () => setStatus("Read aloud stopped"); window.speechSynthesis.speak(utterance); };

  return <div className="chatResponseFooter" ref={wrapRef}>
    <style>{ACTION_STYLES}</style>
    <div className="chatResponseActions" aria-label="Response actions">
      <button type="button" onClick={copy} aria-label="Copy response">⧉</button>
      <button type="button" className={feedback === "feedback_up" ? "isActive" : ""} onClick={() => rate("feedback_up")} aria-label="Good response">♡</button>
      <button type="button" className={feedback === "feedback_down" ? "isActive" : ""} onClick={() => rate("feedback_down")} aria-label="Bad response">♧</button>
      <button type="button" onClick={share} aria-label="Share response">⇧</button>
      <button type="button" onClick={regenerate} disabled={busy} aria-label="Regenerate response">↻</button>
      <div className="chatResponseMore"><button type="button" onClick={() => { setMenuOpen((value) => !value); log("more_menu_opened"); }} aria-label="More response actions" aria-expanded={menuOpen}>•••</button>{menuOpen ? <div className="chatResponseMenu" role="menu"><div className="chatResponseTimestamp">Today, {formatTimestamp(messageMeta.createdAt)}</div><button type="button" onClick={branch}>↗ Branch in new chat</button><button type="button" onClick={readAloud}>◖ Read aloud</button></div> : null}</div>
    </div>
    <span className="chatResponseTime" title={messageMeta.createdAt || undefined}>{formatTimestamp(messageMeta.createdAt)}</span>
    {status ? <span className="chatResponseStatus" role="status" aria-live="polite">{status}</span> : null}
  </div>;
}

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

  return <div className="chatMarkdown"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={{ p: Paragraph, code: CodeBlock, table: Table, a: SafeLink, h1: ({ children }) => <h1>{children}</h1>, h2: ({ children }) => <h2>{children}</h2>, h3: ({ children }) => <h3>{children}</h3>, h4: ({ children }) => <h4>{children}</h4>, ul: ({ children }) => <ul>{children}</ul>, ol: ({ children }) => <ol>{children}</ol>, li: ({ children }) => <li>{children}</li>, blockquote: ({ children }) => <blockquote>{children}</blockquote> }}>{displayMarkdown}</ReactMarkdown>{fullMarkdown ? <ResponseActions content={fullMarkdown} /> : null}</div>;
}

export default memo(ChatMarkdownMessage);
