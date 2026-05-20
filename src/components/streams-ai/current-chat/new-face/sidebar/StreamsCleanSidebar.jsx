"use client";

import React, { useEffect, useMemo, useState } from "react";
import "./streams-clean-sidebar.css";

const PRIMARY_ITEMS = [
  { id: "search-chats", label: "Search chats", icon: "search" },
  { id: "projects", label: "Projects", icon: "file" },
  { id: "chat", label: "Chat", icon: "chat", active: true },
];

const TOOL_ITEMS = [
  { id: "images", label: "Images", icon: "sparkle" },
  { id: "videos", label: "Videos", icon: "play" },
  { id: "search", label: "Search", icon: "search" },
  { id: "deep-research", label: "Deep Research", icon: "cube", disabled: true },
  { id: "editor", label: "Editor", icon: "edit", disabled: true },
  { id: "generate", label: "Generate", icon: "bolt", disabled: true },
  { id: "reference", label: "Reference", icon: "book", disabled: true },
  { id: "settings", label: "Settings", icon: "settings", disabled: true },
];

const HISTORY = {
  Today: ["Urban morning vibe", "Brand campaign ideas", "Recipe suggestions"],
  Yesterday: ["Quarterly report summary", "Website hero concepts"],
};

function Icon({ name, size = 20 }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const icons = {
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    down: <path d="M6 9l6 6 6-6"/>,
    panel: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.2-4.2"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>,
    chat: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>,
    dots: <><circle cx="5" cy="12" r="1.25"/><circle cx="12" cy="12" r="1.25"/><circle cx="19" cy="12" r="1.25"/></>,
    sparkle: <><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></>,
    play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>,
    cube: <><path d="M21 16V8l-9-5-9 5v8l9 5z"/><path d="M3.5 8.5L12 13l8.5-4.5"/><path d="M12 22v-9"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></>,
    bolt: <path d="M13 2L4 14h7l-1 8 10-13h-7z"/>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H21"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H21v20H6.5A2.5 2.5 0 0 1 4 19.5z"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M4.9 4.9L7 7"/><path d="M17 17l2.1 2.1"/><path d="M2 12h3"/><path d="M19 12h3"/></>,
    x: <><path d="M18 6L6 18"/><path d="M6 6l12 12"/></>,
  };
  return <svg {...props}>{icons[name] || icons.sparkle}</svg>;
}

function Avatar() {
  return <div className="cleanSidebarAvatar">MH</div>;
}

function MediaModal({ type, onClose }) {
  const config = {
    images: {
      title: "Images",
      subtitle: "Generated images and image workflows.",
      body: "This is the clean image library shell. The next slice connects the real generated-image grid without changing provider routes.",
    },
    search: {
      title: "Search",
      subtitle: "Search chats, projects, media, and workspace files.",
      body: "This is the clean search modal shell. Real search results will be wired as a separate slice, not faked here.",
    },
  }[type];

  if (!config) return null;

  return (
    <div className="cleanSidebarModalBackdrop" onClick={onClose} role="presentation">
      <section className="cleanSidebarModal" role="dialog" aria-modal="true" aria-label={config.title} onClick={(event) => event.stopPropagation()}>
        <header>
          <div><strong>{config.title}</strong><span>{config.subtitle}</span></div>
          <button type="button" aria-label="Close" onClick={onClose}><Icon name="x" size={18}/></button>
        </header>
        <div className="cleanSidebarModalBody"><p>{config.body}</p></div>
      </section>
    </div>
  );
}

function HistorySection({ title, items }) {
  return <section className="cleanSidebarHistory" aria-label={title}><h3>{title}</h3>{items.map((item) => <button key={`${title}-${item}`} type="button"><Icon name="chat" size={17}/><span>{item}</span></button>)}</section>;
}

export default function StreamsCleanSidebar({ open, setOpen }) {
  const [toolsOpen, setToolsOpen] = useState(true);
  const [activeModal, setActiveModal] = useState(null);
  const toolItems = useMemo(() => TOOL_ITEMS.filter((item) => item?.id && item?.label), []);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") setActiveModal(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function openTool(item) {
    if (item.disabled) return;
    if (item.id === "videos") {
      setActiveModal(null);
      window.dispatchEvent(new Event("streams:open-generated-videos"));
      return;
    }
    if (["images", "search"].includes(item.id)) setActiveModal(item.id);
  }

  if (!open) {
    return (
      <aside className="cleanSidebar cleanSidebarCollapsed" aria-label="Collapsed sidebar">
        <button type="button" className="cleanSidebarIconButton" aria-label="Open sidebar" onClick={() => setOpen(true)}><Icon name="panel"/></button>
        <nav aria-label="Quick tools">
          <button type="button" aria-label="Chat" onClick={() => setOpen(true)}><Icon name="chat"/></button>
          <button type="button" aria-label="Images" onClick={() => { setOpen(true); setActiveModal("images"); }}><Icon name="sparkle"/></button>
          <button type="button" aria-label="Videos" onClick={() => { setActiveModal(null); window.dispatchEvent(new Event("streams:open-generated-videos")); }}><Icon name="play"/></button>
          <button type="button" aria-label="Search" onClick={() => { setOpen(true); setActiveModal("search"); }}><Icon name="search"/></button>
        </nav>
        <button type="button" className="cleanSidebarAvatarButton" aria-label="Account"><Avatar/></button>
        <MediaModal type={activeModal} onClose={() => setActiveModal(null)} />
      </aside>
    );
  }

  return (
    <aside className="cleanSidebar" aria-label="Workspace sidebar">
      <div className="cleanSidebarTop"><button type="button" className="cleanSidebarNewChat"><Icon name="plus"/><span>New chat</span><Icon name="down" size={14}/></button><button type="button" className="cleanSidebarIconButton" aria-label="Collapse sidebar" onClick={() => setOpen(false)}><Icon name="panel"/></button></div>
      <nav className="cleanSidebarPrimary" aria-label="Primary navigation">{PRIMARY_ITEMS.map((item) => <button key={item.id} type="button" className={item.active ? "isActive" : ""}><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav>
      <section className="cleanSidebarTools"><button type="button" className="cleanSidebarToolsToggle" onClick={() => setToolsOpen((value) => !value)}><span><Icon name="dots"/> More</span><Icon name="down" size={14}/></button>{toolsOpen ? <nav aria-label="Tools">{toolItems.map((item) => <button key={item.id} type="button" disabled={item.disabled} onClick={() => openTool(item)}><Icon name={item.icon}/><span>{item.label}</span>{item.disabled ? <em>Next</em> : null}</button>)}</nav> : null}</section>
      {Object.entries(HISTORY).map(([title, items]) => <HistorySection key={title} title={title} items={items}/>) }
      <div className="cleanSidebarAccount"><Avatar/><span><strong>MARCUS HAWKINS</strong><em>Pro</em></span></div>
      <MediaModal type={activeModal} onClose={() => setActiveModal(null)} />
    </aside>
  );
}
