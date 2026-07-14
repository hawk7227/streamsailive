"use client";

import React, { useEffect, useMemo, useState } from "react";
import StreamsComposer from "../current-chat/new-face/composer/StreamsComposer";
import ChatMarkdownMessage from "../current-chat/new-face/markdown/ChatMarkdownMessage";
import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";
import MessageActions from "./MessageActions";
import useAuthoritativeStreamsRuntime from "./useAuthoritativeStreamsRuntime";
import "./streams-operator-shell.css";

const NAV_GROUPS = [
  { title: "MAIN", items: [["home", "Home"], ["portfolio", "Portfolio"], ["projects", "Projects"]] },
  { title: "BUILD", items: [["business", "Business Builder"], ["revenue", "Revenue"], ["visuals", "Visual Concepts"], ["website", "Website Builder"], ["app", "App Builder"], ["preview-launch", "Preview + Launch"]] },
  { title: "CREATE", items: [["studio", "Creator Studio"], ["image", "Image Studio"], ["video", "Video Studio"], ["voice", "Voice Studio"], ["captions", "Captions"], ["content", "Content"], ["ideas", "Ideas"], ["turn-you", "Turn This Into You"], ["calendar", "Calendar"], ["social", "Social Research"], ["growth-feed", "Growth Feed"], ["assets", "Assets"]] },
  { title: "GROW", items: [["checklist", "Launch Checklist"], ["growth", "Growth Dashboard"], ["notifications", "Notifications"]] },
  { title: "ACCOUNT", items: [["billing", "Billing / Credits"], ["notification-settings", "Notification Settings"], ["settings", "Settings"]] },
];

const ACCOUNT_PAGE_MAP = {
  profile: "profile",
  personalization: "personalization",
  settings: "settings",
  billing: "billing",
  upgrade: "modules",
  help: "help",
  apps: "apps",
  credits: "credits",
  privacy: "privacy",
  modules: "modules",
  language: "language",
  gift: "gift",
  "notification-settings": "settings",
};

function titleFor(id) {
  return NAV_GROUPS.flatMap((group) => group.items).find(([key]) => key === id)?.[1] || "Streams AI";
}

function useMobile() {
  const read = () => typeof window !== "undefined" && window.innerWidth < 900;
  const [mobile, setMobile] = useState(read);
  useEffect(() => {
    const update = () => setMobile(read());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return mobile;
}

function SidebarNav({ activeSection, setActiveSection, collapsed = false, onNavigate }) {
  return <nav className="operatorNav" aria-label="Streams navigation">
    {NAV_GROUPS.map((group) => <section className="operatorNavGroup" key={group.title}>
      <h3>{group.title}</h3>
      {group.items.map(([id, label]) => <button key={id} type="button" className={activeSection === id ? "active" : ""} title={collapsed ? label : undefined} onClick={() => { setActiveSection(id); onNavigate?.(); }}><span>{label}</span>{collapsed ? label.slice(0, 1) : null}</button>)}
    </section>)}
  </nav>;
}

function Sidebar({ activeSection, setActiveSection, collapsed, setCollapsed, onNewChat }) {
  return <aside className="operatorSidebar">
    <div className="operatorBrand">
      <div className="operatorBrandMark" aria-hidden="true" />
      <div className="operatorBrandText"><b>STREAMS AI</b><span>Your AI Business Operator</span></div>
      <button type="button" className="operatorCollapse" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? "›" : "‹"}</button>
    </div>
    <button type="button" className="operatorNewChat" onClick={onNewChat}>{collapsed ? "+" : "+ New session"}</button>
    <SidebarNav activeSection={activeSection} setActiveSection={setActiveSection} collapsed={collapsed} />
  </aside>;
}

function ChatMessage({ message, chatRuntime }) {
  const isUser = message?.role === "user";
  const text = String(message?.content || message?.text || "");
  return <article className={isUser ? "operatorMessage user" : "operatorMessage assistant"} data-message-id={message?.id || undefined}>
    {!isUser ? <div className="operatorAvatar" aria-hidden="true">AI</div> : null}
    <div className="operatorBubble">
      {message?.generatedImage?.url
        ? <img className="operatorGenerated" src={message.generatedImage.url} alt={message.generatedImage.name || "Generated image"} />
        : message?.generatedVideoUrl
          ? <video className="operatorGenerated" src={message.generatedVideoUrl} controls playsInline />
          : isUser
            ? text
            : <ChatMarkdownMessage content={text} />}
      {!isUser ? <MessageActions message={message} chatRuntime={chatRuntime} /> : null}
    </div>
  </article>;
}

function ChatPanel({ chatRuntime, activeProject, onOpenInline }) {
  const messages = Array.isArray(chatRuntime?.messages) ? chatRuntime.messages : [];
  return <section className="operatorChatPanel">
    <header className="operatorTopbar">
      <div><span>STREAMS AI</span><b>{activeProject?.title || "General assistant"}</b></div>
      <div><small>{chatRuntime?.isStreaming ? "Working" : chatRuntime?.isRefreshingMessages ? "Syncing" : "Online"}</small>{activeProject ? <button type="button" onClick={onOpenInline}>Inline Build</button> : null}</div>
    </header>
    <div className="operatorChatScroll">
      {messages.length ? messages.map((message) => <ChatMessage key={message.id || `${message.role}-${message.createdAt}`} message={message} chatRuntime={chatRuntime} />) : <div className="operatorEmpty"><div><h1>Ask, build, create, launch.</h1><p>Start a conversation or open a project from Portfolio.</p></div></div>}
    </div>
    <div className="operatorComposer">
      <StreamsComposer
        onSubmit={(payload) => chatRuntime?.sendMessage?.({ message: payload.message, composerMode: payload.composerMode, mode: payload.mode, webSearchEnabled: payload.webSearchEnabled })}
        onFilesSelected={(files) => chatRuntime?.uploadFiles?.(files)}
        onProviderChange={(provider) => chatRuntime?.setSelectedProvider?.(provider)}
        onModeChange={(mode) => chatRuntime?.setSelectedMode?.(mode)}
        libraryFiles={chatRuntime?.composerAttachments || []}
        onRemoveFile={(fileId) => chatRuntime?.removeComposerAttachment?.(fileId)}
        isStreaming={chatRuntime?.isStreaming}
      />
    </div>
  </section>;
}

function ProjectPicker({ sessions, activeProject, onSelectProject, onStartCleanProject }) {
  const recent = (Array.isArray(sessions) ? sessions : []).slice(0, 24);
  return <section className="operatorModule">
    <span>PORTFOLIO</span><h1>Open a brand or project</h1><p>Selecting a project loads its server-backed conversation and assets.</p>
    <button type="button" className="operatorNewChat" onClick={onStartCleanProject}>Start clean project</button>
    <div className="operatorProjectGrid">{recent.map((session, index) => {
      const title = String(session?.title || session?.name || `Project ${index + 1}`);
      const id = session?.id || session?.sessionId || title;
      return <button key={id} type="button" className={activeProject?.id === id ? "operatorProjectCard active" : "operatorProjectCard"} onClick={() => onSelectProject({ id, title, source: "chat-session" })}><b>{title}</b><br /><small>Open conversation</small></button>;
    })}</div>
  </section>;
}

function ModuleScreen({ id }) {
  const accountKind = ACCOUNT_PAGE_MAP[id];
  if (accountKind) return <div className="operatorModule"><StreamsAccountActionPanel pageKind={accountKind} title={titleFor(id)} description={`Manage ${titleFor(id).toLowerCase()} through the connected account system.`} /></div>;
  return <section className="operatorModule"><span>STREAMS</span><h1>{titleFor(id)}</h1><p>This module opens only connected project and generation workflows.</p></section>;
}

function InlinePanel({ activeProject, onClose }) {
  return <aside className="operatorInline"><div className="operatorInlineHead"><div><span>INLINE BUILD</span><h2>{activeProject?.title}</h2></div><button type="button" aria-label="Close inline build" onClick={onClose}>×</button></div><p>Project visuals and verified artifacts appear here when generated.</p></aside>;
}

export default function StreamsOperatorShell({ chatRuntime: baseRuntime }) {
  const chatRuntime = useAuthoritativeStreamsRuntime(baseRuntime);
  const mobile = useMobile();
  const [activeSection, setActiveSection] = useState("home");
  const [activeProject, setActiveProject] = useState(null);
  const [inlineOpen, setInlineOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(window.localStorage.getItem("streams-ai.sidebar.collapsed.v2") === "1"); } catch {}
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem("streams-ai.sidebar.collapsed.v2", collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);

  const shellClass = useMemo(() => ["streamsOperator", collapsed ? "sidebarCollapsed" : "", inlineOpen ? "inlineOpen" : ""].filter(Boolean).join(" "), [collapsed, inlineOpen]);
  const newGeneralChat = () => { setActiveProject(null); setInlineOpen(false); setActiveSection("home"); chatRuntime?.newChat?.(); };
  const selectProject = (project) => { setActiveProject(project); setInlineOpen(false); setActiveSection("home"); if (project?.id) chatRuntime?.selectSession?.(project.id); };
  const startCleanProject = () => { chatRuntime?.newChat?.(); setActiveProject({ id: `draft-${Date.now()}`, title: "New clean project", source: "draft" }); setActiveSection("home"); };

  return <div className={shellClass}>
    {!mobile ? <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} collapsed={collapsed} setCollapsed={setCollapsed} onNewChat={newGeneralChat} /> : null}
    {mobile ? <button type="button" className="operatorMobileMenu" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}>☰</button> : null}
    <main className="operatorMain">
      {activeSection === "home" ? <ChatPanel chatRuntime={chatRuntime} activeProject={activeProject} onOpenInline={() => activeProject && setInlineOpen(true)} /> : activeSection === "portfolio" || activeSection === "projects" ? <ProjectPicker sessions={chatRuntime?.sessions || []} activeProject={activeProject} onSelectProject={selectProject} onStartCleanProject={startCleanProject} /> : <ModuleScreen id={activeSection} />}
    </main>
    {inlineOpen && activeProject ? <InlinePanel activeProject={activeProject} onClose={() => setInlineOpen(false)} /> : null}
    {mobile ? <div className={drawerOpen ? "operatorMobileDrawer open" : "operatorMobileDrawer"}><aside><button type="button" className="operatorNewChat" onClick={() => { newGeneralChat(); setDrawerOpen(false); }}>+ New session</button><SidebarNav activeSection={activeSection} setActiveSection={setActiveSection} onNavigate={() => setDrawerOpen(false)} /></aside><button type="button" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} /></div> : null}
  </div>;
}
