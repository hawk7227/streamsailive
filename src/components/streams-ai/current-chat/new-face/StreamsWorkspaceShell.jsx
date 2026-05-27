"use client";
import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";


const STREAMS_SPLIT_PREVIEW_EVENT = "streams:split-preview";
const STREAMS_SPLIT_PREVIEW_LAST_KEY = "streams:split-preview:last";

function hasPreviewableContent(content = "") {
  return Boolean(extractPreviewSource(content));
}

function extractPreviewSource(content = "") {
  const value = String(content || "");
  const fenced = value.match(/```(?:html|tsx|jsx|react|javascript|js|typescript|ts)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]?.trim()) return fenced[1].trim();

  const htmlStart = value.search(/<!doctype html|<html[\s>]|<body[\s>]|<main[\s>]|<section[\s>]|<div[\s>]|<svg[\s>]/i);
  return htmlStart >= 0 ? value.slice(htmlStart).trim() : "";
}

function escapePreviewText(value = "") {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildPreviewHtmlFromSource(source = "") {
  const value = String(source || "").trim();

  if (/<!doctype html|<html[\s>]/i.test(value)) return value;

  if (/<svg[\s>]/i.test(value)) {
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b10;color:white}</style></head><body>${value}</body></html>`;
  }

  if (/<[a-z][\s\S]*>/i.test(value) && !/export\s+default|className=/.test(value)) {
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><style>body{margin:0;min-height:100vh;font-family:Inter,system-ui;background:#f7f7f8;color:#111}</style></head><body>${value}</body></html>`;
  }

  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Inter,system-ui;background:#0b0b10;color:white}main{width:min(760px,calc(100vw - 36px));border:1px solid rgba(255,255,255,.14);border-radius:30px;background:rgba(255,255,255,.08);padding:30px}pre{white-space:pre-wrap;overflow:auto;color:rgba(255,255,255,.82)}</style></head><body><main><pre>${escapePreviewText(value || "No previewable source was found.")}</pre></main></body></html>`;
}

function openAssistantMessageInPreview(content = "", title = "Assistant Preview") {
  if (typeof window === "undefined") return false;

  const sourceCode = extractPreviewSource(content);
  if (!sourceCode) return false;

  const detail = {
    action: "open",
    id: `assistant_preview_${Date.now()}`,
    title,
    kind: /export\s+default|className=/.test(sourceCode) ? "tsx" : "html",
    sourceVisible: false,
    conversationCodeSuppressed: true,
    previewPanelOpen: true,
    sourceCode,
    previewHtml: buildPreviewHtmlFromSource(sourceCode),
    repoFullName: "",
    branch: "",
    filePath: "assistant-message",
    fileSha: "",
  };

  try {
    window.sessionStorage.setItem(STREAMS_SPLIT_PREVIEW_LAST_KEY, JSON.stringify(detail));
  } catch {}

  window.dispatchEvent(new CustomEvent(STREAMS_SPLIT_PREVIEW_EVENT, { detail }));

  // If the preview pane was closed, React mounts it after this event.
  // Re-dispatch once after mount so the embedded preview receives the artifact.
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent(STREAMS_SPLIT_PREVIEW_EVENT, { detail }));
  }, 50);

  return true;
}



function openLatestAssistantCodeInPreview(messages = []) {
  const list = Array.isArray(messages) ? messages : [];

  for (let index = list.length - 1; index >= 0; index -= 1) {
    const message = list[index];

    if (!message || message.role !== "assistant") continue;

    const content = String(message.content || message.text || "");

    if (!hasPreviewableContent(content)) continue;

    return openAssistantMessageInPreview(content, "Latest Assistant Code");
  }

  return false;
}


function ChatInlineImage({ src, alt }) {
  const [loading, setLoading] = useState(true);

  return (
    <div style={{ 
      position: "relative", 
      borderRadius: "16px", 
      overflow: "hidden", 
      width: "200px", 
      height: "200px", 
      background: "#000", 
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }}>
      {loading && <Loader2 className="animate-spin" size={24} style={{ color: "#fff", position: "absolute" }} />}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoading(false)}
        style={{ 
          display: loading ? "none" : "block", 
          width: "100%", 
          height: "100%", 
          objectFit: "cover", 
          borderRadius: "16px" 
        }}
      />
    </div>
  );
}

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useMobileAppRuntime } from "@/lib/mobile/useMobileAppRuntime";
import { useStreamsChatRuntime } from "./hooks/useStreamsChatRuntime";
import ChatMarkdownMessage from "./markdown/ChatMarkdownMessage";
import InlineAssistantImageCard from "./media/InlineAssistantImageCard";
import ImageViewerModal from "./media/ImageViewerModal";
import GenerationActivityStrip from "./media/GenerationActivityStrip";
import StreamsComposer from "./composer/StreamsComposer";
import StreamsSplitPreview from "./preview/StreamsSplitPreview";
import { archiveArtifact, copyArtifactText, deleteArtifact, downloadArtifactText, moveArtifactToProject, pinArtifact, shareArtifactText, viewArtifactInfo } from "./artifact/artifactActions";
const navItems = ["Chat", "Editor", "Generate", "Reference", "Person", "Build", "Settings"];
const today = ["Urban morning vibe", "Brand campaign ideas", "Recipe suggestions"];
const yesterday = ["Quarterly report summary", "Website hero concepts"];
const moreItems = [
  ["image", "Images"],
  ["video", "Videos"],
  ["search", "Search"],
  ["cube", "Deep Research"],,

  "/* FORCE ChatGPT-style main conversation positioning */",
  ".startWorkspaceActive .startChatSurface{position:absolute!important;inset:0 0 118px 0!important;overflow-y:auto!important;padding:32px 24px 140px!important;display:block!important}",
  ".startWorkspaceActive .startConversationColumn{width:min(920px,calc(100% - 48px))!important;max-width:920px!important;margin:0 auto!important;display:flex!important;flex-direction:column!important;gap:28px!important}",
  ".startWorkspaceActive .startUserRow{width:100%!important;display:flex!important;justify-content:flex-end!important}",
  ".startWorkspaceActive .startUserBubble{max-width:680px!important;background:#000!important;color:#fff!important;border-radius:26px!important;padding:15px 20px!important;font-size:16px!important;line-height:1.45!important;white-space:pre-wrap!important}",
  ".startWorkspaceActive .startAssistantRow{width:100%!important;display:flex!important;justify-content:flex-start!important;align-items:flex-start!important;gap:14px!important}",
  ".startWorkspaceActive .startAssistantBody{width:100%!important;max-width:780px!important;color:#1c1c1c!important;font-size:16px!important;line-height:1.65!important}",
  ".startWorkspaceActive .startComposerWrap{left:50%!important;bottom:28px!important;transform:translateX(-50%)!important;width:min(860px,calc(100% - 96px))!important;z-index:50!important}",

];

const DEFAULT_ARTIFACT_TEXT = `import React from "react";

export default function PreviewSectionSample() {
  const tools = ["Chat", "Images", "Videos", "Search", "Deep Research"];

  return (
    <div className="preview-section">
      <h1>Streams Workspace</h1>
      <p>Live preview ready.</p>
      <input type="file" ref={fileInputRef} style={{ display: "none" }} multiple onChange={(event) => chatRuntime.uploadFiles(event.target.files)} />
      <button type="button" onClick={() => chatRuntime?.shareCurrentChat?.()}>Share chat</button>
</div>
  );
}
`;


const STREAM_FRONTEND_CONTRACT = {
  endpoint: "/api/ai-assistant",
  transport: "sse",
  events: { phase: "phase", textDelta: "text_delta", tool: "tool_call_started", artifact: "artifact_ready", done: "done", error: "error" },
  states: ["idle", "sending", "streaming", "tool_calling", "complete", "error"],
};

function getLayoutMode(w, h) {
  if (w < 768) return h >= w ? "mobilePortrait" : "mobileLandscape";
  if (w < 1100) return "tablet";
  return "desktop";
}

function useRuntime() {
  const read = () => {
    if (typeof window === "undefined") return { mode: "desktop", vh: 900, kb: 0, keyboard: false };
    const vv = window.visualViewport;
    const vh = vv ? vv.height : window.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    const kb = Math.max(0, Math.round(window.innerHeight - vh - top));
    return { mode: getLayoutMode(window.innerWidth, window.innerHeight), vh: Math.round(vh), kb, keyboard: kb > 80 };
  };
  const [runtime, setRuntime] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRuntime(read()));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);
  return runtime;
}

function makeMessage(role, content = "", status = "complete") {
  return { id: role + "-" + Date.now(), role, content, status, chunks: content ? [content] : [], toolCalls: [], artifacts: [], createdAt: new Date().toISOString() };
}

function applyStreamEvent(state, event) {
  if (!event) return state;
  if (event.type === "text_delta") {
    const last = state.messages[state.messages.length - 1];
    const msg = last?.role === "assistant" ? last : makeMessage("assistant", "", "streaming");
    const next = { ...msg, content: msg.content + (event.delta || ""), chunks: [...msg.chunks, event.delta || ""], status: "streaming" };
    return { ...state, status: "streaming", messages: last?.role === "assistant" ? [...state.messages.slice(0, -1), next] : [...state.messages, next] };
  }
  if (event.type === "tool_call_started") return { ...state, status: "tool_calling" };
  if (event.type === "artifact_ready") return { ...state, activeArtifactId: event.artifactId || state.activeArtifactId };
  if (event.type === "done") return { ...state, status: "complete" };
  if (event.type === "error") return { ...state, status: "error", error: event.error || "Stream failed" };
  return state;
}

function parseSSEEvent(line) {
  if (!line || !line.startsWith("data:")) return null;
  const value = line.slice(5).trim();
  if (!value || value === "[DONE]") return { type: "done" };
  try { return JSON.parse(value); } catch { return { type: "text_delta", delta: value }; }
}

function useStreamState() {
  const [stream, setStream] = useState({ status: "idle", messages: [], activeArtifactId: null, error: null });
  const receive = (event) => setStream((s) => applyStreamEvent(s, event));
  const addUser = (content) => setStream((s) => ({ ...s, status: "sending", messages: [...s.messages, makeMessage("user", content)] }));
  return { stream, receive, addUser, contract: STREAM_FRONTEND_CONTRACT };
}

function runTests() {
  const base = { status: "idle", messages: [], activeArtifactId: null, error: null };
  const result = applyStreamEvent(base, { type: "text_delta", delta: "Hi" });
  console.assert(result.messages[0].content === "Hi", "stream delta appends");
  console.assert(parseSSEEvent("data: [DONE]").type === "done", "SSE done parses");
  console.assert(getLayoutMode(390, 844) === "mobilePortrait", "mobile portrait detected");
  console.assert(getLayoutMode(900, 700) === "tablet", "tablet detected");
}

function Icon({ name, size = 20 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const icons = {
    logo: <><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></>,
    chat: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></>,
    bolt: <path d="M13 2L4 14h7l-1 8 10-13h-7z"/>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H21"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H21v20H6.5A2.5 2.5 0 0 1 4 19.5z"/></>,
    user: <><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></>,
    cube: <><path d="M21 16V8l-9-5-9 5v8l9 5z"/><path d="M3.5 8.5L12 13l8.5-4.5"/><path d="M12 22v-9"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M4.9 4.9L7 7"/><path d="M17 17l2.1 2.1"/><path d="M2 12h3"/><path d="M19 12h3"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    panel: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
    down: <path d="M6 9l6 6 6-6"/>,
    right: <path d="M9 18l6-6-6-6"/>,
    left: <path d="M15 18l-6-6 6-6"/>,
    dots: <><circle cx="5" cy="12" r="1.25"/><circle cx="12" cy="12" r="1.25"/><circle cx="19" cy="12" r="1.25"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.2-4.2"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>,
    upload: <><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M20 16v4H4v-4"/></>,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2"/><rect x="2" y="2" width="13" height="13" rx="2"/></>,
    up: <><path d="M7 10v11"/><path d="M15 5l-1 5h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 18.3 21H7l-4-1V10h4l5-8a2 2 0 0 1 3 2z"/></>,
    downvote: <><path d="M7 14V3"/><path d="M15 19l-1-5h5.5a2 2 0 0 0 2-2.3l-1.2-7A2 2 0 0 0 18.3 3H7L3 4v10h4l5 8a2 2 0 0 0 3-2z"/></>,
    download: <><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M20 21H4"/></>,
    refresh: <><path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12A9 9 0 0 1 18.5 5.8"/><path d="M18 2v4h4"/></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v5"/></>,
    stop: <rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor" stroke="none"/>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/></>,
    pin: <><path d="M12 17v5"/><path d="M5 17h14"/><path d="M16 3l5 5-4 4v4H7v-4L3 8l5-5z"/></>,
    archive: <><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9"/><path d="M10 13h4"/></>,
    trash: <><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></>,
    speaker: <><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9.5a4 4 0 0 1 0 5"/><path d="M19 7a8 8 0 0 1 0 10"/></>,
  };
  return <svg {...p}>{icons[name] || icons.logo}</svg>;
}

function CollapsibleThinking({ reasoning }) {
  const [expanded, setExpanded] = useState(false);
  if (!reasoning) return null;

  return (
    <div
      style={{
        margin: "0 0 12px 0",
        padding: "10px 14px",
        borderRadius: "12px",
        background: "rgba(240, 240, 240, 0.4)",
        border: "1px solid rgba(0, 0, 0, 0.05)",
        fontFamily: "var(--font-sans, Inter, sans-serif)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "none",
          border: "none",
          padding: 0,
          color: "#737373",
          fontSize: "14px",
          fontWeight: 500,
          cursor: "pointer",
          userSelect: "none",
          width: "100%",
          textAlign: "left",
          outline: "none",
        }}
      >
        <span style={{ color: "#6366f1", fontSize: "14px" }}>✦</span>
        <span style={{ flex: 1 }}>Thought process</span>
        <span
          style={{
            fontSize: "10px",
            color: "#a3a3a3",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease-in-out",
            display: "inline-block",
          }}
        >
          ▼
        </span>
      </button>
      {expanded && (
        <div
          style={{
            marginTop: "8px",
            paddingTop: "8px",
            borderTop: "1px solid rgba(0, 0, 0, 0.05)",
            fontSize: "13.5px",
            lineHeight: "1.6",
            color: "#525252",
            whiteSpace: "pre-wrap",
            fontFamily: "Consolas, Monaco, monospace",
            maxHeight: "320px",
            overflowY: "auto",
            scrollbarWidth: "thin",
          }}
        >
          {reasoning}
        </div>
      )}
    </div>
  );
}

function getInitials(nameOrEmail) {
  const value = String(nameOrEmail || "Streams User").trim();
  const parts = value.includes("@") ? [value[0]] : value.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "SU";
}

function Avatar({ label }) {
  return <div className="avatar">{getInitials(label)}</div>;
}

function MarkdownMessage({ content }) {
  const blocks = String(content || "").split(/\n{2,}/g);
  return <div className="markdownMessage">{blocks.map((block, index) => block.startsWith("- ") ? <ul key={index}>{block.split("\n").filter(Boolean).map((line, i) => <li key={i}>{line.replace(/^-\s*/, "")}</li>)}</ul> : <p key={index}>{block}</p>)}</div>;
}

function AccountMenu({ compact = false, onClose }) {
  const router = useRouter();
  const runtime = useMobileAppRuntime();
  const { user, profile, plan, usage, workspace, signOut } = useAuth();

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "Streams user";

  const displayEmail = user?.email || profile?.email || "Email unavailable";
  const planLabel = plan?.name || profile?.plan_id || "Free";
  const workspaceLabel = workspace?.name || "Workspace loading";
  const usageLabel = usage ? `${usage.used}/${usage.limit === "unlimited" ? "∞" : usage.limit} used` : "Usage loading";

  const rows = [
    ["cube", "My Plan & Modules", "/account/modules"],
    ["logo", "Upgrade / Add Modules", "/pricing"],
    ["bolt", "Credits / Usage", "/account/credits"],
    ["settings", "Personalization", "/account/personalization"],
    ["user", "Profile", "/account/profile"],
    ["settings", "Settings", "/account/settings"],
    ["book", "Language", "/account/language"],
    ["file", "Apps & Extensions", "/account/apps"],
    ["up", "Gift / Invite / Credits", "/account/gift"],
    ["book", "Help & Status", "/account/help"],
    ["right", "Learn more", "/account/learn-more"],
  ];

  const navigate = (href) => {
    onClose?.();
    router.push(href);
  };

  const logout = async () => {
    onClose?.();
    await signOut();
    router.push("/login");
  };

  const menu = (
    <div
      className={compact ? "accountMenu compact" : "accountMenu"}
      role="dialog"
      aria-label="Account menu"
      style={runtime.isMobile ? {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        top: "auto",
        width: "100%",
        maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - 24px)",
        overflowY: "auto",
        borderRadius: "24px 24px 0 0",
        padding: "18px 18px calc(18px + env(safe-area-inset-bottom, 0px))",
        zIndex: 600,
      } : undefined}
    >
      <div className="menuTop">
        <Avatar label={displayName}/>
        <div>
          <b>{displayName}</b>
          <span>{displayEmail}</span>
          <span>{workspaceLabel} · {planLabel} · {usageLabel}</span>
        </div>
        <button type="button" aria-label="Close account menu" onClick={onClose} style={{ border: 0, background: "transparent", minHeight: 44, minWidth: 44 }}>×</button>
      </div>

      {rows.map((row, i) => (
        <React.Fragment key={row[1]}>
          {(i === 3 || i === 9) && <hr/>}
          <button className="menuItem" type="button" onClick={() => navigate(row[2])}>
            <Icon name={row[0]}/>
            <span>{row[1]}</span>
            <Icon name="right" size={16}/>
          </button>
        </React.Fragment>
      ))}

      <hr/>
      <button className="menuItem danger" type="button" onClick={logout}>
        <Icon name="right"/>
        <span>Log out</span>
      </button>
    </div>
  );

  if (runtime.isMobile) {
    return (
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.28)",
          zIndex: 590,
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        <div onClick={(event) => event.stopPropagation()} style={{ width: "100%" }}>
          {menu}
        </div>
      </div>
    );
  }

  return menu;
}

function Sidebar({ open, setOpen }) {
  const { user, profile, plan } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "Streams user";

  const planLabel = plan?.name || profile?.plan_id || "Free";
  const closeAccount = () => setAccountOpen(false);

  if (!open) return <aside className="sidebar collapsed"><button className="railCollapse" onClick={() => setOpen(true)}><Icon name="panel"/></button><div className="railTop">{[["logo","Chat"],["edit","New chat"],["search","Search chats"],["pin","Projects"],["chat","Chat history"]].map(([icon, label]) => <button className="railIcon" key={label} onClick={() => setOpen(true)} aria-label={label}><Icon name={icon} size={label === "Search chats" ? 27 : 25}/></button>)}</div><button className="railAvatar" onClick={() => setAccountOpen(!accountOpen)}><Avatar label={displayName}/></button>{accountOpen && <AccountMenu compact onClose={closeAccount}/>}</aside>;
  return <aside className="sidebar"><div className="newRow"><button><Icon name="plus"/> New chat <Icon name="down" size={15}/></button><button className="collapseBtn" onClick={() => setOpen(false)}><Icon name="panel"/></button></div><div className="chatTools"><button><Icon name="search"/>Search chats</button><button><Icon name="file"/>Projects</button></div><WorkspaceNav moreOpen={moreOpen} setMoreOpen={setMoreOpen}/><Section title="Today" items={today} selected/><Section title="Yesterday" items={yesterday}/><div className="accountDock"><button className="accountButton" onClick={() => setAccountOpen(!accountOpen)}><Avatar label={displayName}/><span><b>{displayName}</b><em>{planLabel}</em></span><Icon name="right"/></button>{accountOpen && <AccountMenu onClose={closeAccount}/>}</div></aside>;
}

function WorkspaceNav({ moreOpen, setMoreOpen }) {
  const icons = ["chat", "edit", "bolt", "book", "user", "cube", "settings"];
  return <div className="workspaceNavSide">{navItems.map((item, index) => <React.Fragment key={item}><button className={index === 0 ? "activeSideTab" : ""}><Icon name={icons[index]}/><span>{item}</span></button>{index === 0 && <div className="moreBlock navMoreBlock"><button className="moreToggle" onClick={() => setMoreOpen(!moreOpen)}><span><Icon name="dots"/> More</span><Icon name={moreOpen ? "upChevron" : "down"} size={15}/></button>{moreOpen && <div className="list moreList">{moreItems.map(([icon, label]) => <button className="item moreItem" key={label}><Icon name={icon}/><span>{label}</span></button>)}</div>}</div>}</React.Fragment>)}</div>;
}

function Section({ title, items, selected }) {
  return <><div className="label">{title}</div><div className="list">{items.map((item, index) => <div className={"item " + (selected && index === 0 ? "sel" : "")} key={item}><Icon name="chat"/><span>{item}</span>{selected && index === 0 && <Icon name="dots"/>}</div>)}</div></>;
}


function SharePopover({ onClose }) {
  return <div className="sharePopover" role="dialog" aria-label="Share dialog"><div className="sharePopoverHeader"><b>Share 'Lumen Chat Workspace Ui'</b><button type="button" aria-label="Close share" onClick={onClose}>×</button></div><div className="shareRow"><input value="https://chatgpt.com/canvas/shared/..." readOnly /><button type="button" onClick={onClose}>Create link</button></div></div>;
}

function useCloseOnOutside(open, close) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!ref.current) return;
      if (!ref.current.contains(event.target)) close();
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return ref;
}

function blockedChatAction(actionName) {
  window.alert(`Blocked: real ${actionName} backend/action is not wired yet.`);
}


function blockedMessageAction(actionName) {
  window.alert(`Blocked: real ${actionName} backend/action is not wired yet.`);
}

function AssistantMessageActions({ message, chatRuntime }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState("");
  const menuRef = useCloseOnOutside(menuOpen, () => setMenuOpen(false));

  const text = String(message?.content || message?.text || "");

  const copyMessage = async () => {
    await navigator.clipboard?.writeText(text);
    setStatus("Copied");
    window.setTimeout(() => setStatus(""), 1200);
  };

  const blocked = (name) => {
    setMenuOpen(false);
    blockedMessageAction(name);
  };

  const viewSources = () => {
    setMenuOpen(false);
    const sources = Array.isArray(message?.sources) ? message.sources : [];
    if (!sources.length) {
      blockedMessageAction("view-sources: no real sources are attached to this message");
      return;
    }
    window.alert(sources.map((source, index) => `${index + 1}. ${source.title || source.url || source.id || "Source"}`).join("\n"));
  };

  const regenerate = () => {
    setMenuOpen(false);
    if (typeof chatRuntime?.regenerateMessage === "function") {
      chatRuntime.regenerateMessage(message?.id);
      return;
    }
    blockedMessageAction("regenerate-message");
  };

  return (
    <div className="assistantMessageActions" ref={menuRef}>
      <button type="button" aria-label="Copy message" onClick={copyMessage}>
        <Icon name="copy" size={16}/>
        <span>Copy</span>
      </button>
      <button type="button" aria-label="Like response" onClick={() => blocked("feedback-like")}>
        <span aria-hidden="true">👍</span>
      </button>
      <button type="button" aria-label="Dislike response" onClick={() => blocked("feedback-dislike")}>
        <span aria-hidden="true">👎</span>
      </button>
      <button type="button" aria-label="Share or export response" onClick={() => blocked("share-export-message")}>
        <Icon name="upload" size={16}/>
      </button>
      {hasPreviewableContent(text) ? (
        <button
          type="button"
          aria-label="Open in Preview"
          onClick={() => {
            const opened = openAssistantMessageInPreview(text, "Assistant Preview");
            if (!opened) setStatus("No HTML/code block found to preview.");
          }}
        >
          <Icon name="panel"/>
          <span>Preview</span>
        </button>
      ) : null}

      <button type="button" aria-label="Regenerate response" onClick={regenerate}>
        <Icon name="refresh" size={16}/>
        <span>Regenerate</span>
      </button>
      <div className="assistantMessageMore">
        <button
          type="button"
          aria-label="More message actions"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <Icon name="dots" size={16}/>
        </button>
        {menuOpen ? (
          <div className="assistantMessageMenu" role="menu" aria-label="Message actions">
            <button type="button" onClick={viewSources}>View sources</button>
            <button type="button" onClick={() => blocked("branch-in-new-chat")}>Branch in new chat</button>
            <button type="button" onClick={() => blocked("read-aloud")}>Read aloud</button>
          </div>
        ) : null}
      </div>
      {status ? <span className="assistantMessageActionStatus">{status}</span> : null}
    </div>
  );
}

function GlobalOverflowMenu({ onClose, openCode, openPreview, onCopy, onViewFiles, onMoveToProject, onPin, onArchive, onDelete } = {}) {
  const closeThen = (fn, fallbackName) => () => {
    if (typeof fn === "function") {
      fn();
    } else if (fallbackName) {
      blockedChatAction(fallbackName);
    }

    if (typeof onClose === "function") onClose();
  };

  return (
    <div className="globalOverflowMenu" role="menu" aria-label="Workspace menu">
      <div className="menuHeader">
        <span>Menu</span>
        <button type="button" className="menuClose" aria-label="Close menu" onClick={closeThen()}>×</button>
      </div>

      <button type="button" onClick={closeThen(onCopy)}><Icon name="copy"/>Copy</button>
      <button type="button" onClick={closeThen(openPreview)}><Icon name="panel"/>Open Preview Slide</button>
      <button type="button" onClick={closeThen(openCode)}><Icon name="edit"/>Open Code Editor</button>
      <button type="button" onClick={closeThen(onViewFiles, "view-files-in-chat")}><Icon name="file"/>View files in chat</button>
      <button type="button" onClick={closeThen(onMoveToProject, "move-to-project")}><Icon name="file"/>Move to project <Icon name="right" size={15}/></button>
      <button type="button" onClick={closeThen(onPin, "pin-chat")}><Icon name="pin"/>Pin chat</button>
      <button type="button" onClick={closeThen(onArchive, "archive-chat")}><Icon name="archive"/>Archive</button>
      <button type="button" className="danger" onClick={closeThen(onDelete, "delete-chat")}><Icon name="trash"/>Delete</button>
    </div>
  );
}



function WorkspaceTopActions({ openCode, openPreview }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const closeAll = () => {
    setMenuOpen(false);
    setShareOpen(false);
  };

  const wrapRef = useCloseOnOutside(menuOpen || shareOpen, closeAll);

  const copyAction = () => {
    navigator.clipboard?.writeText("Lumen Chat Workspace Ui");
  };

  return (
    <div className="workspaceActions" ref={wrapRef}>
      <button type="button" aria-label="Share" onClick={() => { setShareOpen(!shareOpen); setMenuOpen(false); }}>
        <Icon name="upload"/>Share
      </button>

      <button type="button" aria-label="Open Code Editor" onClick={openCode}>
        <Icon name="file"/>
      </button>

      <button type="button" aria-label="More" aria-expanded={menuOpen ? "true" : "false"} onClick={() => { setMenuOpen(!menuOpen); setShareOpen(false); }}>
        <Icon name="dots"/>
      </button>

      {shareOpen && <SharePopover onClose={() => setShareOpen(false)} />}
      {menuOpen && <GlobalOverflowMenu onClose={() => setMenuOpen(false)} openCode={openCode} openPreview={openPreview} onCopy={copyAction}/>}
    </div>
  );
}




function StartWorkspace({ openPreview, openCode, chatRuntime, onOpenSidebar }) {
  const messages = Array.isArray(chatRuntime?.messages) ? chatRuntime.messages : [];
  const hasMessages = messages.length > 0;
  const chatSurfaceRef = useRef(null);

  const isLoadingHistory = chatRuntime?.isLoadingMessages;

  useEffect(() => {
    const node = chatSurfaceRef.current;
    if (!node) return;

    requestAnimationFrame(() => {
      node.scrollTo({
        top: node.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [messages.length, chatRuntime?.isStreaming, chatRuntime?.activity?.phase]);

  return (
    <main className={(hasMessages || isLoadingHistory) ? "startWorkspace startWorkspaceActive" : "startWorkspace"}>
      <button
        type="button"
        className="mobileMenuToggle"
        aria-label="Open sidebar"
        onClick={onOpenSidebar}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <WorkspaceTopActions openCode={openCode} openPreview={openPreview} />

      {isLoadingHistory ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", color: "#666" }}>
          <Loader2 className="animate-spin" size={32} style={{ color: "#4f46e5" }} />
          <span style={{ fontSize: "15px", fontWeight: 500 }}>Loading chat...</span>
        </div>
      ) : !hasMessages ? (
        <h1>What are we building today?</h1>
      ) : (
        <section className="startChatSurface" aria-label="Chat conversation" ref={chatSurfaceRef}>
          <div className="startConversationColumn">
            {messages.map((message) => {
              const isUser = message.role === "user";

              return (
                <div
                  key={message.id}
                  className={isUser ? "startUserRow" : "startAssistantRow"}
                >
                  {isUser ? (
                    <div className="startUserBubble">
                      {message.attachments && message.attachments.length > 0 && (
                        <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
                          {message.attachments.map(att => {
                            const isImage = att.kind === "image" || (att.mimeType || "").startsWith("image/");
                            const previewUrl = att.url || att.storageUrl || att.publicUrl || att.previewUrl;
                            if (isImage && previewUrl) {
                              return <ChatInlineImage key={att.id} src={previewUrl} alt={att.name || "Image"} />;
                            }
                            return (
                              <div key={att.id} style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.15)", padding: "4px 10px", borderRadius: "16px", fontSize: "13px" }}>
                                <span style={{ fontSize: "14px" }}>📄</span>
                                <span style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name || "Attachment"}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {message.content || message.text || ""}
                    </div>
                  ) : (
                    <>
                      <div className="aiIcon"><Icon name="logo" /></div>
                      <div className="startAssistantBody">
                        <CollapsibleThinking reasoning={message.reasoning} />
                        {message.generatedImage ? (
                          <InlineAssistantImageCard
                            image={message.generatedImage}
                            onOpen={() => chatRuntime?.openImageViewer?.(message.generatedImage)}
                            onDownload={() => chatRuntime?.saveAsset?.(message.generatedImage)}
                            onCopyUrl={() => chatRuntime?.copyAsset?.(message.generatedImage)}
                            onShare={() => chatRuntime?.shareAsset?.(message.generatedImage)}
                          />
                        ) : (
                          <ChatMarkdownMessage content={message.content || message.text || ""} />
                        )}
                        <AssistantMessageActions message={message} chatRuntime={chatRuntime} />
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {chatRuntime?.isStreaming && ["image", "video", "image_to_video", "image_to_image"].includes(chatRuntime?.activity?.mode) ? (
              <GenerationActivityStrip activity={chatRuntime.activity} />
            ) : null}
            <div className="startChatSpacer" />
          </div>
        </section>
      )}

      <Composer chatRuntime={chatRuntime} />
    </main>
  );
}

function Composer({ chatRuntime }) {
  return (
    <div className="startComposerWrap">
      <StreamsComposer
        onSubmit={(payload) => {
          chatRuntime?.sendMessage({
            message: payload.message,
            composerMode: payload.composerMode,
            mode: payload.mode,
            webSearchEnabled: payload.webSearchEnabled,
          });
        }}
        onFilesSelected={(files) => {
          chatRuntime?.uploadFiles?.(files);
        }}
        onToolSelect={(tool) => {
          if (tool === "recent_files") {
            chatRuntime?.setActiveArtifact?.({ type: "library" });
          }
        }}
        onProviderChange={(provider) => {
          chatRuntime?.setSelectedProvider?.(provider);
        }}
        onModeChange={(mode) => {
          chatRuntime?.setSelectedMode?.(mode);
        }}
        libraryFiles={chatRuntime?.composerAttachments || []}
        onRemoveFile={(fileId) => {
          chatRuntime?.removeComposerAttachment?.(fileId);
        }}
        isStreaming={chatRuntime?.isStreaming}
      />
      <small>ChatGPT can make mistakes. Check important info. See <u>Cookie Preferences</u>.</small>
    </div>
  );
}

function SplitChatContext() {
  const data = useStreamState();
  const text = "";
  const active = data.stream.messages.find((m) => m.role === "assistant");
  return <main className="splitChatContext"><div className="splitChatScroll"><div className="splitAssistant"><div className="aiIcon"><Icon name="logo"/></div><div><MarkdownMessage content={(active && active.content) || text}/><div className="streamStateRow"><span>{data.stream.status}</span></div></div></div></div><div className="splitComposer"><div className="startComposer"><input placeholder="Ask anything" readOnly /></div><small>ChatGPT can make mistakes. Check important info. See <u>Cookie Preferences</u>.</small></div></main>;
}

function PreviewWorkspace({ mode, setMode, closePreview, openPreview, layoutMode, chatRuntime }) {
  const splitRef = useRef(null);
  const drag = useRef({ x: 0, w: 680 });
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window === "undefined") return 680;
    const saved = Number(window.localStorage.getItem("streams.previewSplit.leftWidth.v5"));
    return Number.isFinite(saved) ? saved : 680;
  });
  const [dragging, setDragging] = useState(false);

  const isMobile = layoutMode === "mobilePortrait" || layoutMode === "mobileLandscape";
  const chatMin = 540;
  const previewMin = workspaceWidth >= 1200 ? 520 : 360;

  const maxLeft = () => {
    if (!workspaceWidth) return 680;
    return Math.max(chatMin, workspaceWidth - previewMin);
  };

  const clamp = (value) => Math.min(maxLeft(), Math.max(chatMin, value));

  const persist = (value) => {
    const next = clamp(value);
    setLeftWidth(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("streams.previewSplit.leftWidth.v5", String(next));
    }
  };

  const startDrag = (x) => {
    drag.current = { x, w: leftWidth };
    setDragging(true);
  };

  useEffect(() => {
    if (!splitRef.current || typeof ResizeObserver === "undefined") return undefined;

    const measure = () => {
      const width = splitRef.current ? splitRef.current.getBoundingClientRect().width : 0;
      setWorkspaceWidth(width);
      setLeftWidth((current) => {
        const dynamicPreviewMin = width >= 1200 ? 520 : 360;
        const dynamicMax = Math.max(chatMin, width - dynamicPreviewMin);
        return Math.min(dynamicMax, Math.max(chatMin, current));
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(splitRef.current);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!dragging) return undefined;

    const move = (event) => {
      const x = event.touches ? event.touches[0]?.clientX : event.clientX;
      if (typeof x === "number") persist(drag.current.w + x - drag.current.x);
    };

    const stop = () => setDragging(false);

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", stop);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", stop);
    };
  }, [dragging, leftWidth, workspaceWidth]);

  const keyResize = (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      persist(leftWidth - 24);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      persist(leftWidth + 24);
    }
    if (event.key === "Home") {
      event.preventDefault();
      persist(chatMin);
    }
    if (event.key === "End") {
      event.preventDefault();
      persist(maxLeft());
    }
  };

  if (isMobile) return <div className="mobilePreviewShell"><StreamsSplitPreview
    embedded
    initialOpen
    onClose={closePreview}
    onOpenLatestPreview={() => {
      const opened = openLatestAssistantCodeInPreview(chatRuntime?.messages);
      if (!opened) {
        window.alert("No previewable assistant code found yet.");
      }
    }}
  /></div>;

  return <div ref={splitRef} className={dragging ? "previewWorkspace dragging" : "previewWorkspace"}><section className="previewLeftPane" style={{ width: clamp(leftWidth) }}>{mode === "code" ? <CodeEditorScreen openPreview={openPreview} openStart={() => setMode("start")}/> : <StartWorkspace openPreview={openPreview} openCode={() => setMode("code")} chatRuntime={chatRuntime}/>}</section><div className="splitHandle" role="separator" aria-orientation="vertical" aria-valuenow={clamp(leftWidth)} aria-valuemin={chatMin} aria-valuemax={maxLeft()} tabIndex={0} onMouseDown={(event) => startDrag(event.clientX)} onTouchStart={(event) => startDrag(event.touches[0].clientX)} onKeyDown={keyResize}><span/></div><StreamsSplitPreview
    embedded
    initialOpen
    onClose={closePreview}
    onOpenLatestPreview={() => {
      const opened = openLatestAssistantCodeInPreview(chatRuntime?.messages);
      if (!opened) {
        window.alert("No previewable assistant code found yet.");
      }
    }}
  /></div>;
}



function CodeArtifactPane({ openPreview, openStart, artifactText, setArtifactText }) {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const wrapRef = useCloseOnOutside(workspaceMenuOpen || shareOpen, () => {
    setWorkspaceMenuOpen(false);
    setShareOpen(false);
  });

  const copyCode = () => {
    navigator.clipboard?.writeText(artifactText);
  };

  const downloadCode = () => {
    const blob = new Blob([artifactText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "PreviewSectionSample.tsx";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="codeArtifactPane editorLivePane">
      <div className="codeShell editorLiveShell" ref={wrapRef}>
        <header className="codeTopbar editorLiveTopbar">
          <button type="button" className="artifactClose" aria-label="Close editor" onClick={openStart}>×</button>

          <div className="codeTitle">
            <b>Preview Section Sample</b><span> · typescript</span>
          </div>

          <div className="codePrimaryActions">
            <button type="button" onClick={copyCode}>Copy</button>
            <button type="button">Edit</button>
            <button type="button" onClick={downloadCode}>Download</button>
            <button type="button" className="activePreview" onClick={openPreview}>Preview</button>
          </div>

          <div className="codeGlobalActions">
            <button type="button" aria-label="Share code" onClick={() => { setShareOpen(!shareOpen); setWorkspaceMenuOpen(false); }}>
              <Icon name="upload"/>Share
            </button>

            {shareOpen && <SharePopover onClose={() => setShareOpen(false)} />}

            <button type="button" aria-label="Code file"><Icon name="file"/></button>

            <button
              type="button"
              className="ellipsisBtn"
              aria-label="Code menu"
              aria-expanded={workspaceMenuOpen ? "true" : "false"}
              onClick={() => { setWorkspaceMenuOpen(!workspaceMenuOpen); setShareOpen(false); }}
            >
              <Icon name="dots"/>
            </button>

            {workspaceMenuOpen && (
              <GlobalOverflowMenu
                onClose={() => setWorkspaceMenuOpen(false)}
                onCopy={copyCode}
                openPreview={openPreview}
                openCode={() => {}}
              />
            )}
          </div>
        </header>

        <textarea
          className="artifactEditorTextarea"
          value={artifactText}
          onChange={(event) => setArtifactText(event.target.value)}
          spellCheck={false}
          aria-label="Live code editor"
        />
      </div>
    </section>
  );
}



function CodeWorkspace({ setMode, openPreview, layoutMode, artifactText, setArtifactText, chatRuntime }) {
  const splitRef = useRef(null);
  const drag = useRef({ x: 0, w: 680 });
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window === "undefined") return 680;
    const saved = Number(window.localStorage.getItem("streams.codeSplit.leftWidth.v1"));
    return Number.isFinite(saved) ? saved : 680;
  });
  const [dragging, setDragging] = useState(false);

  const isMobile = layoutMode === "mobilePortrait" || layoutMode === "mobileLandscape";
  const chatMin = 540;
  const editorMin = workspaceWidth >= 1200 ? 560 : 380;

  const maxLeft = () => {
    if (!workspaceWidth) return 680;
    return Math.max(chatMin, workspaceWidth - editorMin);
  };

  const clamp = (value) => Math.min(maxLeft(), Math.max(chatMin, value));

  const persist = (value) => {
    const next = clamp(value);
    setLeftWidth(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("streams.codeSplit.leftWidth.v1", String(next));
    }
  };

  const startDrag = (x) => {
    drag.current = { x, w: leftWidth };
    setDragging(true);
  };

  useEffect(() => {
    if (!splitRef.current || typeof ResizeObserver === "undefined") return undefined;

    const measure = () => {
      const width = splitRef.current ? splitRef.current.getBoundingClientRect().width : 0;
      setWorkspaceWidth(width);
      setLeftWidth((current) => {
        const dynamicEditorMin = width >= 1200 ? 560 : 380;
        const dynamicMax = Math.max(chatMin, width - dynamicEditorMin);
        return Math.min(dynamicMax, Math.max(chatMin, current));
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(splitRef.current);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!dragging) return undefined;

    const move = (event) => {
      const x = event.touches ? event.touches[0]?.clientX : event.clientX;
      if (typeof x === "number") persist(drag.current.w + x - drag.current.x);
    };

    const stop = () => setDragging(false);

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", stop);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", stop);
    };
  }, [dragging, leftWidth, workspaceWidth]);

  const keyResize = (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      persist(leftWidth - 24);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      persist(leftWidth + 24);
    }
    if (event.key === "Home") {
      event.preventDefault();
      persist(chatMin);
    }
    if (event.key === "End") {
      event.preventDefault();
      persist(maxLeft());
    }
  };

  if (isMobile) return <CodeArtifactPane openPreview={openPreview} openStart={() => setMode("start")} artifactText={artifactText} setArtifactText={setArtifactText} />;

  return <div ref={splitRef} className={dragging ? "previewWorkspace dragging" : "previewWorkspace"}><section className="previewLeftPane" style={{ width: clamp(leftWidth) }}><StartWorkspace openPreview={openPreview} openCode={() => setMode("code")} chatRuntime={chatRuntime}/></section><div className="splitHandle" role="separator" aria-orientation="vertical" aria-valuenow={clamp(leftWidth)} aria-valuemin={chatMin} aria-valuemax={maxLeft()} tabIndex={0} onMouseDown={(event) => startDrag(event.clientX)} onTouchStart={(event) => startDrag(event.touches[0].clientX)} onKeyDown={keyResize}><span/></div><CodeArtifactPane openPreview={openPreview} openStart={() => setMode("start")} artifactText={artifactText} setArtifactText={setArtifactText} /></div>;
}

export default function LumenWorkspace({ chatRuntime: propChatRuntime, onOpenSidebar }) {
  const runtime = useRuntime();
  const internalChatRuntime = useStreamsChatRuntime();
  const chatRuntime = propChatRuntime || internalChatRuntime;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    const handler = (event) => {
      if (event?.detail?.action === "open") {
        console.info("[STREAMS_PREVIEW_EVENT_OPEN_PANE]", event.detail?.title || "Preview");
        setPreviewOpen(true);
      }
    };

    window.addEventListener(STREAMS_SPLIT_PREVIEW_EVENT, handler);
    return () => window.removeEventListener(STREAMS_SPLIT_PREVIEW_EVENT, handler);
  }, []);
  const [mode, setMode] = useState("start");
  const [lastAction, setLastAction] = useState("Ready");
  const [artifactText, setArtifactText] = useState(DEFAULT_ARTIFACT_TEXT);
  const actionLabel = chatRuntime.statusLabel || lastAction;
  const actionText = `Action: ${actionLabel} · ${runtime.mode}${runtime.keyboard ? " · keyboard" : ""}`;
useEffect(() => {
  const artifact = chatRuntime.activeArtifact;
  if (!artifact?.code) return;

  setArtifactText(artifact.code);

  if (artifact.preview) {
    setPreviewOpen(true);
  } else {
    setPreviewOpen(false);
    setMode("code");
  }
}, [chatRuntime.activeArtifact]);
  useEffect(() => { runTests(); }, []);
  const capture = (event) => { const button = event.target.closest?.("button"); if (!button || button.disabled) return; setLastAction((button.getAttribute("aria-label") || button.textContent || "button").trim()); };
  const className = (previewOpen ? "app previewMode" : "app") + " layout-" + runtime.mode + (runtime.keyboard ? " keyboardOpen" : "");
  return <div className="preview" onClickCapture={capture}>
    <button className="mobile-hamburger" onClick={onOpenSidebar}><Icon name="menu"/></button>
    <div className={className} data-layout-mode={runtime.mode} data-keyboard-open={runtime.keyboard ? "true" : "false"} style={{ "--vvh": runtime.vh + "px", "--keyboard-offset": runtime.kb + "px" }}><style>{css}</style><div className="work"><Sidebar open={sidebarOpen} setOpen={setSidebarOpen}/>{previewOpen ? <PreviewWorkspace mode={mode} setMode={setMode} layoutMode={runtime.mode} closePreview={() => setPreviewOpen(false)} openPreview={() => setPreviewOpen(true)} chatRuntime={chatRuntime}/> : mode === "code" ? <CodeWorkspace setMode={setMode} layoutMode={runtime.mode} openPreview={() => setPreviewOpen(true)} artifactText={artifactText} setArtifactText={setArtifactText} chatRuntime={chatRuntime}/> : <StartWorkspace
  openPreview={() => setPreviewOpen(true)}
  openCode={() => setMode("code")}
  chatRuntime={chatRuntime}
  onOpenSidebar={onOpenSidebar}
/>}</div>{actionText && !String(actionText).toLowerCase().includes("ready") ? <div className="actionStatus">{actionText}</div> : null}</div></div>;
}

const css = [
  "/* hide legacy floating snap/action overlays */",".snapPicClickButton,.snapPicClick,.snap-pic-click-floating{display:none!important}",".actionStatus{display:none!important}","/* legacy floating overlay kill switch */",".spc-floating,.spc-floating-hidden,.snapPicClickButton,.snapPicClick,.snap-pic-click-floating{display:none!important}",".actionStatus{display:none!important}",".assistantMessageActions{display:flex;align-items:center;gap:6px;margin-top:10px;color:#686868;position:relative}",".assistantMessageActions button{min-height:32px;border:0;background:transparent;color:#686868;border-radius:8px;padding:0 8px;display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer}",".assistantMessageActions button:hover{background:#f3f3f3;color:#111}",".assistantMessageMore{position:relative;display:inline-flex}",".assistantMessageMenu{position:absolute;left:0;top:38px;z-index:260;width:210px;border:1px solid #ddd;border-radius:14px;background:#fff;box-shadow:0 12px 34px rgba(0,0,0,.14);padding:8px}",".assistantMessageMenu button{width:100%;justify-content:flex-start;min-height:38px;color:#111;font-size:13px}",".assistantMessageActionStatus{font-size:12px;color:#2f7d32;margin-left:4px}","*{box-sizing:border-box}","body{margin:0;background:#fff}","button,input{font:inherit}","button{cursor:pointer}",".preview{width:100%;height:100vh;overflow:hidden;background:#fff}",".app{width:100%;height:100dvh;background:#fff;color:#111;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden}",".work{height:100dvh;width:100%;display:flex;position:relative;overflow:hidden}",".sidebar{width:360px;flex:none;border-right:1px solid #e5e5e5;display:flex;flex-direction:column;position:relative;background:#fff;min-height:0;overflow:hidden}",".sidebar.collapsed{width:74px;align-items:center;overflow:hidden;padding-bottom:0}",".railCollapse{position:absolute;top:24px;right:9px;width:28px;height:28px;border:0;background:#fff;border-radius:8px;display:grid;place-items:center}",".railTop{display:flex;flex-direction:column;align-items:center;gap:27px;padding-top:25px}",".railIcon,.railAvatar{width:42px;height:42px;border:0;background:#fff;display:grid;place-items:center}",".railAvatar{margin-top:auto;margin-bottom:22px}",".avatar{width:39px;height:39px;border-radius:50%;background:linear-gradient(135deg,#b35bd5,#7d3bb3);color:#fff;display:grid;place-items:center;font-size:13px;font-weight:720}.avatar.small{width:36px;height:36px}",".newRow{padding:24px 24px 16px;display:flex;align-items:center;gap:17px;flex-shrink:0}.newRow button:first-child{flex:1;height:42px;border:1px solid #dedede;border-radius:12px;background:#fff;display:flex;align-items:center;gap:12px;padding:0 13px}.collapseBtn{width:28px!important;border:0!important;background:#fff!important}",".chatTools,.workspaceNavSide{padding:0 20px 8px;display:flex;flex-direction:column;gap:2px;flex-shrink:0}.workspaceNavSide{padding-top:8px;padding-bottom:10px}.chatTools button,.workspaceNavSide button{min-height:40px;border:0;background:#fff;border-radius:12px;display:flex;align-items:center;gap:13px;padding:0 13px;color:#222;font-size:15px}.workspaceNavSide button:hover,.activeSideTab{background:#f1f1f1}.activeSideTab{font-weight:650}",".label{padding:14px 28px 0;color:#707070;font-size:12px;font-weight:610;flex-shrink:0}.list{padding:10px 20px 0;display:flex;flex-direction:column;gap:2px;flex-shrink:0}.item{min-height:44px;border-radius:12px;display:flex;align-items:center;gap:13px;padding:0 13px;color:#3f3f3f;font-size:15px;white-space:nowrap}.item span{overflow:hidden;text-overflow:ellipsis}.item svg:last-child{margin-left:auto}.sel{background:#e8e8e8}",".moreBlock{padding:10px 20px 0;flex-shrink:0}.moreToggle{width:100%;min-height:44px;border:0;background:#fff;border-radius:12px;display:flex;align-items:center;justify-content:space-between;padding:0 13px;font-size:15px}.moreToggle span{display:flex;align-items:center;gap:13px}.moreList{padding-top:6px}.moreItem{width:100%;border:0;background:#fff;text-align:left}",".accountDock{margin:24px 20px 20px;position:relative;flex-shrink:0}.accountButton{width:100%;border:0;background:#fff;display:flex;align-items:center;gap:12px;padding:10px 0;text-align:left}.accountButton span{flex:1;display:flex;flex-direction:column}.accountButton b{font-size:14px}.accountButton em{font-style:normal;color:#777;font-size:12px}.accountMenu{position:absolute;left:0;bottom:58px;width:256px;border:1px solid #dedede;border-radius:17px;background:#fff;box-shadow:0 18px 48px rgba(0,0,0,.12);z-index:80;padding:17px 19px}.accountMenu.compact{left:56px;bottom:18px}.menuTop{display:flex;align-items:center;gap:12px;padding-bottom:15px;border-bottom:1px solid #e1e1e1}.menuTop div:nth-child(2){flex:1;display:flex;flex-direction:column}.menuItem{height:39px;width:100%;border:0;background:#fff;display:flex;align-items:center;gap:13px;font-size:15px}.menuItem span{flex:1}.accountMenu hr{border:0;border-top:1px solid #e5e5e5;margin:8px 0}",".startWorkspace,.codeScreen{flex:1;min-width:0;position:relative;background:#fff;display:block}.startWorkspace h1{position:absolute;left:50%;top:27%;transform:translateX(-50%);font-size:48px;font-weight:400;letter-spacing:-.025em;margin:0;white-space:nowrap}.workspaceActions{position:absolute;right:34px;top:26px;display:flex;align-items:center;gap:14px;z-index:20}.workspaceActions>button{height:36px;border:0;background:#fff;border-radius:9px;display:flex;align-items:center;gap:8px;padding:0 8px;font-size:16px}.workspaceActions button:hover{background:#f3f3f3}",".globalOverflowMenu,.messageMenu,.sourceMenu,.versionMenu{position:absolute;background:#fff;color:#111;border:1px solid #ddd;border-radius:18px;box-shadow:0 12px 30px rgba(0,0,0,.14);padding:14px;z-index:180}.globalOverflowMenu{right:0;top:44px;width:286px}.globalOverflowMenu button,.messageMenu button,.sourceMenu button,.versionMenu button{height:44px;border:0;background:#fff;width:100%;display:flex;align-items:center;gap:12px;text-align:left;font-size:16px;border-radius:9px}.danger{color:#d11!important}",".demoTabs{position:absolute;right:34px;top:78px;display:flex;gap:10px;z-index:20}.demoTabs button{height:34px;border:1px solid #d8d8d8;background:#fff;border-radius:999px;padding:0 14px;font-size:14px}.cornerLoader{position:absolute;right:38px;top:132px;width:32px;height:32px;border:0;background:transparent;border-radius:10px;display:grid;place-items:center}.cornerLoader span{width:22px;height:22px;border-radius:50%;border:3px dashed #111;display:block}",".startComposerWrap{position:absolute;left:50%;bottom:92px;transform:translateX(-50%);width:min(860px,calc(100% - 96px));text-align:center}.startComposer{height:58px;border:1px solid #d8d8d8;border-radius:999px;background:#fff;display:flex;align-items:center;gap:14px;padding:0 12px 0 24px;box-shadow:0 12px 34px rgba(0,0,0,.07)}.startComposer button{border:0;background:#fff}.startComposer input{flex:1;min-width:0;border:0;outline:0;font-size:16px}.thinking{display:flex;align-items:center;gap:8px;color:#8a8a8a!important;font-size:15px}.startVoice{width:44px!important;height:44px!important;border-radius:50%;background:#050505!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:3px!important;flex:none}.startVoice i{width:4px;border-radius:99px;background:#fff;display:block}.startVoice i:nth-child(1){height:12px}.startVoice i:nth-child(2){height:21px}.startVoice i:nth-child(3){height:17px}.startVoice i:nth-child(4){height:9px}.startComposerWrap small{display:block;margin-top:12px;color:#777;font-size:13px}",".codeShell{position:absolute;left:48px;right:48px;top:38px;bottom:180px;border:1px solid #ddd;border-radius:26px;overflow:hidden;background:#fff;max-width:calc(100% - 96px)}.codeTopbar{height:72px;display:flex;align-items:center;padding:0 30px;border-bottom:1px solid #eee;gap:24px;position:relative;background:#fff}.codeTitle{display:flex;align-items:center;min-width:320px}.codeTitle b{font-size:18px;font-weight:700}.codeTitle span{color:#888;font-size:18px}.codePrimaryActions{margin-left:auto;display:flex;align-items:center;gap:18px;flex-shrink:0}.codePrimaryActions button{border:0;background:#fff;color:#666;font-size:16px}.codeGlobalActions{display:flex;align-items:center;gap:10px;position:relative;margin-left:12px;flex-shrink:0}.codeGlobalActions button{border:0;background:#fff;color:#111;border-radius:9px;height:36px;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 8px;font-size:16px}.ellipsisBtn{width:36px;padding:0!important}.newChatPill{height:44px!important;border:1px solid #ddd!important;border-radius:999px!important;padding:0 20px!important;background:#fff!important;color:#444!important}.activePreview{background:#111!important;color:#fff!important;border-radius:999px!important;padding:11px 21px!important;font-weight:650}.codeShell .globalOverflowMenu{right:72px;top:48px}.codeNewChatMenu{right:0;top:48px;width:230px}.codeShell pre{margin:0;padding:32px;font-size:18px;line-height:1.7;overflow:auto;height:calc(100% - 72px)}", ".previewWorkspace{flex:1;min-width:0;width:100%;height:100%;display:flex;overflow:hidden;position:relative}.previewWorkspace.dragging,.previewWorkspace.dragging *{cursor:col-resize!important;user-select:none}.previewLeftPane{height:100%;min-width:420px;background:#fff;overflow:hidden;flex:none;position:relative}.previewLeftPane .startWorkspace,.previewLeftPane .codeScreen{height:100%;overflow:hidden}.splitChatContext{height:100%;position:relative;background:#fff;display:flex;flex-direction:column}.splitChatScroll{flex:1;overflow:auto;scroll-behavior:smooth;padding:36px 34px 118px}.splitUserBubble{margin-left:auto;max-width:72%;background:#000;color:#fff;border-radius:28px;padding:14px 22px;font-size:16px;line-height:1.4;width:max-content}.splitAssistant{clear:both;margin-top:34px;display:flex;gap:18px;color:#111}.splitAssistant p{font-size:17px;line-height:1.55;margin:8px 0 14px;color:#333}.splitComposer{position:absolute;left:28px;right:28px;bottom:18px;text-align:center}.splitComposer .startComposer{width:100%;height:58px;min-width:0}.splitComposer small{display:block;margin-top:10px;color:#777;font-size:12px}", ".splitHandle{width:10px;height:100%;flex:none;position:relative;cursor:col-resize;background:transparent;z-index:20}.splitHandle:before{content:'';position:absolute;left:4px;top:0;bottom:0;width:1px;background:#e5e5e5}.splitHandle:hover:before,.previewWorkspace.dragging .splitHandle:before{background:#9f9f9f}.splitHandle span{display:none}", ".previewSlide{position:relative;height:100%;width:auto;background:#080808;color:#fff;z-index:20;flex:1;min-width:0;overflow:hidden}.previewFloatingBar{position:absolute;top:0;left:0;right:0;height:62px;display:flex;align-items:center;gap:16px;padding:0 24px;z-index:60;background:linear-gradient(180deg,rgba(0,0,0,.92),rgba(0,0,0,.55),rgba(0,0,0,0));pointer-events:auto}.previewClose{width:40px;height:40px;border:0;background:transparent;color:#fff;border-radius:10px;font-size:34px;line-height:1}.previewFloatingBar strong{font-size:24px;font-weight:500;white-space:nowrap}.previewTools{margin-left:auto;display:flex;align-items:center;gap:16px}.previewTools button{border:0;background:transparent;color:#fff;border-radius:8px;width:36px;height:36px;display:grid;place-items:center}.previewTools .stopBtn{width:auto;height:44px;border-radius:999px;background:#2b2b2b;padding:0 24px;display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px}.versionMenu{right:90px;top:58px;width:272px;padding:18px 22px}.versionMenu button:disabled{color:#aaa}.versionMenu hr{border:0;border-top:1px solid #ddd;margin:12px 0 10px}.previewPane{height:100%;min-width:0;flex:1;display:flex;overflow:hidden;background:#080808;color:#fff}.previewCanvas{margin:0;width:100%;max-width:100%;height:100%;background:#080808;padding:96px 72px 52px;position:relative;overflow:auto}.previewCanvas>span{border:1px solid #333;border-radius:999px;padding:8px 16px;color:#c9d4df}.previewCanvas h2{font-size:52px;line-height:1.08;margin:56px 0 28px;max-width:900px}.previewCanvas p{font-size:21px;color:#b8c1ca;max-width:900px;line-height:1.65}.previewCards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:18px;margin-top:64px;max-width:900px}.previewCards article{border:1px solid #2b2b2b;border-radius:24px;background:#171717;padding:26px}.previewCards b{font-size:21px;display:block}.previewCards small{display:block;color:#9aa4ae;margin-top:14px;font-size:15px}", ".previewActionDemo{position:relative;display:flex;gap:8px;margin-top:20px}.previewActionDemo>button{width:34px;height:34px;border:0;background:transparent;color:#777;border-radius:8px}.previewCanvas .previewActionDemo{position:relative;left:auto;bottom:auto;margin-top:28px}.messageMenu{left:112px;bottom:38px;width:286px}.sourceMenu{left:180px;bottom:38px;width:230px}.sourceMenu small{color:#999;display:block;margin:0 0 8px 12px}.markdownMessage{font-size:17px;line-height:1.62;color:#222}.markdownMessage p{margin:0 0 14px}.markdownMessage h3{font-size:20px;line-height:1.35;margin:0 0 14px}.markdownMessage ul{margin:0 0 14px 20px;padding:0}.markdownMessage li{margin:8px 0}.markdownMessage pre{font-size:14px;line-height:1.5;background:#f6f6f6;border:1px solid #e6e6e6;border-radius:12px;padding:14px;overflow:auto}.streamStateRow{display:flex;align-items:center;gap:10px;margin:10px 0 14px;color:#666;font-size:12px}.streamStateRow span{border:1px solid #ddd;border-radius:999px;padding:5px 9px;background:#fff}.streamStateRow button{height:28px;border:1px solid #ddd;border-radius:999px;background:#fff;padding:0 10px;color:#444;font-size:12px}.actionStatus{position:absolute;right:18px;bottom:14px;z-index:300;max-width:360px;padding:8px 12px;border:1px solid #ddd;border-radius:999px;background:rgba(255,255,255,.92);box-shadow:0 8px 24px rgba(0,0,0,.08);font-size:12px;color:#555;pointer-events:none}.previewMode .actionStatus{display:none}", ".mobilePreviewShell{flex:1;min-width:0;height:100%;position:relative;background:#080808}.mobilePreviewShell .previewSlide{width:100%;height:100%}.mobilePreviewShell .previewPane{min-width:0;width:100%;height:100%}.mobilePreviewShell .previewCanvas{padding:92px 24px 34px}.keyboardOpen .startComposerWrap{bottom:calc(var(--keyboard-offset) + env(safe-area-inset-bottom,0px) + 10px)}.keyboardOpen .splitComposer{bottom:calc(var(--keyboard-offset) + env(safe-area-inset-bottom,0px) + 10px)}.layout-mobilePortrait,.layout-mobileLandscape{height:var(--vvh)}.layout-mobilePortrait .work,.layout-mobileLandscape .work{height:var(--vvh)}.layout-mobilePortrait .sidebar,.layout-mobileLandscape .sidebar{display:none!important}.layout-mobilePortrait .sidebar:not(.collapsed),.layout-mobileLandscape .sidebar:not(.collapsed){position:absolute;left:0;top:0;bottom:0;width:min(86vw,360px);z-index:200;box-shadow:12px 0 32px rgba(0,0,0,.12)}.layout-mobilePortrait .startWorkspace h1{font-size:34px;top:24%;max-width:calc(100vw - 96px);white-space:normal;text-align:center}.layout-mobileLandscape .startWorkspace h1{font-size:30px;top:18%}.layout-mobilePortrait .workspaceActions,.layout-mobileLandscape .workspaceActions{display:none!important}.layout-mobilePortrait .actionStatus,.layout-mobileLandscape .actionStatus{display:none!important}.layout-mobilePortrait .demoTabs,.layout-mobileLandscape .demoTabs{right:16px;top:62px}.layout-mobilePortrait .cornerLoader,.layout-mobileLandscape .cornerLoader{right:18px;top:112px}.layout-mobilePortrait .startComposerWrap,.layout-mobileLandscape .startComposerWrap{width:calc(100vw - 92px);left:calc(64px + (100vw - 64px)/2);bottom:calc(env(safe-area-inset-bottom,0px) + 14px)}.layout-mobilePortrait .startComposer,.layout-mobileLandscape .startComposer{height:54px;padding-left:16px}.layout-mobilePortrait .thinking,.layout-mobileLandscape .thinking{display:none}.layout-mobilePortrait .codeShell,.layout-mobileLandscape .codeShell{left:12px;right:12px;top:70px;bottom:120px;border-radius:18px}.layout-mobilePortrait .codeTopbar,.layout-mobileLandscape .codeTopbar{gap:10px;padding:0 14px;overflow-x:auto}.layout-mobilePortrait .codeTitle,.layout-mobileLandscape .codeTitle{min-width:220px}.layout-mobilePortrait .codePrimaryActions,.layout-mobileLandscape .codePrimaryActions{gap:12px}.layout-mobilePortrait .codeGlobalActions,.layout-mobileLandscape .codeGlobalActions{gap:6px;margin-left:8px}.layout-mobilePortrait .previewFloatingBar,.layout-mobileLandscape .previewFloatingBar{height:58px;padding:0 14px}.layout-mobilePortrait .previewFloatingBar strong,.layout-mobileLandscape .previewFloatingBar strong{font-size:18px;overflow:hidden;text-overflow:ellipsis}.layout-mobilePortrait .previewTools,.layout-mobileLandscape .previewTools{gap:8px}.layout-mobilePortrait .previewTools .stopBtn,.layout-mobileLandscape .previewTools .stopBtn{height:38px;padding:0 14px;font-size:14px}.layout-tablet .startWorkspace h1{font-size:40px}.layout-tablet .startComposerWrap{width:min(900px,78vw)}",

  ".startWorkspaceActive{display:flex!important;flex-direction:column!important;height:100%!important;overflow:hidden!important}",
  ".startChatSurface{position:absolute!important;left:0!important;right:0!important;top:0!important;bottom:118px!important;overflow-y:auto!important;padding:34px 32px 24px!important;display:flex!important;justify-content:center!important}",
  ".startConversationColumn{width:100%!important;max-width:880px!important;display:flex!important;flex-direction:column!important;gap:28px!important}",
  ".startUserRow{width:100%!important;display:flex!important;justify-content:flex-end!important}",
  ".startUserBubble{max-width:min(680px,82%)!important;background:#000!important;color:#fff!important;border-radius:26px!important;padding:15px 20px!important;font-size:16px!important;line-height:1.45!important;white-space:pre-wrap!important}",
  ".startAssistantRow{width:100%!important;display:flex!important;justify-content:flex-start!important;align-items:flex-start!important;gap:14px!important}",
  ".startAssistantBody{max-width:780px!important;width:100%!important;color:#1c1c1c!important;font-size:16px!important;line-height:1.65!important}",
  ".startAssistantBody pre{max-width:100%!important;overflow-x:auto!important;background:#f5f5f5!important;border:1px solid #e5e5e5!important;border-radius:18px!important;padding:16px 18px!important}",
  ".startAssistantBody p{margin:0 0 14px!important}",
  ".startAssistantBody p:last-child{margin-bottom:0!important}",
  ".startWorkspaceActive .startComposerWrap{bottom:28px!important;width:min(860px,calc(100% - 96px))!important;z-index:40!important}",
  ".layout-mobilePortrait .startChatSurface,.layout-mobileLandscape .startChatSurface{position:absolute!important;top:0!important;left:0!important;right:0!important;height:calc(var(--vvh) - 94px)!important;overflow-y:scroll!important;-webkit-overflow-scrolling:touch!important;padding:24px 18px 112px!important;pointer-events:auto!important}",
  ".startChatSpacer{height:0px;display:none}",
  ".layout-mobilePortrait .startChatSpacer,.layout-mobileLandscape .startChatSpacer{height:140px!important;display:block!important;flex-shrink:0!important}",
  ".layout-mobilePortrait .startConversationColumn,.layout-mobileLandscape .startConversationColumn{max-width:100%!important}",
  ".layout-mobilePortrait .startUserBubble,.layout-mobileLandscape .startUserBubble{max-width:86%!important}",
  ".layout-mobilePortrait .startWorkspaceActive .startComposerWrap,.layout-mobileLandscape .startWorkspaceActive .startComposerWrap{width:calc(100vw - 32px)!important;left:50%!important;transform:translateX(-50%)!important;bottom:calc(env(safe-area-inset-bottom,0px) + 14px)!important}",
  ".layout-mobilePortrait .startComposerWrap,.layout-mobileLandscape .startComposerWrap{width:calc(100vw - 32px)!important;left:50%!important;transform:translateX(-50%)!important;bottom:calc(env(safe-area-inset-bottom,0px) + 14px)!important}",
  "/* sidebar desktop fit overrides */",
  ".sidebar{height:100dvh!important;overflow-y:auto!important;overflow-x:hidden!important;padding-bottom:14px!important}",
  ".sidebar.collapsed{overflow:hidden!important;padding-bottom:0!important}",
  ".newRow{padding:16px 20px 10px!important;gap:12px!important;flex-shrink:0!important}",
  ".newRow button:first-child{height:40px!important}",
  ".chatTools{padding:0 18px 4px!important;gap:0!important;flex-shrink:0!important}",
  ".workspaceNavSide{padding:4px 18px 6px!important;gap:0!important;flex-shrink:0!important}",
  ".chatTools button,.workspaceNavSide button{min-height:36px!important;font-size:14px!important;gap:12px!important}",
  ".label{padding:10px 24px 0!important;font-size:12px!important;flex-shrink:0!important}",
  ".list{padding:6px 14px 0!important;gap:0!important;flex-shrink:0!important}",
  ".item{min-height:35px!important;font-size:13px!important;border-radius:10px!important;gap:10px!important}",
  ".moreBlock{padding:6px 14px 0!important;flex-shrink:0!important}",
  ".moreToggle{min-height:35px!important;font-size:13px!important;border-radius:10px!important}",
  ".moreList{padding-top:2px!important}",
  ".accountDock{margin:10px 16px 14px!important;flex-shrink:0!important}",
  ".accountButton{padding:6px 0!important}",
  ".accountButton b{font-size:12px!important}",
  ".accountButton em{font-size:11px!important}",
  ".avatar{width:32px!important;height:32px!important;font-size:11px!important}"
,
  "/* More directly under Chat */",
  ".workspaceNavSide .navMoreBlock{padding:2px 0 4px 0!important;flex-shrink:0!important}",
  ".workspaceNavSide .navMoreBlock .moreToggle{min-height:36px!important;font-size:14px!important;border-radius:12px!important;padding:0 13px!important}",
  ".workspaceNavSide .navMoreBlock .moreList{padding:2px 0 0 0!important}",
  ".workspaceNavSide .navMoreBlock .moreItem{min-height:34px!important;font-size:13px!important}",,
  "/* top-right actions tightened to match compact header look */",
  ".demoTabs{display:none!important}",
  ".workspaceActions{top:10px!important;right:14px!important;display:flex!important;align-items:center!important;gap:8px!important;z-index:90!important}",
  ".workspaceActions>button{height:32px!important;min-width:32px!important;width:auto!important;padding:0 6px!important;border-radius:10px!important;background:transparent!important;border:0!important;box-shadow:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}",
  ".workspaceActions>button:hover{background:rgba(0,0,0,.04)!important}",
  ".workspaceActions>button svg{width:18px!important;height:18px!important}",
  ".workspaceActions>button span:not(.sr-only),.workspaceActions>button strong,.workspaceActions>button label,.workspaceActions>button .buttonLabel,.workspaceActions>button .actionLabel{display:none!important}",
  ".workspaceActions .globalOverflowMenu{top:36px!important;right:0!important;width:286px!important;z-index:250!important}",
  ".workspaceActions .globalOverflowMenu button{cursor:pointer!important}",
  ".cornerLoader{top:72px!important;right:18px!important}",
  ".previewTopbar,.previewHeader,.previewFloatingBar{padding-top:8px!important;padding-right:14px!important;min-height:52px!important}",
  ".previewTopbar .previewTitle,.previewHeader .previewTitle,.previewFloatingBar strong{font-size:16px!important;line-height:1.2!important}",
  ".previewTools,.previewActions,.previewHeaderActions{top:8px!important;right:14px!important;display:flex!important;align-items:center!important;gap:8px!important}",
  ".previewTools button,.previewActions button,.previewHeaderActions button{height:32px!important;min-width:32px!important;padding:0 6px!important;border-radius:10px!important;background:transparent!important;border:0!important;box-shadow:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}",
  ".previewTools button svg,.previewActions button svg,.previewHeaderActions button svg{width:18px!important;height:18px!important}",
  ".previewTools .stopBtn,.previewActions .stopBtn,.previewHeaderActions .stopBtn{height:40px!important;min-width:96px!important;padding:0 16px!important;border-radius:18px!important;background:#e9e9e9!important;color:#111!important;border:0!important}",
  "/* code editor opens like preview split */",
  ".codeArtifactPane{height:100%;min-width:0;flex:1;position:relative;background:#fff;overflow:hidden}",
  ".artifactCodeShell{position:absolute!important;left:0!important;right:0!important;top:0!important;bottom:0!important;border-radius:0!important;border:0!important;max-width:none!important}",
  ".codeArtifactPane .codeShell pre{height:calc(100% - 72px)!important}",
  ".codeArtifactPane .startComposerWrap{display:none!important}",
  "/* preview toolbar working menu */",
  ".previewTools button{cursor:pointer!important}",
  ".previewTools button:hover{opacity:.75!important}",
  ".versionMenu button{cursor:pointer!important}",
  ".versionMenu button:hover{background:#f7f7f7!important}",
  ".versionMenu .versionState{display:block!important;color:#777!important;font-size:12px!important;padding:8px 0 0 12px!important}",
  ".versionMenu{z-index:300!important}",
  "/* built missing share copy close actions */",
  ".workspaceActions{position:absolute!important;right:18px!important;top:10px!important;display:flex!important;align-items:center!important;gap:10px!important;z-index:120!important}",
  ".workspaceActions>button{height:34px!important;border:0!important;background:#fff!important;border-radius:9px!important;display:flex!important;align-items:center!important;gap:8px!important;padding:0 8px!important;font-size:15px!important;cursor:pointer!important}",
  ".workspaceActions>button:hover{background:#f3f3f3!important}",
  ".sharePopover{position:absolute!important;top:42px!important;right:0!important;width:390px!important;background:#fff!important;border:1px solid #ddd!important;border-radius:22px!important;box-shadow:0 16px 44px rgba(0,0,0,.14)!important;padding:20px!important;z-index:260!important}",
  ".sharePopoverHeader{display:flex!important;align-items:center!important;justify-content:space-between!important;margin-bottom:16px!important}",
  ".sharePopoverHeader b{font-size:18px!important}",
  ".sharePopoverHeader button{width:30px!important;height:30px!important;border:0!important;background:transparent!important;border-radius:999px!important;font-size:22px!important;cursor:pointer!important}",
  ".sharePopoverHeader button:hover{background:#f3f3f3!important}",
  ".shareRow{height:48px!important;border:1px solid #ddd!important;border-radius:999px!important;display:flex!important;align-items:center!important;overflow:hidden!important;background:#fff!important}",
  ".shareRow input{flex:1!important;min-width:0!important;height:100%!important;border:0!important;outline:0!important;padding:0 18px!important;font-size:15px!important;color:#8a8a8a!important;background:#fff!important}",
  ".shareRow button{height:40px!important;border:0!important;border-radius:999px!important;background:#050505!important;color:#fff!important;font-weight:650!important;padding:0 18px!important;margin-right:4px!important;cursor:pointer!important}",
  ".workspaceActions .globalOverflowMenu{position:absolute!important;top:42px!important;right:0!important;width:330px!important;background:#fff!important;border:1px solid #ddd!important;border-radius:22px!important;box-shadow:0 14px 36px rgba(0,0,0,.14)!important;padding:8px 0 12px!important;z-index:260!important}",
  ".menuHeader{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:0 12px 6px 18px!important}",
  ".menuHeader span{font-size:13px!important;font-weight:650!important;color:#666!important}",
  ".menuClose{width:30px!important;height:30px!important;border:0!important;background:transparent!important;border-radius:999px!important;font-size:22px!important;line-height:1!important;cursor:pointer!important}",
  ".menuClose:hover{background:#f3f3f3!important}",
  ".workspaceActions .globalOverflowMenu button{height:48px!important;min-height:48px!important;width:100%!important;border:0!important;background:transparent!important;display:flex!important;align-items:center!important;gap:16px!important;padding:0 24px!important;font-size:17px!important;text-align:left!important;cursor:pointer!important}",
  ".workspaceActions .globalOverflowMenu button:hover{background:#f7f7f7!important}",
  ".workspaceActions .globalOverflowMenu .danger{color:#e12626!important}",
  "/* built missing interactive controls */",
  ".artifactClose{width:34px!important;height:34px!important;border:0!important;background:transparent!important;border-radius:999px!important;font-size:28px!important;line-height:1!important;cursor:pointer!important;margin-right:10px!important}",
  ".artifactClose:hover{background:#f3f3f3!important}",
  ".sharePopover{position:absolute!important;top:44px!important;right:0!important;width:390px!important;background:#fff!important;border:1px solid #ddd!important;border-radius:22px!important;box-shadow:0 16px 44px rgba(0,0,0,.14)!important;padding:20px!important;z-index:320!important}",
  ".sharePopoverHeader{display:flex!important;align-items:center!important;justify-content:space-between!important;margin-bottom:16px!important}",
  ".sharePopoverHeader b{font-size:18px!important}",
  ".sharePopoverHeader button{width:30px!important;height:30px!important;border:0!important;background:transparent!important;border-radius:999px!important;font-size:22px!important;cursor:pointer!important}",
  ".sharePopoverHeader button:hover{background:#f3f3f3!important}",
  ".shareRow{height:48px!important;border:1px solid #ddd!important;border-radius:999px!important;display:flex!important;align-items:center!important;overflow:hidden!important;background:#fff!important}",
  ".shareRow input{flex:1!important;min-width:0!important;height:100%!important;border:0!important;outline:0!important;padding:0 18px!important;font-size:15px!important;color:#8a8a8a!important;background:#fff!important}",
  ".shareRow button{height:40px!important;border:0!important;border-radius:999px!important;background:#050505!important;color:#fff!important;font-weight:650!important;padding:0 18px!important;margin-right:4px!important;cursor:pointer!important}",
  ".menuHeader{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:0 12px 6px 18px!important}",
  ".menuHeader span{font-size:13px!important;font-weight:650!important;color:#666!important}",
  ".menuClose{width:30px!important;height:30px!important;border:0!important;background:transparent!important;border-radius:999px!important;font-size:22px!important;line-height:1!important;cursor:pointer!important}",
  ".menuClose:hover{background:#f3f3f3!important}",
  ".versionMenu button:not(:disabled){cursor:pointer!important}",
  ".versionMenu button:hover{background:#f7f7f7!important}",
  ".versionState{display:block!important;color:#777!important;font-size:12px!important;padding:8px 0 0 12px!important}",
  "/* control fix: closeable share menu code preview */",
  ".artifactClose{width:34px!important;height:34px!important;border:0!important;background:transparent!important;border-radius:999px!important;font-size:28px!important;line-height:1!important;cursor:pointer!important;margin-right:10px!important}",
  ".artifactClose:hover{background:#f3f3f3!important}",
  ".sharePopover{position:absolute!important;top:44px!important;right:0!important;width:390px!important;background:#fff!important;border:1px solid #ddd!important;border-radius:22px!important;box-shadow:0 16px 44px rgba(0,0,0,.14)!important;padding:20px!important;z-index:320!important}",
  ".sharePopoverHeader{display:flex!important;align-items:center!important;justify-content:space-between!important;margin-bottom:16px!important}",
  ".sharePopoverHeader b{font-size:18px!important}",
  ".sharePopoverHeader button{width:30px!important;height:30px!important;border:0!important;background:transparent!important;border-radius:999px!important;font-size:22px!important;cursor:pointer!important}",
  ".sharePopoverHeader button:hover{background:#f3f3f3!important}",
  ".shareRow{height:48px!important;border:1px solid #ddd!important;border-radius:999px!important;display:flex!important;align-items:center!important;overflow:hidden!important;background:#fff!important}",
  ".shareRow input{flex:1!important;min-width:0!important;height:100%!important;border:0!important;outline:0!important;padding:0 18px!important;font-size:15px!important;color:#8a8a8a!important;background:#fff!important}",
  ".shareRow button{height:40px!important;border:0!important;border-radius:999px!important;background:#050505!important;color:#fff!important;font-weight:650!important;padding:0 18px!important;margin-right:4px!important;cursor:pointer!important}",
  ".menuHeader{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:0 12px 6px 18px!important}",
  ".menuHeader span{font-size:13px!important;font-weight:650!important;color:#666!important}",
  ".menuClose{width:30px!important;height:30px!important;border:0!important;background:transparent!important;border-radius:999px!important;font-size:22px!important;line-height:1!important;cursor:pointer!important}",
  ".menuClose:hover{background:#f3f3f3!important}",
  ".versionMenu button:not(:disabled){cursor:pointer!important}",
  ".versionMenu button:hover{background:#f7f7f7!important}",
  ".versionState{display:block!important;color:#777!important;font-size:12px!important;padding:8px 0 0 12px!important}",
  ".codeShell{overflow:visible!important}",
  ".codeShell pre{overflow:auto!important}",
  "/* editor controls fix */",
  ".artifactClose{width:34px!important;height:34px!important;border:0!important;background:transparent!important;border-radius:999px!important;font-size:28px!important;line-height:1!important;cursor:pointer!important;margin-right:10px!important}",
  ".artifactClose:hover{background:#f3f3f3!important}",
  ".sharePopover{position:absolute!important;top:44px!important;right:0!important;width:390px!important;background:#fff!important;border:1px solid #ddd!important;border-radius:22px!important;box-shadow:0 16px 44px rgba(0,0,0,.14)!important;padding:20px!important;z-index:320!important}",
  ".sharePopoverHeader{display:flex!important;align-items:center!important;justify-content:space-between!important;margin-bottom:16px!important}",
  ".sharePopoverHeader b{font-size:18px!important}",
  ".sharePopoverHeader button{width:30px!important;height:30px!important;border:0!important;background:transparent!important;border-radius:999px!important;font-size:22px!important;cursor:pointer!important}",
  ".sharePopoverHeader button:hover{background:#f3f3f3!important}",
  ".shareRow{height:48px!important;border:1px solid #ddd!important;border-radius:999px!important;display:flex!important;align-items:center!important;overflow:hidden!important;background:#fff!important}",
  ".shareRow input{flex:1!important;min-width:0!important;height:100%!important;border:0!important;outline:0!important;padding:0 18px!important;font-size:15px!important;color:#8a8a8a!important;background:#fff!important}",
  ".shareRow button{height:40px!important;border:0!important;border-radius:999px!important;background:#050505!important;color:#fff!important;font-weight:650!important;padding:0 18px!important;margin-right:4px!important;cursor:pointer!important}",
  ".menuHeader{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:0 12px 6px 18px!important}",
  ".menuHeader span{font-size:13px!important;font-weight:650!important;color:#666!important}",
  ".menuClose{width:30px!important;height:30px!important;border:0!important;background:transparent!important;border-radius:999px!important;font-size:22px!important;line-height:1!important;cursor:pointer!important}",
  ".menuClose:hover{background:#f3f3f3!important}",
  ".codeShell{overflow:visible!important}",
  ".codeShell pre{overflow:auto!important}",
  "/* editor artifact live layout pass 1 */",
  ".editorLiveScreen,.editorLivePane{height:100%;min-width:0;position:relative;background:#fff;overflow:hidden}",
  ".editorLiveScreen{flex:1}",
  ".editorLivePane{flex:1}",
  ".editorLiveShell{position:absolute!important;inset:0!important;left:0!important;right:0!important;top:0!important;bottom:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:#fff!important;max-width:none!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}",
  ".editorLiveTopbar{height:72px!important;flex:none!important;padding:0 30px!important;border-bottom:1px solid #eee!important;background:#fff!important}",
  ".artifactClose{width:40px!important;height:40px!important;border:0!important;background:#fff!important;border-radius:999px!important;font-size:34px!important;line-height:1!important;display:grid!important;place-items:center!important;color:#111!important;margin-right:4px!important}",
  ".artifactClose:hover{background:#f3f3f3!important}",
  ".artifactEditorTextarea{flex:1!important;min-height:0!important;width:100%!important;border:0!important;outline:0!important;resize:none!important;background:#fff!important;color:#111!important;padding:32px 48px 124px!important;font:400 22px/1.7 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;overflow:auto!important}",
  ".editorLiveShell pre{display:none!important}",
  ".layout-mobilePortrait .editorLiveTopbar,.layout-mobileLandscape .editorLiveTopbar{height:64px!important;padding:0 14px!important;gap:10px!important;overflow-x:auto!important}",
  ".layout-mobilePortrait .artifactEditorTextarea,.layout-mobileLandscape .artifactEditorTextarea{font-size:17px!important;line-height:1.6!important;padding:18px 14px calc(env(safe-area-inset-bottom,0px) + 104px)!important}",

  /* ─── Mobile conversation & page fixes ──────── */
  "@media(max-width:760px){" +
    /* startWorkspace h1 responsive */
    ".startWorkspace h1{font-size:clamp(22px,7vw,40px)!important;top:22%!important;white-space:normal!important;text-align:center!important;max-width:calc(100vw - 80px)!important;line-height:1.2!important;padding:0 16px!important;}" +

    /* Sidebar: collapsed icon-only rail on mobile */
    ".sidebar{width:56px!important;min-width:56px!important;}" +
    ".sidebar:not(.collapsed){position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:min(86vw,340px)!important;z-index:300!important;box-shadow:16px 0 48px rgba(0,0,0,.16)!important;}" +

    /* New chat button in collapsed sidebar */
    ".sidebar.collapsed .newRow button:first-child{justify-content:center!important;padding:0!important;}" +

    /* Composer wrap: span full width minus the 56px collapsed sidebar */
    ".startComposerWrap{width:calc(100vw - 72px)!important;left:calc(56px + (100vw - 56px)/2)!important;bottom:calc(env(safe-area-inset-bottom,0px) + 10px)!important;}" +
    ".startWorkspaceActive .startComposerWrap{width:calc(100vw - 72px)!important;left:calc(56px + (100vw - 56px)/2)!important;bottom:calc(env(safe-area-inset-bottom,0px) + 10px)!important;}" +

    /* Chat surface scroll area */
    ".startChatSurface{padding:16px 12px 106px!important;bottom:72px!important;}" +
    ".startConversationColumn{max-width:100%!important;gap:18px!important;}" +

    /* User bubble: max-width on mobile */
    ".startUserBubble{max-width:88%!important;padding:12px 16px!important;font-size:15px!important;border-radius:22px!important;}" +

    /* Assistant: full width, readable size */
    ".startAssistantBody{font-size:15px!important;line-height:1.6!important;}" +
    ".startAssistantBody pre{font-size:13px!important;padding:12px!important;border-radius:14px!important;}" +

    /* Workspace top actions: tighter on mobile */
    ".workspaceActions{top:8px!important;right:8px!important;gap:4px!important;}" +
    ".workspaceActions>button{height:30px!important;padding:0 5px!important;font-size:14px!important;}" +

    /* Share popover: full-width on mobile */
    ".sharePopover{width:calc(100vw - 24px)!important;left:12px!important;right:12px!important;top:44px!important;}" +

    /* Global overflow menu on mobile */
    ".globalOverflowMenu{right:0!important;width:min(290px,90vw)!important;}" +

    /* Code shell */
    ".codeShell{left:8px!important;right:8px!important;top:52px!important;bottom:76px!important;border-radius:14px!important;}" +
    ".codeTopbar{height:56px!important;padding:0 10px!important;gap:8px!important;}" +
    ".codeTitle{min-width:0!important;flex:1!important;}" +
    ".codeTitle b{font-size:14px!important;}" +
    ".codeShell pre{padding:16px!important;font-size:13px!important;}" +

    /* Preview slide */
    ".previewFloatingBar{height:52px!important;padding:0 10px!important;}" +
    ".previewFloatingBar strong{font-size:15px!important;}" +
    ".previewCanvas{padding:70px 16px 24px!important;}" +
    ".previewCanvas h2{font-size:28px!important;}" +
    ".previewCanvas p{font-size:16px!important;}" +
  "}",

  /* ─── Very small screens (≤ 380px) ─────────── */
  "@media(max-width:380px){" +
    ".startWorkspace h1{font-size:20px!important;}" +
    ".startUserBubble{max-width:94%!important;font-size:14px!important;}" +
    ".startAssistantBody{font-size:14px!important;}" +
    ".workspaceActions>button>span:not([aria-hidden]){display:none!important;}" +
  "}"
].join("");

