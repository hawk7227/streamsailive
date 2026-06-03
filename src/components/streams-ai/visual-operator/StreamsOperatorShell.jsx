"use client";

import React, { useEffect, useState } from "react";
import StreamsComposer from "../current-chat/new-face/composer/StreamsComposer";
import ChatMarkdownMessage from "../current-chat/new-face/markdown/ChatMarkdownMessage";

const NAV_GROUPS = [
  { title: "MAIN", items: [["home", "Home"], ["portfolio", "Portfolio"], ["projects", "Projects"]] },
  { title: "BUILD", items: [["business", "Business Builder"], ["revenue", "Revenue"], ["visuals", "Visual Concepts"], ["website", "Website Builder"], ["app", "App Builder"], ["launch", "Preview + Launch"]] },
  { title: "CREATE", items: [["studio", "Creator Studio"], ["image", "Image Studio"], ["video", "Video Studio"], ["voice", "Voice Studio"], ["captions", "Captions"], ["content", "Content"], ["ideas", "Ideas"], ["turn-you", "Turn This Into You"], ["calendar", "Calendar"], ["social", "Social Research"], ["growth-feed", "Growth Feed"], ["assets", "Assets"]] },
  { title: "GROW", items: [["checklist", "Launch Checklist"], ["growth", "Growth Dashboard"], ["notifications", "Notifications"]] },
  { title: "ACCOUNT", items: [["billing", "Billing / Credits"], ["notification-settings", "Notification Settings"], ["settings", "Settings"]] },
];

const MOBILE_TABS = [["home", "Home"], ["portfolio", "Portfolio"], ["create", "Create"], ["launch", "Launch"], ["profile", "Profile"]];
const PREVIEW_MODES = ["Concept", "Marketing", "Artifact", "Progress"];

function cleanText(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function buildSessionTitle(session, index) { return cleanText(session?.title || session?.name || session?.id) || `Project ${index + 1}`; }
function getMessageText(message) { return message?.content || message?.text || ""; }

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return isMobile;
}

function SectionButton({ active, children, onClick }) {
  return <button className={active ? "streamsOpNavButton active" : "streamsOpNavButton"} type="button" onClick={onClick}>{children}</button>;
}

function DesktopSidebar({ activeSection, setActiveSection, onNewChat }) {
  return (
    <aside className="streamsOpSidebar" aria-label="Streams AI navigation">
      <div className="streamsOpBrandBlock">
        <div className="streamsOpLogo">S</div>
        <div><strong>STREAMS AI</strong><span>Visual Operator</span></div>
      </div>
      <button type="button" className="streamsOpPrimary" onClick={onNewChat}>+ New session</button>
      <div className="streamsOpNavScroll">
        {NAV_GROUPS.map((group) => (
          <div className="streamsOpNavGroup" key={group.title}>
            <p>{group.title}</p>
            {group.items.map(([id, label]) => <SectionButton key={id} active={activeSection === id} onClick={() => setActiveSection(id)}>{label}</SectionButton>)}
          </div>
        ))}
      </div>
    </aside>
  );
}

function ChatMessage({ message }) {
  const isUser = message.role === "user";
  const text = getMessageText(message);
  return (
    <article className={isUser ? "streamsOpMsg user" : "streamsOpMsg assistant"}>
      <div className="streamsOpMsgAvatar">{isUser ? "" : "AI"}</div>
      <div className="streamsOpMsgBody">
        {message.attachments?.length ? <div className="streamsOpAttachments">{message.attachments.map((asset) => <span key={asset.id || asset.name}>{asset.name || asset.kind || "Attachment"}</span>)}</div> : null}
        {message.generatedImage?.url ? (
          <figure className="streamsOpGeneratedAsset"><img src={message.generatedImage.url} alt={message.generatedImage.name || "Generated image"} /><figcaption>{message.generatedImage.statusText || "Generated image"}</figcaption></figure>
        ) : message.generatedVideoUrl ? (
          <figure className="streamsOpGeneratedAsset"><video src={message.generatedVideoUrl} controls playsInline /><figcaption>Generated video</figcaption></figure>
        ) : <ChatMarkdownMessage content={text} />}
      </div>
    </article>
  );
}

function ChatPanel({ chatRuntime, activeProject, onOpenInline }) {
  const messages = Array.isArray(chatRuntime?.messages) ? chatRuntime.messages : [];
  const hasMessages = messages.length > 0;
  const isWorking = Boolean(chatRuntime?.isStreaming);
  return (
    <section className="streamsOpChatPanel" aria-label="Streams AI workspace">
      <div className="streamsOpChatHeader">
        <div>
          <span className="streamsOpEyebrow">STREAMS AI</span>
          <h1>{activeProject ? activeProject.title : "What do you want to build?"}</h1>
          <p>{activeProject ? "Project memory is isolated here." : "Ask anything, or open Portfolio when you want project memory."}</p>
        </div>
        <div className="streamsOpChatHeaderActions">
          <span className="streamsOpStatus">{isWorking ? "Working" : "Online"}</span>
          <button type="button" className="streamsOpGhost" disabled={!activeProject} onClick={onOpenInline}>Inline Build</button>
        </div>
      </div>
      <div className="streamsOpChatScroll">
        {!hasMessages ? (
          <div className="streamsOpChatEmpty">
            <div className="streamsOpOrb" />
            <h2>Ask, build, create, launch.</h2>
            <p>Use the chat freely, or open a saved project when you want isolated project memory and inline visual build.</p>
          </div>
        ) : messages.map((message) => <ChatMessage key={message.id || `${message.role}-${message.createdAt}`} message={message} />)}
      </div>
      <div className="streamsOpComposer">
        <StreamsComposer
          onSubmit={(payload) => chatRuntime?.sendMessage?.({ message: payload.message, composerMode: payload.composerMode, mode: payload.mode, webSearchEnabled: payload.webSearchEnabled })}
          onFilesSelected={(files) => chatRuntime?.uploadFiles?.(files)}
          onToolSelect={(tool) => { if (tool === "recent_files") chatRuntime?.setActiveArtifact?.({ type: "library" }); }}
          onProviderChange={(provider) => chatRuntime?.setSelectedProvider?.(provider)}
          onModeChange={(mode) => chatRuntime?.setSelectedMode?.(mode)}
          libraryFiles={chatRuntime?.composerAttachments || []}
          onRemoveFile={(fileId) => chatRuntime?.removeComposerAttachment?.(fileId)}
          isStreaming={chatRuntime?.isStreaming}
        />
        <small>Check important details before publishing or launching.</small>
      </div>
    </section>
  );
}

function ProjectPicker({ sessions, activeProject, onSelectProject, onStartCleanProject }) {
  const recent = (Array.isArray(sessions) ? sessions : []).slice(0, 12);
  return (
    <section className="streamsOpModuleScreen">
      <span className="streamsOpEyebrow">PORTFOLIO</span>
      <h2>Open a brand or project</h2>
      <p>No project auto-opens. Selecting a project loads only that project’s isolated memory, assets, preview state, and launch context.</p>
      <div className="streamsOpPickerActions"><button type="button" className="streamsOpPrimary noMargin" onClick={onStartCleanProject}>Start clean project</button><button type="button" className="streamsOpSecondary" onClick={() => onSelectProject(null)}>General mode</button></div>
      {recent.length ? (
        <div className="streamsOpProjectGrid">
          {recent.map((session, index) => {
            const title = buildSessionTitle(session, index);
            const id = session?.id || session?.sessionId || title;
            const selected = activeProject?.id === id;
            return <button key={id} type="button" className={selected ? "streamsOpProjectCard active" : "streamsOpProjectCard"} onClick={() => onSelectProject({ id, title, source: "chat-session" })}><strong>{title}</strong><span>{selected ? "Active project" : "Open isolated memory"}</span></button>;
          })}
        </div>
      ) : <div className="streamsOpEmptyState">No saved sessions found. Start clean or stay in general mode.</div>}
    </section>
  );
}

function InlineBuildPanel({ activeProject, inlineOpen, onClose }) {
  const [mode, setMode] = useState("Concept");
  if (!inlineOpen) return null;
  return (
    <aside className="streamsOpInlinePanel" aria-label="Inline Build panel">
      <div className="streamsOpInlineHeader"><div><span className="streamsOpEyebrow">INLINE BUILD</span><h2>{activeProject?.title || "No project selected"}</h2></div><button type="button" onClick={onClose} aria-label="Close inline build">×</button></div>
      <div className="streamsOpPreviewModeTabs">{PREVIEW_MODES.map((item) => <button key={item} type="button" className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}</div>
      <div className="streamsOpPreviewHero"><div className="streamsOpPreviewGlow" /><span>{mode}</span><h3>{activeProject ? "Visual build surface ready" : "Choose a project first"}</h3><p>{mode === "Marketing" ? "Sample promos, draft ads, and Turn This Into You belong here when wired to real generation." : mode === "Artifact" ? "The 3D artifact appears inside the preview as an ambient visual mode." : mode === "Progress" ? "Progress must reflect real saved jobs and stored outputs only." : "Concept Preview is the live visual surface for the selected brand, project, app, website, or creator idea."}</p></div>
      <div className="streamsOpIncomeStrip"><b>Income Potential — AI Estimate</b><span>Starter: --</span><span>Growth: --</span><span>Scale: --</span></div>
      <div className="streamsOpInlineActions"><button type="button">Save Concept</button><button type="button">View Revenue</button><button type="button">Turn This Into You</button></div>
    </aside>
  );
}

function HonestModuleScreen({ id, activeProject }) {
  const copy = {
    create: ["Create", "Generation studio, media tools, and Turn This Into You flows live here."],
    studio: ["Creator Studio", "Image, video, voice, captions, content, and ads belong here. Only real wired tools should generate outputs."],
    launch: ["Preview + Launch", "Launch setup appears only after build, preview, domain, or go-live intent."],
    growth: ["Growth Dashboard", "Track real project progress, generated assets, and launch momentum when connected."],
    "growth-feed": ["Growth Feed", "Real saved promo ideas, sample previews, captions, hooks, and Turn This Into You opportunities."],
    notifications: ["Notifications", "In-app, push, and optional SMS need clear consent and real saved events before sending."],
    "notification-settings": ["Notification Settings", "Push, SMS, marketing updates, quiet hours, frequency limits, and project-specific controls."],
    billing: ["Billing / Credits", "Plan, credits, hosting, and domain setup without hard-coded purchase language."],
  };
  const [title, body] = copy[id] || [NAV_GROUPS.flatMap((g) => g.items).find(([key]) => key === id)?.[1] || "Streams AI", "Ready for the next backend-connected slice."];
  return <section className="streamsOpModuleScreen"><span className="streamsOpEyebrow">{activeProject ? "PROJECT" : "GENERAL"}</span><h2>{title}</h2><p>{body}</p><div className="streamsOpModuleCards"><div><b>Status</b><span>Ready</span></div><div><b>Rule</b><span>No fake outputs</span></div><div><b>Memory</b><span>{activeProject ? "Selected project only" : "No project loaded"}</span></div></div></section>;
}

function MainContent({ activeSection, chatRuntime, activeProject, onSelectProject, onStartCleanProject, onOpenInline }) {
  if (activeSection === "home") return <ChatPanel chatRuntime={chatRuntime} activeProject={activeProject} onOpenInline={onOpenInline} />;
  if (activeSection === "portfolio" || activeSection === "projects") return <ProjectPicker sessions={chatRuntime?.sessions || []} activeProject={activeProject} onSelectProject={onSelectProject} onStartCleanProject={onStartCleanProject} />;
  return <HonestModuleScreen id={activeSection} activeProject={activeProject} />;
}

function MobileBottomNav({ activeSection, setActiveSection }) {
  return <nav className="streamsOpMobileNav" aria-label="Mobile navigation">{MOBILE_TABS.map(([id, label]) => { const target = id === "profile" ? "settings" : id; const selected = activeSection === target || (id === "create" && ["create", "studio", "image", "video", "voice", "turn-you"].includes(activeSection)); return <button key={id} type="button" className={selected ? "active" : ""} onClick={() => setActiveSection(target)}>{label}</button>; })}</nav>;
}

export default function StreamsOperatorShell({ chatRuntime }) {
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState("home");
  const [activeProject, setActiveProject] = useState(null);
  const [inlineOpen, setInlineOpen] = useState(false);

  useEffect(() => setInlineOpen(false), [activeProject?.id]);
  const startCleanProject = () => { chatRuntime?.newChat?.(); setActiveProject({ id: `draft-${Date.now()}`, title: "New clean project", source: "draft" }); setActiveSection("home"); };
  const selectProject = (project) => { setActiveProject(project); setInlineOpen(false); setActiveSection("home"); if (project?.source === "chat-session" && project.id) chatRuntime?.selectSession?.(project.id); if (!project) chatRuntime?.newChat?.(); };
  const newGeneralChat = () => { setActiveProject(null); setInlineOpen(false); setActiveSection("home"); chatRuntime?.newChat?.(); };
  const shellClass = ["streamsOpShell", inlineOpen ? "inlineOpen" : "", isMobile ? "mobile" : "desktop"].filter(Boolean).join(" ");

  return (
    <div className={shellClass}>
      <style>{styles}</style>
      {!isMobile ? <DesktopSidebar activeSection={activeSection} setActiveSection={setActiveSection} onNewChat={newGeneralChat} /> : null}
      <main className="streamsOpMain"><MainContent activeSection={activeSection} chatRuntime={chatRuntime} activeProject={activeProject} onSelectProject={selectProject} onStartCleanProject={startCleanProject} onOpenInline={() => activeProject && setInlineOpen(true)} /></main>
      <InlineBuildPanel activeProject={activeProject} inlineOpen={inlineOpen} onClose={() => setInlineOpen(false)} />
      {isMobile ? <MobileBottomNav activeSection={activeSection} setActiveSection={setActiveSection} /> : null}
    </div>
  );
}

const styles = `
.streamsOpShell{min-height:100dvh;height:100dvh;display:grid;grid-template-columns:238px minmax(0,1fr);background:#050713;color:#eff6ff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}.streamsOpShell.inlineOpen{grid-template-columns:238px minmax(0,1fr) minmax(330px,400px)}.streamsOpSidebar{border-right:1px solid rgba(67,201,255,.16);background:linear-gradient(180deg,#0a1024,#060817 68%,#050713);display:flex;flex-direction:column;min-width:0;box-shadow:22px 0 70px rgba(0,0,0,.28);overflow:hidden}.streamsOpBrandBlock{display:flex;gap:10px;align-items:center;padding:14px 13px 10px}.streamsOpBrandBlock strong{display:block;font-size:13px;letter-spacing:.16em}.streamsOpBrandBlock span{display:block;color:#8ea2c7;font-size:11px}.streamsOpLogo{width:34px;height:34px;border-radius:14px;background:linear-gradient(135deg,#26d9ff,#8a5cff 65%,#ff5fd7);display:grid;place-items:center;font-weight:900;box-shadow:0 0 30px rgba(38,217,255,.34)}.streamsOpPrimary,.streamsOpSecondary,.streamsOpGhost{border:0;border-radius:12px;min-height:34px;padding:0 11px;font-weight:850}.streamsOpPrimary{margin:0 10px 8px;background:linear-gradient(135deg,#18d6ff,#7d5cff);color:#04101e;box-shadow:0 14px 34px rgba(21,214,255,.24)}.streamsOpPrimary.noMargin{margin:0}.streamsOpSecondary{background:rgba(255,255,255,.08);color:#eaf3ff;border:1px solid rgba(255,255,255,.14)}.streamsOpGhost{background:rgba(255,255,255,.07);border:1px solid rgba(148,163,184,.2);color:#eaf3ff}.streamsOpGhost:disabled{opacity:.32;cursor:not-allowed}.streamsOpNavScroll{overflow:hidden;padding:0 8px 8px;display:flex;flex-direction:column}.streamsOpNavGroup{margin:3px 0}.streamsOpNavGroup p{margin:4px 8px 3px;color:#6983b2;font-size:9px;font-weight:900;letter-spacing:.16em}.streamsOpNavButton{width:100%;border:0;background:transparent;color:#c0d4f7;text-align:left;border-radius:10px;min-height:25px;padding:0 9px;font-weight:750;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.streamsOpNavButton:hover,.streamsOpNavButton.active{background:rgba(45,212,255,.12);color:#fff}.streamsOpNavButton.active{box-shadow:inset 0 0 0 1px rgba(45,212,255,.26),0 0 18px rgba(45,212,255,.08)}.streamsOpMain{min-width:0;height:100dvh;display:flex;flex-direction:column;background:radial-gradient(circle at top right,rgba(84,94,255,.20),transparent 34%),radial-gradient(circle at 20% 0,rgba(0,225,255,.12),transparent 28%),#070a18;padding:14px}.streamsOpChatPanel{height:100%;min-height:0;border:1px solid rgba(65,199,255,.22);background:linear-gradient(180deg,rgba(9,14,31,.98),rgba(6,9,21,.98));color:#f5fbff;border-radius:26px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;box-shadow:0 0 0 1px rgba(124,92,255,.08),0 30px 90px rgba(0,0,0,.32)}.streamsOpChatHeader{display:flex;justify-content:space-between;gap:12px;padding:13px 16px;border-bottom:1px solid rgba(65,199,255,.15);background:linear-gradient(90deg,rgba(24,214,255,.06),rgba(124,92,255,.08))}.streamsOpEyebrow{display:block;color:#45e6ff;font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.streamsOpChatHeader h1{font-size:24px;line-height:1.08;margin:3px 0 0;color:#fff}.streamsOpChatHeader p{margin:4px 0 0;color:#a8b9da;font-size:12px;line-height:1.35}.streamsOpChatHeaderActions{display:flex;align-items:flex-start;gap:7px}.streamsOpStatus{border:1px solid rgba(45,212,255,.25);background:rgba(45,212,255,.10);color:#bdf5ff;border-radius:999px;padding:8px 10px;font-size:12px;font-weight:900}.streamsOpChatScroll{min-height:0;overflow:auto;padding:22px;display:flex;flex-direction:column;gap:18px;background:radial-gradient(circle at 50% 0,rgba(45,212,255,.10),transparent 33%)}.streamsOpChatEmpty{margin:auto;text-align:center;max-width:620px;color:#f8fbff}.streamsOpOrb{width:86px;height:86px;margin:0 auto 18px;border-radius:28px;background:radial-gradient(circle,#36e8ff,transparent 58%),linear-gradient(135deg,#1948ff,#8d51ff,#ff4ccd);filter:drop-shadow(0 0 34px rgba(54,232,255,.44))}.streamsOpChatEmpty h2{font-size:34px;margin:0 0 10px;color:#fff}.streamsOpChatEmpty p{color:#9fb1d3;line-height:1.6;font-size:17px}.streamsOpMsg{display:grid;grid-template-columns:42px minmax(0,1fr);gap:12px;max-width:920px}.streamsOpMsg.user{margin-left:auto;grid-template-columns:minmax(0,1fr) 0}.streamsOpMsg.user .streamsOpMsgAvatar{display:none}.streamsOpMsg.user .streamsOpMsgBody{grid-column:1;grid-row:1;background:linear-gradient(135deg,#111a38,#0c1025);color:#fff!important;border-color:rgba(45,212,255,.16);border-radius:24px 24px 4px 24px;box-shadow:0 18px 48px rgba(0,0,0,.22)}.streamsOpMsg.user .streamsOpMsgBody *{color:#fff!important}.streamsOpMsgAvatar{width:38px;height:38px;border-radius:14px;display:grid;place-items:center;background:#111a38;color:#78e4ff;font-size:12px;font-weight:900;border:1px solid rgba(45,212,255,.18)}.streamsOpMsgBody{background:rgba(10,17,38,.86);border:1px solid rgba(99,131,189,.26);border-radius:24px 24px 24px 5px;padding:15px 17px;line-height:1.68;overflow:hidden;color:#eef6ff;font-size:18px}.streamsOpMsgBody p{margin:0 0 12px}.streamsOpAttachments{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.streamsOpAttachments span{background:rgba(255,255,255,.09);border-radius:999px;padding:4px 8px;font-size:12px}.streamsOpGeneratedAsset{margin:0}.streamsOpGeneratedAsset img,.streamsOpGeneratedAsset video{width:min(100%,420px);border-radius:18px;display:block;background:#000}.streamsOpGeneratedAsset figcaption{font-size:12px;color:#9fb1d3;margin-top:8px}.streamsOpComposer{border-top:1px solid rgba(65,199,255,.14);padding:12px 14px 14px;background:rgba(3,6,16,.76)}.streamsOpComposer :is(input,textarea){color:#fff!important}.streamsOpComposer small{display:block;text-align:center;color:#7e91b4;margin-top:7px;font-size:11px}.streamsOpModuleScreen{height:100%;overflow:auto;border:1px solid rgba(65,199,255,.22);background:linear-gradient(135deg,rgba(10,15,34,.97),rgba(7,9,22,.96));border-radius:24px;padding:18px;box-shadow:0 22px 70px rgba(0,0,0,.18)}.streamsOpModuleScreen h2{font-size:30px;margin:5px 0 8px;color:#fff}.streamsOpModuleScreen p{color:#a8b9da;line-height:1.55}.streamsOpPickerActions{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.streamsOpProjectGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.streamsOpProjectCard{border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.05);color:#edf6ff;text-align:left;border-radius:18px;padding:14px;min-height:86px}.streamsOpProjectCard strong,.streamsOpProjectCard span{display:block}.streamsOpProjectCard span{margin-top:8px;color:#9eb0d0;font-size:12px}.streamsOpProjectCard.active{border-color:#32d8ff;box-shadow:0 0 0 1px rgba(50,216,255,.14),0 0 26px rgba(50,216,255,.18)}.streamsOpEmptyState{color:#91a4c5;border:1px dashed rgba(148,163,184,.2);border-radius:16px;padding:16px}.streamsOpModuleCards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:20px}.streamsOpModuleCards div{border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.05);border-radius:18px;padding:16px}.streamsOpModuleCards b,.streamsOpModuleCards span{display:block}.streamsOpModuleCards span{margin-top:8px;color:#a6b9dc}.streamsOpInlinePanel{height:100dvh;overflow:auto;border-left:1px solid rgba(65,199,255,.18);background:linear-gradient(180deg,#090d1b,#0e1430);padding:18px;min-width:0}.streamsOpInlineHeader{display:flex;align-items:start;justify-content:space-between;gap:12px;margin-bottom:14px}.streamsOpInlineHeader h2{font-size:23px;margin:4px 0 0}.streamsOpInlineHeader button{width:38px;height:38px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.06);color:#fff;font-size:24px}.streamsOpPreviewModeTabs{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px}.streamsOpPreviewModeTabs button{border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.05);color:#dce9ff;border-radius:14px;min-height:38px}.streamsOpPreviewModeTabs button.active{background:linear-gradient(135deg,#12d6ff,#7a5cff);color:#06101d;font-weight:900}.streamsOpPreviewHero{position:relative;min-height:260px;border:1px solid rgba(45,212,255,.22);border-radius:28px;overflow:hidden;background:radial-gradient(circle at 50% 30%,rgba(51,214,255,.28),transparent 28%),linear-gradient(135deg,rgba(36,50,96,.95),rgba(8,11,24,.95));padding:22px;display:flex;flex-direction:column;justify-content:end}.streamsOpPreviewGlow{position:absolute;inset:40px;border-radius:999px;background:linear-gradient(135deg,#1ee7ff,#905cff,#ff62c7);filter:blur(44px);opacity:.34}.streamsOpPreviewHero span,.streamsOpPreviewHero h3,.streamsOpPreviewHero p{position:relative}.streamsOpPreviewHero span{color:#7df0ff;font-weight:900;font-size:12px;letter-spacing:.14em;text-transform:uppercase}.streamsOpPreviewHero h3{font-size:27px;margin:8px 0 6px}.streamsOpPreviewHero p{color:#9eb0d0;line-height:1.55}.streamsOpIncomeStrip{margin-top:12px;border:1px solid rgba(45,212,255,.18);background:rgba(255,255,255,.06);border-radius:18px;padding:12px;display:grid;gap:6px;font-size:13px}.streamsOpIncomeStrip b{color:#fff}.streamsOpIncomeStrip span{color:#aecaef}.streamsOpInlineActions{display:grid;gap:8px;margin-top:12px}.streamsOpInlineActions button{border:1px solid rgba(255,255,255,.13);border-radius:14px;min-height:40px;background:rgba(255,255,255,.07);color:#eff6ff;font-weight:800}.streamsOpMobileNav{display:none}@media (max-width:899px){.streamsOpShell,.streamsOpShell.inlineOpen{display:flex;flex-direction:column;height:100dvh;min-height:100dvh;overflow:hidden}.streamsOpMain{height:auto;flex:1;min-height:0;padding:10px 10px 84px}.streamsOpChatHeader{padding:12px 14px}.streamsOpChatHeader h1{font-size:20px}.streamsOpChatHeaderActions{gap:6px}.streamsOpGhost{min-height:34px;font-size:12px;padding:0 10px}.streamsOpStatus{padding:7px 9px}.streamsOpChatScroll{padding:14px}.streamsOpComposer{padding:10px 10px calc(10px + env(safe-area-inset-bottom,0px))}.streamsOpModuleScreen{height:calc(100dvh - 104px);border-radius:20px}.streamsOpInlinePanel{position:fixed;left:0;right:0;top:0;bottom:74px;height:auto;z-index:80;border-left:0;border-bottom:1px solid rgba(148,163,184,.2)}.streamsOpPreviewHero{min-height:210px}.streamsOpMobileNav{position:fixed;left:0;right:0;bottom:0;z-index:90;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:8px 8px calc(8px + env(safe-area-inset-bottom,0px));background:rgba(8,11,24,.96);border-top:1px solid rgba(148,163,184,.18);backdrop-filter:blur(18px)}.streamsOpMobileNav button{border:0;background:transparent;color:#91a4c5;border-radius:14px;min-height:44px;font-size:12px;font-weight:800}.streamsOpMobileNav button.active{background:rgba(45,212,255,.14);color:#fff}.streamsOpMsg{max-width:100%;grid-template-columns:32px minmax(0,1fr);gap:8px}.streamsOpMsg.user{grid-template-columns:minmax(0,1fr) 0}.streamsOpMsgAvatar{width:32px;height:32px;border-radius:12px}.streamsOpMsgBody{padding:12px 13px}.streamsOpChatEmpty h2{font-size:24px}}
`;
