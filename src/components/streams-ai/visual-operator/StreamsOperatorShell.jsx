"use client";

import React, { useEffect, useMemo, useState } from "react";
import StreamsComposer from "../current-chat/new-face/composer/StreamsComposer";
import ChatMarkdownMessage from "../current-chat/new-face/markdown/ChatMarkdownMessage";
import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";
import MessageActions from "./MessageActions";
import useAuthoritativeStreamsRuntime from "./useAuthoritativeStreamsRuntime";
import "./streams-operator-shell.css";

const NAV_GROUPS = [
  { title: "MAIN", items: [["home", "Home", "H"], ["projects", "Projects", "P"], ["workspace", "Workspace", "W"]] },
  { title: "CREATE", items: [["files", "Files", "F"], ["create", "Create", "C"], ["generate", "Generate", "G"], ["build", "Build", "B"], ["assets", "Assets", "A"]] },
  { title: "MANAGE", items: [["tasks", "Tasks", "T"], ["history", "History", "H"], ["ask-ai", "Ask AI", "A"], ["settings", "Settings", "S"]] },
];

const ACCOUNT_PAGE_MAP = { profile: "profile", personalization: "personalization", settings: "settings", billing: "billing", upgrade: "modules", help: "help", apps: "apps", credits: "credits", privacy: "privacy", modules: "modules", language: "language", gift: "gift", "notification-settings": "settings" };

function titleFor(id) { return NAV_GROUPS.flatMap((group) => group.items).find(([key]) => key === id)?.[1] || "Streams AI"; }

function useMobile() {
  const read = () => typeof window !== "undefined" && window.innerWidth < 900;
  const [mobile, setMobile] = useState(read);
  useEffect(() => { const update = () => setMobile(read()); update(); window.addEventListener("resize", update); return () => window.removeEventListener("resize", update); }, []);
  return mobile;
}

function navigateUniversalDestination(id, setActiveSection, onNavigate) {
  if (id === "workspace" || id === "build") {
    window.location.assign("/streams-ai/streams-builder/workspace");
    return;
  }
  if (id === "generate") {
    window.location.assign("/streams-ai/streams-builder/gen-video");
    return;
  }
  setActiveSection(id === "ask-ai" ? "home" : id);
  onNavigate?.();
}

function SidebarNav({ activeSection, setActiveSection, onNavigate }) {
  return <nav className="operatorNav" aria-label="Streams navigation">{NAV_GROUPS.map((group) => <section className="operatorNavGroup" key={group.title}><h3>{group.title}</h3>{group.items.map(([id, label, icon]) => <button key={id} type="button" className={activeSection === id || ((id === "ask-ai") && activeSection === "home") ? "active" : ""} title={label} aria-label={label} onClick={() => navigateUniversalDestination(id, setActiveSection, onNavigate)}><i className="operatorNavIndicator" aria-hidden="true" /><span className="operatorNavIcon" aria-hidden="true">{icon}</span><small>{label}</small></button>)}</section>)}</nav>;
}

function Sidebar({ activeSection, setActiveSection, onNewChat }) {
  return <aside className="operatorSidebar"><button type="button" className="operatorBrand" aria-label="Streams AI home" onClick={() => setActiveSection("home")}><span className="operatorBrandMark" aria-hidden="true">S</span></button><button type="button" className="operatorNewChat" aria-label="New session" title="New session" onClick={onNewChat}>+</button><SidebarNav activeSection={activeSection} setActiveSection={setActiveSection} /></aside>;
}

function MessageAttachments({ attachments = [] }) {
  const list = Array.isArray(attachments) ? attachments : [];
  if (!list.length) return null;
  return <div className="operatorMessageAttachments">{list.map((file, index) => {
    const mime = String(file?.mimeType || file?.mime_type || "").toLowerCase();
    const isImage = file?.kind === "image" || mime.startsWith("image/");
    const url = file?.url || file?.previewUrl || file?.storageUrl || file?.publicUrl || "";
    if (isImage && url) return <figure key={file?.id || `${file?.name}-${index}`} className="operatorAttachmentImage"><img src={url} alt={file?.name || "Attached image"} /><figcaption>{file?.name || "Attached image"}</figcaption></figure>;
    return <div key={file?.id || `${file?.name}-${index}`} className="operatorAttachmentFile"><span aria-hidden="true">📄</span><strong>{file?.name || "Attached file"}</strong></div>;
  })}</div>;
}

function PendingAssistant({ label }) {
  return <div className="operatorPendingResponse" role="status" aria-live="polite"><span>{label || "Thinking…"}</span><span className="operatorPendingDots" aria-hidden="true"><i /><i /><i /></span></div>;
}

function ChatMessage({ message, chatRuntime }) {
  const isUser = message?.role === "user";
  const text = String(message?.content || message?.text || "");
  const pending = !isUser && (message?.isStreaming || message?.status === "streaming") && !text && !message?.generatedImage && !message?.generatedVideoUrl;
  const failed = message?.status === "error" || message?.status === "failed";
  return <article className={isUser ? "operatorMessage user" : `operatorMessage assistant${failed ? " failed" : ""}`} data-message-id={message?.id || undefined}>{!isUser ? <div className="operatorAvatar" aria-hidden="true">S</div> : null}<div className="operatorBubble">{isUser ? <MessageAttachments attachments={message?.attachments} /> : null}{message?.generatedImage?.url ? <img className="operatorGenerated" src={message.generatedImage.url} alt={message.generatedImage.name || "Generated image"} /> : message?.generatedVideoUrl ? <video className="operatorGenerated" src={message.generatedVideoUrl} controls playsInline /> : pending ? <PendingAssistant label={message?.statusText || chatRuntime?.statusLabel} /> : isUser ? (text ? <div className="operatorUserText">{text}</div> : null) : <ChatMarkdownMessage content={text} />}{!isUser && !failed ? <MessageActions message={message} chatRuntime={chatRuntime} /> : null}</div></article>;
}

function Composer({ chatRuntime }) {
  return <StreamsComposer onSubmit={(payload) => chatRuntime?.sendMessage?.({ message: payload.message, composerMode: payload.composerMode, mode: payload.mode, webSearchEnabled: payload.webSearchEnabled })} onFilesSelected={(files) => chatRuntime?.uploadFiles?.(files)} onProviderChange={(provider) => chatRuntime?.setSelectedProvider?.(provider)} onModeChange={(mode) => chatRuntime?.setSelectedMode?.(mode)} libraryFiles={chatRuntime?.composerAttachments || []} onRemoveFile={(fileId) => chatRuntime?.removeComposerAttachment?.(fileId)} isStreaming={chatRuntime?.isStreaming} />;
}

function ChatPanel({ chatRuntime, activeProject, onOpenInline }) {
  const messages = useMemo(() => {
    const source = Array.isArray(chatRuntime?.messages) ? chatRuntime.messages : [];
    const seen = new Set();
    return source.filter((message) => {
      const id = String(message?.id || "").trim();
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [chatRuntime?.messages]);
  const isEmpty = messages.length === 0 && !chatRuntime?.isLoadingMessages && !chatRuntime?.isRefreshingMessages;
  if (isEmpty) return <section className="operatorChatPanel operatorNewChatLanding"><div className="operatorEmptyLanding"><div className="operatorLandingOrb" aria-hidden="true"><span /></div><span className="operatorEyebrow">STREAMS AI WORKSPACE</span><h1>Ask, build, create, launch.</h1><p>Start with a conversation. Open the project workspace when the idea is ready to become real work.</p><div className="operatorLandingComposer"><Composer chatRuntime={chatRuntime} /></div></div></section>;
  return <section className="operatorChatPanel operatorConversationView"><header className="operatorTopbar"><div><span>STREAMS AI</span><b>{activeProject?.title || "General assistant"}</b></div><div className="operatorTopbarStatus"><small>{chatRuntime?.isStreaming ? "Working" : chatRuntime?.isRefreshingMessages ? "Syncing" : "Online"}</small>{activeProject ? <button type="button" onClick={onOpenInline}>Project preview</button> : null}</div></header><div className="operatorChatScroll">{messages.map((message) => <ChatMessage key={message.id || `${message.role}-${message.createdAt}`} message={message} chatRuntime={chatRuntime} />)}</div><div className="operatorComposer"><Composer chatRuntime={chatRuntime} /></div></section>;
}

function ProjectPicker({ sessions, activeProject, onSelectProject, onStartCleanProject }) {
  const recent = (Array.isArray(sessions) ? sessions : []).slice(0, 24);
  return <section className="operatorModule"><span>PROJECTS</span><h1>Open a project conversation</h1><p>Selecting a project loads its server-backed conversation and connected assets.</p><button type="button" className="operatorModuleAction" onClick={onStartCleanProject}>Start clean project</button><div className="operatorProjectGrid">{recent.map((session, index) => { const title = String(session?.title || session?.name || `Project ${index + 1}`); const id = session?.id || session?.sessionId || title; return <button key={id} type="button" className={activeProject?.id === id ? "operatorProjectCard active" : "operatorProjectCard"} onClick={() => onSelectProject({ id, title, source: "chat-session" })}><b>{title}</b><br /><small>Open conversation</small></button>; })}</div></section>;
}

function ModuleScreen({ id }) { const accountKind = ACCOUNT_PAGE_MAP[id]; if (accountKind) return <div className="operatorModule"><StreamsAccountActionPanel pageKind={accountKind} title={titleFor(id)} description={`Manage ${titleFor(id).toLowerCase()} through the connected account system.`} /></div>; return <section className="operatorModule"><span>STREAMS</span><h1>{titleFor(id)}</h1><p>This destination uses connected project, file, generation, and history systems.</p></section>; }
function InlinePanel({ activeProject, onClose }) { return <aside className="operatorInline"><div className="operatorInlineHead"><div><span>PROJECT PREVIEW</span><h2>{activeProject?.title}</h2></div><button type="button" aria-label="Close project preview" onClick={onClose}>×</button></div><p>Project visuals and verified artifacts appear here when generated.</p></aside>; }

export default function StreamsOperatorShell({ chatRuntime: baseRuntime }) {
  const chatRuntime = useAuthoritativeStreamsRuntime(baseRuntime);
  const mobile = useMobile();
  const [activeSection, setActiveSection] = useState("home");
  const [activeProject, setActiveProject] = useState(null);
  const [inlineOpen, setInlineOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const shellClass = useMemo(() => ["streamsOperator", inlineOpen ? "inlineOpen" : ""].filter(Boolean).join(" "), [inlineOpen]);
  const newGeneralChat = () => { setActiveProject(null); setInlineOpen(false); setActiveSection("home"); chatRuntime?.newChat?.(); if (typeof window !== "undefined") window.history.pushState(null, "", "/streams-ai"); };
  const selectProject = (project) => { setActiveProject(project); setInlineOpen(false); setActiveSection("home"); if (project?.id) chatRuntime?.selectSession?.(project.id); };
  const startCleanProject = () => { chatRuntime?.newChat?.(); setActiveProject({ id: `draft-${Date.now()}`, title: "New clean project", source: "draft" }); setActiveSection("home"); };
  return <div className={shellClass}>{!mobile ? <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} onNewChat={newGeneralChat} /> : null}{mobile ? <button type="button" className="operatorMobileMenu" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}>☰</button> : null}<main className="operatorMain">{activeSection === "home" ? <ChatPanel chatRuntime={chatRuntime} activeProject={activeProject} onOpenInline={() => activeProject && setInlineOpen(true)} /> : activeSection === "projects" ? <ProjectPicker sessions={chatRuntime?.sessions || []} activeProject={activeProject} onSelectProject={selectProject} onStartCleanProject={startCleanProject} /> : <ModuleScreen id={activeSection} />}</main>{inlineOpen && activeProject ? <InlinePanel activeProject={activeProject} onClose={() => setInlineOpen(false)} /> : null}{mobile ? <div className={drawerOpen ? "operatorMobileDrawer open" : "operatorMobileDrawer"}><aside><button type="button" className="operatorModuleAction" onClick={() => { newGeneralChat(); setDrawerOpen(false); }}>+ New session</button><SidebarNav activeSection={activeSection} setActiveSection={setActiveSection} onNavigate={() => setDrawerOpen(false)} /></aside><button type="button" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} /></div> : null}</div>;
}
