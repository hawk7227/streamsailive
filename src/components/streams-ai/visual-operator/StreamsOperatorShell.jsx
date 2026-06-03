"use client";

import React, { useEffect, useMemo, useState } from "react";
import StreamsComposer from "../current-chat/new-face/composer/StreamsComposer";
import ChatMarkdownMessage from "../current-chat/new-face/markdown/ChatMarkdownMessage";

const NAV_GROUPS = [
  {
    title: "MAIN",
    items: [
      ["home", "AI Operator Home"],
      ["portfolio", "Brand Portfolio"],
      ["projects", "Projects & Concepts"],
    ],
  },
  {
    title: "BUILD",
    items: [
      ["business", "Business Builder"],
      ["revenue", "Revenue / Income Potential"],
      ["visuals", "Visual Concepts / 3D Artifacts"],
      ["website", "Website Builder"],
      ["app", "App Builder"],
      ["launch", "Preview + Launch"],
    ],
  },
  {
    title: "CREATE",
    items: [
      ["studio", "Creator Studio"],
      ["image", "AI Image Studio"],
      ["video", "AI Video Studio"],
      ["voice", "AI Voice Studio"],
      ["captions", "Captions & Subtitles"],
      ["content", "Content Generator"],
      ["ideas", "Ideas & Topics"],
      ["turn-you", "Turn This Into You"],
      ["calendar", "Content Calendar"],
      ["social", "Social Research"],
      ["growth-feed", "Growth Feed / Marketing Feed"],
      ["assets", "Assets Library"],
    ],
  },
  {
    title: "GROW",
    items: [
      ["checklist", "Launch Checklist"],
      ["growth", "Growth Dashboard"],
      ["notifications", "Notifications"],
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      ["billing", "Billing / Credits / Hosting"],
      ["notification-settings", "Notification Settings"],
      ["settings", "Settings"],
    ],
  },
];

const MOBILE_TABS = [
  ["home", "Home"],
  ["portfolio", "Portfolio"],
  ["create", "Create"],
  ["launch", "Launch"],
  ["profile", "Profile"],
];

const PREVIEW_MODES = ["Concept", "Marketing", "Artifact", "Progress"];

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildSessionTitle(session, index) {
  return cleanText(session?.title || session?.name || session?.id) || `Recent project ${index + 1}`;
}

function getMessageText(message) {
  return message?.content || message?.text || "";
}

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
  return (
    <button className={active ? "streamsOpNavButton active" : "streamsOpNavButton"} type="button" onClick={onClick}>
      <span>{children}</span>
    </button>
  );
}

function DesktopSidebar({ activeSection, setActiveSection, onNewChat }) {
  return (
    <aside className="streamsOpSidebar" aria-label="Streams AI navigation">
      <div className="streamsOpBrandBlock">
        <div className="streamsOpLogo">S</div>
        <div>
          <strong>STREAMS AI</strong>
          <span>Visual Operator</span>
        </div>
      </div>
      <button type="button" className="streamsOpPrimary" onClick={onNewChat}>+ New clean session</button>
      <div className="streamsOpNavScroll">
        {NAV_GROUPS.map((group) => (
          <div className="streamsOpNavGroup" key={group.title}>
            <p>{group.title}</p>
            {group.items.map(([id, label]) => (
              <SectionButton key={id} active={activeSection === id} onClick={() => setActiveSection(id)}>{label}</SectionButton>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

function TopBar({ activeProject, activeSection, onOpenInline, inlineOpen }) {
  const sectionName = NAV_GROUPS.flatMap((g) => g.items).find(([id]) => id === activeSection)?.[1] || "AI Operator Home";
  return (
    <header className="streamsOpTopbar">
      <div>
        <span className="streamsOpEyebrow">{sectionName}</span>
        <h1>{activeProject ? activeProject.title : "Choose what you want to build"}</h1>
      </div>
      <div className="streamsOpTopActions">
        <div className="streamsOpProjectBadge" title="Project-scoped memory status">
          {activeProject ? "Project memory isolated" : "General mode"}
        </div>
        <button type="button" className="streamsOpGhost" onClick={onOpenInline} disabled={!activeProject}>
          {inlineOpen ? "Inline Build Open" : "Open Inline Build"}
        </button>
      </div>
    </header>
  );
}

function ProjectPicker({ sessions, activeProject, onSelectProject, onStartCleanProject }) {
  const recent = (Array.isArray(sessions) ? sessions : []).slice(0, 8);
  return (
    <section className="streamsOpPicker" aria-label="Brand and project picker">
      <div>
        <span className="streamsOpEyebrow">No project auto-opened</span>
        <h2>{activeProject ? activeProject.title : "Start general, or open a project when you are ready."}</h2>
        <p>
          Project memory stays isolated. The inline build remains closed until you choose the brand, concept, or session you want to work on.
        </p>
      </div>
      <div className="streamsOpPickerActions">
        <button type="button" className="streamsOpPrimary" onClick={onStartCleanProject}>Start clean project</button>
        <button type="button" className="streamsOpSecondary" onClick={() => onSelectProject(null)}>General assistant mode</button>
      </div>
      {recent.length ? (
        <div className="streamsOpProjectGrid">
          {recent.map((session, index) => {
            const title = buildSessionTitle(session, index);
            const id = session?.id || session?.sessionId || title;
            const selected = activeProject?.id === id;
            return (
              <button
                key={id}
                type="button"
                className={selected ? "streamsOpProjectCard active" : "streamsOpProjectCard"}
                onClick={() => onSelectProject({ id, title, source: "chat-session" })}
              >
                <strong>{title}</strong>
                <span>{selected ? "Active project" : "Open isolated memory"}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="streamsOpEmptyState">No saved chat sessions found yet. Start a clean project or use general assistant mode.</div>
      )}
    </section>
  );
}

function ChatMessage({ message }) {
  const isUser = message.role === "user";
  const text = getMessageText(message);
  return (
    <article className={isUser ? "streamsOpMsg user" : "streamsOpMsg assistant"}>
      <div className="streamsOpMsgAvatar">{isUser ? "You" : "AI"}</div>
      <div className="streamsOpMsgBody">
        {message.attachments?.length ? (
          <div className="streamsOpAttachments">
            {message.attachments.map((asset) => <span key={asset.id || asset.name}>{asset.name || asset.kind || "Attachment"}</span>)}
          </div>
        ) : null}
        {message.generatedImage?.url ? (
          <figure className="streamsOpGeneratedAsset">
            <img src={message.generatedImage.url} alt={message.generatedImage.name || "Generated image"} />
            <figcaption>{message.generatedImage.statusText || "Generated image"}</figcaption>
          </figure>
        ) : message.generatedVideoUrl ? (
          <figure className="streamsOpGeneratedAsset">
            <video src={message.generatedVideoUrl} controls playsInline />
            <figcaption>Generated video</figcaption>
          </figure>
        ) : (
          <ChatMarkdownMessage content={text} />
        )}
      </div>
    </article>
  );
}

function ChatPanel({ chatRuntime, activeProject }) {
  const messages = Array.isArray(chatRuntime?.messages) ? chatRuntime.messages : [];
  const hasMessages = messages.length > 0;
  return (
    <section className="streamsOpChatPanel" aria-label="AI Command Chat">
      <div className="streamsOpChatHeader">
        <div>
          <span className="streamsOpEyebrow">AI Command Chat</span>
          <h2>{activeProject ? "Project-scoped assistant" : "Full assistant fallback"}</h2>
        </div>
        <span className="streamsOpStatus">{chatRuntime?.statusLabel || "Ready"}</span>
      </div>
      <div className="streamsOpChatScroll">
        {!hasMessages ? (
          <div className="streamsOpChatEmpty">
            <h3>{activeProject ? "Tell Streams AI what to build next." : "Ask anything, or choose a project to open inline build."}</h3>
            <p>
              The current broad chat ability stays available for writing, coding, architecture, UI/UX, marketing, troubleshooting, research, documentation, and problem-solving.
            </p>
          </div>
        ) : (
          messages.map((message) => <ChatMessage key={message.id || `${message.role}-${message.createdAt}`} message={message} />)
        )}
      </div>
      <div className="streamsOpComposer">
        <StreamsComposer
          onSubmit={(payload) => chatRuntime?.sendMessage?.({
            message: payload.message,
            composerMode: payload.composerMode,
            mode: payload.mode,
            webSearchEnabled: payload.webSearchEnabled,
          })}
          onFilesSelected={(files) => chatRuntime?.uploadFiles?.(files)}
          onToolSelect={(tool) => {
            if (tool === "recent_files") chatRuntime?.setActiveArtifact?.({ type: "library" });
          }}
          onProviderChange={(provider) => chatRuntime?.setSelectedProvider?.(provider)}
          onModeChange={(mode) => chatRuntime?.setSelectedMode?.(mode)}
          libraryFiles={chatRuntime?.composerAttachments || []}
          onRemoveFile={(fileId) => chatRuntime?.removeComposerAttachment?.(fileId)}
          isStreaming={chatRuntime?.isStreaming}
        />
        <small>Streams AI can make mistakes. Check important details before launch or publishing.</small>
      </div>
    </section>
  );
}

function InlineBuildPanel({ activeProject, inlineOpen, onClose }) {
  const [mode, setMode] = useState("Concept");
  if (!inlineOpen) return null;
  return (
    <aside className="streamsOpInlinePanel" aria-label="Inline Build panel">
      <div className="streamsOpInlineHeader">
        <div>
          <span className="streamsOpEyebrow">Inline Build</span>
          <h2>{activeProject?.title || "No project selected"}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close inline build">×</button>
      </div>
      <div className="streamsOpPreviewModeTabs">
        {PREVIEW_MODES.map((item) => <button key={item} type="button" className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}
      </div>
      <div className="streamsOpPreviewHero">
        <div className="streamsOpPreviewGlow" />
        <span>{mode} Mode</span>
        <h3>{activeProject ? "Ready to render this project visually" : "Select a project to open inline build"}</h3>
        <p>
          {mode === "Marketing"
            ? "Marketing Preview is ready for real sample promos, draft ads, and Turn This Into You flows when generation is wired."
            : mode === "Artifact"
              ? "The 3D artifact belongs inside this preview as an ambient visual mode, not a large standalone block."
              : mode === "Progress"
                ? "Build progress should show real saved jobs and real generated outputs only."
                : "Concept Preview is the live visual surface for the selected brand, project, app, website, or creator idea."}
        </p>
      </div>
      <div className="streamsOpIncomeStrip">
        <b>Income Potential — AI Estimate</b>
        <span>Starter: --</span>
        <span>Growth: --</span>
        <span>Scale: --</span>
      </div>
      <div className="streamsOpInlineActions">
        <button type="button">Save Concept</button>
        <button type="button">View Revenue Plan</button>
        <button type="button">Turn This Into You</button>
      </div>
      <p className="streamsOpTruthNote">
        No fake generation: live videos, promos, domains, SMS, and launch actions must connect to real stored outputs before they appear as complete.
      </p>
    </aside>
  );
}

function HonestModuleScreen({ id, activeProject }) {
  const copy = {
    portfolio: ["Brand Portfolio", "Manage unlimited brands, projects, concepts, campaigns, and assets once the portfolio backend is connected."],
    projects: ["Projects & Concepts", "Open isolated project memory. No project context loads until you choose it."],
    create: ["Create", "Open generation studio routes, media tools, and Turn This Into You flows from one place."],
    studio: ["Creator Studio", "Image, video, voice, captions, content, and ads belong here. Only real wired tools should generate outputs."],
    launch: ["Preview + Launch", "Launch setup appears only after the user asks to build, preview, get a domain, or go live."],
    growth: ["Growth Dashboard", "Track real project progress, generated assets, and launch momentum when data is connected."],
    "growth-feed": ["Growth Feed / Marketing Feed", "Surface real saved promo ideas, sample previews, captions, hooks, and Turn This Into You opportunities."],
    notifications: ["Notifications", "In-app, push, and optional SMS need clear consent and real saved events before sending."],
    "notification-settings": ["Notification Settings", "Push, SMS, marketing updates, quiet hours, frequency limits, and project-specific controls."],
    billing: ["Billing / Credits / Hosting", "Show plan, credits, hosting, and domain setup without hard-coded purchase language."],
  };
  const [title, body] = copy[id] || [NAV_GROUPS.flatMap((g) => g.items).find(([key]) => key === id)?.[1] || "Streams AI", "This production shell is ready for the next real backend-connected slice."];
  return (
    <section className="streamsOpModuleScreen">
      <span className="streamsOpEyebrow">{activeProject ? "Project scoped" : "General mode"}</span>
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="streamsOpModuleCards">
        <div><b>Status</b><span>Shell ready</span></div>
        <div><b>Rule</b><span>No fake outputs</span></div>
        <div><b>Memory</b><span>{activeProject ? "Selected project only" : "No project loaded"}</span></div>
      </div>
    </section>
  );
}

function MainContent({ activeSection, chatRuntime, activeProject, onSelectProject, onStartCleanProject }) {
  if (activeSection === "home") {
    return (
      <div className="streamsOpHomeStack">
        <ProjectPicker sessions={chatRuntime?.sessions || []} activeProject={activeProject} onSelectProject={onSelectProject} onStartCleanProject={onStartCleanProject} />
        <ChatPanel chatRuntime={chatRuntime} activeProject={activeProject} />
      </div>
    );
  }
  if (activeSection === "portfolio" || activeSection === "projects") {
    return (
      <div className="streamsOpHomeStack">
        <ProjectPicker sessions={chatRuntime?.sessions || []} activeProject={activeProject} onSelectProject={onSelectProject} onStartCleanProject={onStartCleanProject} />
        <HonestModuleScreen id={activeSection} activeProject={activeProject} />
      </div>
    );
  }
  return <HonestModuleScreen id={activeSection} activeProject={activeProject} />;
}

function MobileBottomNav({ activeSection, setActiveSection }) {
  return (
    <nav className="streamsOpMobileNav" aria-label="Mobile navigation">
      {MOBILE_TABS.map(([id, label]) => {
        const target = id === "profile" ? "settings" : id;
        const selected = activeSection === target || (id === "create" && ["create", "studio", "image", "video", "voice", "turn-you"].includes(activeSection));
        return <button key={id} type="button" className={selected ? "active" : ""} onClick={() => setActiveSection(target)}>{label}</button>;
      })}
    </nav>
  );
}

export default function StreamsOperatorShell({ chatRuntime }) {
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState("home");
  const [activeProject, setActiveProject] = useState(null);
  const [inlineOpen, setInlineOpen] = useState(false);

  useEffect(() => {
    setInlineOpen(false);
  }, [activeProject?.id]);

  const canOpenInline = Boolean(activeProject);
  const startCleanProject = () => {
    chatRuntime?.newChat?.();
    setActiveProject({ id: `draft-${Date.now()}`, title: "New clean project", source: "draft" });
    setActiveSection("home");
  };

  const selectProject = (project) => {
    setActiveProject(project);
    setActiveSection("home");
    if (project?.source === "chat-session" && project.id) chatRuntime?.selectSession?.(project.id);
    if (!project) chatRuntime?.newChat?.();
  };

  const newGeneralChat = () => {
    setActiveProject(null);
    setInlineOpen(false);
    setActiveSection("home");
    chatRuntime?.newChat?.();
  };

  const shellClass = useMemo(() => ["streamsOpShell", inlineOpen ? "inlineOpen" : "", isMobile ? "mobile" : "desktop"].filter(Boolean).join(" "), [inlineOpen, isMobile]);

  return (
    <div className={shellClass}>
      <style>{styles}</style>
      {!isMobile ? <DesktopSidebar activeSection={activeSection} setActiveSection={setActiveSection} onNewChat={newGeneralChat} /> : null}
      <main className="streamsOpMain">
        <TopBar activeProject={activeProject} activeSection={activeSection} inlineOpen={inlineOpen} onOpenInline={() => canOpenInline && setInlineOpen(true)} />
        <MainContent activeSection={activeSection} chatRuntime={chatRuntime} activeProject={activeProject} onSelectProject={selectProject} onStartCleanProject={startCleanProject} />
      </main>
      <InlineBuildPanel activeProject={activeProject} inlineOpen={inlineOpen} onClose={() => setInlineOpen(false)} />
      {isMobile ? <MobileBottomNav activeSection={activeSection} setActiveSection={setActiveSection} /> : null}
    </div>
  );
}

const styles = `
.streamsOpShell{min-height:100dvh;height:100dvh;display:grid;grid-template-columns:292px minmax(0,1fr);background:#080b18;color:#eff6ff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}.streamsOpShell.inlineOpen{grid-template-columns:292px minmax(0,1fr) minmax(360px,440px)}.streamsOpSidebar{border-right:1px solid rgba(148,163,184,.18);background:linear-gradient(180deg,#0c1024,#080b18);display:flex;flex-direction:column;min-width:0}.streamsOpBrandBlock{display:flex;gap:12px;align-items:center;padding:22px}.streamsOpBrandBlock strong{display:block;font-size:15px;letter-spacing:.12em}.streamsOpBrandBlock span{display:block;color:#8ea2c7;font-size:12px}.streamsOpLogo{width:40px;height:40px;border-radius:16px;background:linear-gradient(135deg,#26d9ff,#8a5cff 65%,#ff5fd7);display:grid;place-items:center;font-weight:900;box-shadow:0 0 34px rgba(38,217,255,.28)}.streamsOpPrimary,.streamsOpSecondary,.streamsOpGhost{border:0;border-radius:14px;min-height:42px;padding:0 14px;font-weight:800}.streamsOpPrimary{margin:0 18px 16px;background:linear-gradient(135deg,#18d6ff,#7d5cff);color:#06101d;box-shadow:0 16px 38px rgba(21,214,255,.24)}.streamsOpSecondary{background:rgba(255,255,255,.08);color:#eaf3ff;border:1px solid rgba(255,255,255,.14)}.streamsOpGhost{background:rgba(255,255,255,.07);border:1px solid rgba(148,163,184,.2);color:#eaf3ff}.streamsOpGhost:disabled{opacity:.42;cursor:not-allowed}.streamsOpNavScroll{overflow:auto;padding:0 12px 18px}.streamsOpNavGroup{margin:8px 0 18px}.streamsOpNavGroup p{margin:0 10px 8px;color:#6780aa;font-size:11px;font-weight:900;letter-spacing:.13em}.streamsOpNavButton{width:100%;border:0;background:transparent;color:#b6c7e6;text-align:left;border-radius:13px;min-height:38px;padding:0 12px;font-weight:650}.streamsOpNavButton:hover,.streamsOpNavButton.active{background:rgba(45,212,255,.12);color:#fff}.streamsOpNavButton.active{box-shadow:inset 0 0 0 1px rgba(45,212,255,.24)}.streamsOpMain{min-width:0;height:100dvh;display:flex;flex-direction:column;background:radial-gradient(circle at top right,rgba(84,94,255,.16),transparent 34%),#0a0e1d}.streamsOpTopbar{min-height:76px;border-bottom:1px solid rgba(148,163,184,.14);display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px 24px}.streamsOpEyebrow{display:block;color:#54dfff;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.streamsOpTopbar h1,.streamsOpChatHeader h2,.streamsOpPicker h2,.streamsOpModuleScreen h2,.streamsOpInlineHeader h2{margin:4px 0 0;font-size:clamp(22px,2vw,34px);line-height:1.05}.streamsOpTopActions{display:flex;align-items:center;gap:10px}.streamsOpProjectBadge,.streamsOpStatus{border:1px solid rgba(148,163,184,.2);background:rgba(255,255,255,.06);color:#c9d7f3;border-radius:999px;padding:10px 12px;font-size:12px;font-weight:800}.streamsOpHomeStack{height:calc(100dvh - 76px);min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:14px;padding:16px;overflow:hidden}.streamsOpPicker,.streamsOpModuleScreen{border:1px solid rgba(148,163,184,.18);background:linear-gradient(135deg,rgba(14,20,42,.96),rgba(13,16,32,.92));border-radius:24px;padding:18px;box-shadow:0 22px 70px rgba(0,0,0,.18)}.streamsOpPicker{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:start}.streamsOpPicker p,.streamsOpModuleScreen p,.streamsOpPreviewHero p,.streamsOpTruthNote,.streamsOpChatEmpty p{color:#9eb0d0;line-height:1.55}.streamsOpPickerActions{display:flex;gap:10px;align-items:center}.streamsOpProjectGrid{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.streamsOpProjectCard{border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.05);color:#edf6ff;text-align:left;border-radius:18px;padding:14px;min-height:86px}.streamsOpProjectCard strong,.streamsOpProjectCard span{display:block}.streamsOpProjectCard span{margin-top:8px;color:#9eb0d0;font-size:12px}.streamsOpProjectCard.active{border-color:#32d8ff;box-shadow:0 0 0 1px rgba(50,216,255,.14),0 0 26px rgba(50,216,255,.18)}.streamsOpEmptyState{grid-column:1/-1;color:#91a4c5;border:1px dashed rgba(148,163,184,.2);border-radius:16px;padding:16px}.streamsOpChatPanel{min-height:0;border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.97);color:#0b1020;border-radius:26px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden}.streamsOpChatHeader{display:flex;justify-content:space-between;gap:14px;padding:18px 22px;border-bottom:1px solid rgba(15,23,42,.08)}.streamsOpChatHeader .streamsOpEyebrow{color:#385dff}.streamsOpChatHeader h2{font-size:21px}.streamsOpStatus{background:#eef5ff;color:#1b2d52;border-color:#d7e5fb}.streamsOpChatScroll{min-height:0;overflow:auto;padding:22px;display:flex;flex-direction:column;gap:18px}.streamsOpChatEmpty{margin:auto;text-align:center;max-width:560px}.streamsOpChatEmpty h3{font-size:28px;margin:0 0 10px}.streamsOpMsg{display:grid;grid-template-columns:40px minmax(0,1fr);gap:12px;max-width:900px}.streamsOpMsg.user{margin-left:auto;grid-template-columns:minmax(0,1fr) 40px}.streamsOpMsg.user .streamsOpMsgAvatar{grid-column:2}.streamsOpMsg.user .streamsOpMsgBody{grid-column:1;grid-row:1;background:#0b1020;color:white;border-radius:22px 22px 4px 22px}.streamsOpMsgAvatar{width:38px;height:38px;border-radius:14px;display:grid;place-items:center;background:#101735;color:#78e4ff;font-size:11px;font-weight:900}.streamsOpMsgBody{background:#f6f8fc;border:1px solid #e8edf6;border-radius:22px 22px 22px 4px;padding:14px 16px;line-height:1.6;overflow:hidden}.streamsOpAttachments{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.streamsOpAttachments span{background:rgba(17,24,39,.09);border-radius:999px;padding:4px 8px;font-size:12px}.streamsOpGeneratedAsset{margin:0}.streamsOpGeneratedAsset img,.streamsOpGeneratedAsset video{width:min(100%,420px);border-radius:18px;display:block;background:#000}.streamsOpGeneratedAsset figcaption{font-size:12px;color:#64748b;margin-top:8px}.streamsOpComposer{border-top:1px solid rgba(15,23,42,.08);padding:14px 18px 16px}.streamsOpComposer small{display:block;text-align:center;color:#7b8495;margin-top:8px;font-size:12px}.streamsOpInlinePanel{height:100dvh;overflow:auto;border-left:1px solid rgba(148,163,184,.18);background:linear-gradient(180deg,#090d1b,#0e1430);padding:18px;min-width:0}.streamsOpInlineHeader{display:flex;align-items:start;justify-content:space-between;gap:12px;margin-bottom:14px}.streamsOpInlineHeader h2{font-size:23px}.streamsOpInlineHeader button{width:38px;height:38px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.06);color:#fff;font-size:24px}.streamsOpPreviewModeTabs{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px}.streamsOpPreviewModeTabs button{border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.05);color:#dce9ff;border-radius:14px;min-height:38px}.streamsOpPreviewModeTabs button.active{background:linear-gradient(135deg,#12d6ff,#7a5cff);color:#06101d;font-weight:900}.streamsOpPreviewHero{position:relative;min-height:260px;border:1px solid rgba(45,212,255,.22);border-radius:28px;overflow:hidden;background:radial-gradient(circle at 50% 30%,rgba(51,214,255,.28),transparent 28%),linear-gradient(135deg,rgba(36,50,96,.95),rgba(8,11,24,.95));padding:22px;display:flex;flex-direction:column;justify-content:end}.streamsOpPreviewGlow{position:absolute;inset:40px;border-radius:999px;background:linear-gradient(135deg,#1ee7ff,#905cff,#ff62c7);filter:blur(44px);opacity:.34}.streamsOpPreviewHero span,.streamsOpPreviewHero h3,.streamsOpPreviewHero p{position:relative}.streamsOpPreviewHero span{color:#7df0ff;font-weight:900;font-size:12px;letter-spacing:.14em;text-transform:uppercase}.streamsOpPreviewHero h3{font-size:27px;margin:8px 0 6px}.streamsOpIncomeStrip{margin-top:12px;border:1px solid rgba(45,212,255,.18);background:rgba(255,255,255,.06);border-radius:18px;padding:12px;display:grid;grid-template-columns:1fr;gap:6px;font-size:13px}.streamsOpIncomeStrip b{color:#fff}.streamsOpIncomeStrip span{color:#aecaef}.streamsOpInlineActions{display:grid;gap:8px;margin-top:12px}.streamsOpInlineActions button{border:1px solid rgba(255,255,255,.13);border-radius:14px;min-height:40px;background:rgba(255,255,255,.07);color:#eff6ff;font-weight:800}.streamsOpModuleScreen{margin:16px;min-height:calc(100dvh - 108px)}.streamsOpModuleCards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:20px}.streamsOpModuleCards div{border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.05);border-radius:18px;padding:16px}.streamsOpModuleCards b,.streamsOpModuleCards span{display:block}.streamsOpModuleCards span{margin-top:8px;color:#a6b9dc}.streamsOpMobileNav{display:none}@media (max-width:899px){.streamsOpShell,.streamsOpShell.inlineOpen{display:flex;flex-direction:column;height:100dvh;min-height:100dvh;overflow:hidden}.streamsOpMain{height:auto;flex:1;min-height:0;padding-bottom:74px}.streamsOpTopbar{min-height:68px;padding:12px 14px}.streamsOpTopbar h1{font-size:20px}.streamsOpTopActions{gap:6px}.streamsOpProjectBadge{display:none}.streamsOpGhost{min-height:36px;font-size:12px;padding:0 10px}.streamsOpHomeStack{height:calc(100dvh - 142px);padding:10px;gap:10px}.streamsOpPicker{grid-template-columns:1fr;padding:14px;border-radius:20px}.streamsOpPicker h2{font-size:20px}.streamsOpPickerActions{flex-wrap:wrap}.streamsOpProjectGrid{display:flex;overflow-x:auto;padding-bottom:2px}.streamsOpProjectCard{min-width:170px}.streamsOpChatPanel{border-radius:20px}.streamsOpChatHeader{padding:12px 14px}.streamsOpChatHeader h2{font-size:17px}.streamsOpChatScroll{padding:14px}.streamsOpComposer{padding:10px 10px calc(10px + env(safe-area-inset-bottom,0px))}.streamsOpInlinePanel{position:fixed;left:0;right:0;top:0;bottom:74px;height:auto;z-index:80;border-left:0;border-bottom:1px solid rgba(148,163,184,.2);border-radius:0;}.streamsOpPreviewHero{min-height:210px}.streamsOpModuleScreen{margin:10px;min-height:calc(100dvh - 152px);overflow:auto}.streamsOpMobileNav{position:fixed;left:0;right:0;bottom:0;z-index:90;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:8px 8px calc(8px + env(safe-area-inset-bottom,0px));background:rgba(8,11,24,.96);border-top:1px solid rgba(148,163,184,.18);backdrop-filter:blur(18px)}.streamsOpMobileNav button{border:0;background:transparent;color:#91a4c5;border-radius:14px;min-height:44px;font-size:12px;font-weight:800}.streamsOpMobileNav button.active{background:rgba(45,212,255,.14);color:#fff}.streamsOpMsg{max-width:100%;grid-template-columns:32px minmax(0,1fr);gap:8px}.streamsOpMsg.user{grid-template-columns:minmax(0,1fr) 32px}.streamsOpMsgAvatar{width:32px;height:32px;border-radius:12px}.streamsOpMsgBody{padding:12px 13px}.streamsOpChatEmpty h3{font-size:22px}}
`;
