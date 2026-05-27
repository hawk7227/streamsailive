"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import "./streams-clean-sidebar.css";
import StreamsMediaLibraryModal from "../media/StreamsMediaLibraryModal";

const PRIMARY_ITEMS = [
  { id: "search-chats", label: "Search chats", icon: "search", action: "search" },
  { id: "projects", label: "Projects", icon: "file", href: "/dashboard/library" },
  { id: "chat", label: "Chat", icon: "chat", href: "/streams-ai", active: true },
];

const TOOL_ITEMS = [
  { id: "images", label: "Images", icon: "sparkle" },
  { id: "videos", label: "Videos", icon: "play" },
  { id: "search", label: "Search", icon: "search" },
  { id: "deep-research", label: "Deep Research", icon: "cube", href: "/streams?tab=reference" },
  { id: "editor", label: "Editor", icon: "edit", href: "/editor" },
  { id: "generate", label: "Generate", icon: "bolt", href: "/streams" },
  { id: "reference", label: "Reference", icon: "book", href: "/streams?tab=reference" },
  { id: "settings", label: "Settings", icon: "settings", href: "/dashboard/settings" },
];

function groupSessionsByDate(sessions = []) {
  const groups = {
    Today: [],
    Yesterday: [],
    "Previous 7 Days": [],
    "Previous 30 Days": [],
    Older: [],
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const sevenDaysAgoStart = todayStart - 6 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgoStart = todayStart - 29 * 24 * 60 * 60 * 1000;

  sessions.forEach((session) => {
    const time = new Date(session.created_at || session.createdAt || session.updated_at || session.updatedAt || 0).getTime();
    if (time >= todayStart) {
      groups.Today.push(session);
    } else if (time >= yesterdayStart) {
      groups.Yesterday.push(session);
    } else if (time >= sevenDaysAgoStart) {
      groups["Previous 7 Days"].push(session);
    } else if (time >= thirtyDaysAgoStart) {
      groups["Previous 30 Days"].push(session);
    } else {
      groups.Older.push(session);
    }
  });

  return Object.fromEntries(
    Object.entries(groups).filter(([_, items]) => items.length > 0)
  );
}

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

function getInitials(value) {
  const text = String(value || "Streams User").trim();
  if (text.includes("@")) return text.slice(0, 2).toUpperCase();
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "SU";
}

function Avatar({ label }) {
  return <div className="cleanSidebarAvatar">{getInitials(label)}</div>;
}

export default function StreamsCleanSidebar({ chatRuntime, open, setOpen }) {
  const router = useRouter();
  const { user, profile, plan, workspace, signOut } = useAuth();
  const [toolsOpen, setToolsOpen] = useState(true);
  const [activeModal, setActiveModal] = useState(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const toolItems = useMemo(() => TOOL_ITEMS.filter((item) => item?.id && item?.label), []);
  const grouped = useMemo(() => {
    return groupSessionsByDate(chatRuntime?.sessions || []);
  }, [chatRuntime?.sessions]);

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "Streams user";

  const planLabel = plan?.name || profile?.plan_id || "Free";
  const workspaceLabel = workspace?.name || "Workspace";


  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        setActiveModal(null);
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;

    const closeAccountMenu = (event) => {
      if (!accountMenuRef.current) return;
      if (!accountMenuRef.current.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", closeAccountMenu);
    return () => window.removeEventListener("pointerdown", closeAccountMenu);
  }, [accountMenuOpen]); // streams-clean-sidebar-account-close

  function openPrimary(item) {
    if (item.action === "search") {
      setActiveModal("search");
      return;
    }

    if (item.href) {
      router.push(item.href);
    }
  }

  function openTool(item) {
    if (item.disabled) return;
    if (item.id === "videos") {
      setActiveModal(null);
      window.dispatchEvent(new Event("streams:open-generated-videos"));
      return;
    }
    if (["images", "search"].includes(item.id)) {
      setActiveModal(item.id);
      return;
    }
    if (item.href) {
      router.push(item.href);
    }
  }

  function navigateAccountMenu(href) {
    setAccountMenuOpen(false);
    router.push(href);
  }

  async function closeAndSignOut() {
    setAccountMenuOpen(false);
    await signOut?.();
    router.push("/login");
  }

  if (!open) {
    return null;
  }

  return (
    <>
      {/* Backdrop: tap to close on mobile */}
      <div
        className="cleanSidebarBackdrop isOpen"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      <aside className="cleanSidebar" aria-label="Workspace sidebar">
      <div className="cleanSidebarTop"><button type="button" className="cleanSidebarNewChat" onClick={() => chatRuntime?.newChat?.()}><Icon name="plus"/><span>New chat</span><Icon name="down" size={14}/></button><button type="button" className="cleanSidebarIconButton" aria-label="Collapse sidebar" onClick={() => setOpen(false)}><Icon name="panel"/></button></div>
      <nav className="cleanSidebarPrimary" aria-label="Primary navigation">
        {PRIMARY_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.active ? "isActive" : ""}
            onClick={() => openPrimary(item)}
          >
            <Icon name={item.icon}/>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <section className="cleanSidebarTools"><button type="button" className="cleanSidebarToolsToggle" onClick={() => setToolsOpen((value) => !value)}><span><Icon name="dots"/> More</span><Icon name="down" size={14}/></button>{toolsOpen ? <nav aria-label="Tools">{toolItems.map((item) => <button key={item.id} type="button" disabled={item.disabled} onClick={() => openTool(item)}><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav> : null}</section>
      {Object.entries(grouped).map(([title, items]) => (
        <section className="cleanSidebarHistory" key={title} aria-label={title}>
          <h3>{title}</h3>
          {items.map((session) => (
            <button 
              key={session.id} 
              type="button"
              className={session.id === chatRuntime?.sessionId ? "isActive" : ""}
              onClick={() => chatRuntime?.selectSession?.(session.id)}
            >
              <Icon name="chat" size={17}/>
              <span>{session.title || "New Chat"}</span>
            </button>
          ))}
        </section>
      ))}
      <div className="cleanSidebarAccountWrap" ref={accountMenuRef}>
        <button
          type="button"
          className="cleanSidebarAccount cleanSidebarAccountButton"
          onClick={() => setAccountMenuOpen((value) => !value)}
          aria-label="Open account menu"
          aria-expanded={accountMenuOpen}
        >
          <Avatar label={displayName}/>
          <span>
            <strong>{displayName}</strong>
            <em>{planLabel} · {workspaceLabel}</em>
          </span>
        </button>

        {accountMenuOpen ? (
          <div className="cleanAccountMenu" role="dialog" aria-label="Account menu">
            <div className="cleanAccountMenuHeader">
              <Avatar label={displayName}/>
              <div>
                <strong>{displayName}</strong>
                <span>{user?.email || profile?.email || "Email unavailable"}</span>
                <em>{planLabel} · {workspaceLabel}</em>
              </div>
              <button type="button" aria-label="Close account menu" onClick={() => setAccountMenuOpen(false)}>×</button>
            </div>

            <button type="button" onClick={() => navigateAccountMenu("/account/modules")}>My Plan & Modules</button>
            <button type="button" onClick={() => navigateAccountMenu("/pricing")}>Upgrade / Add Modules</button>
            <button type="button" onClick={() => navigateAccountMenu("/account/credits")}>Credits / Usage</button>
            <button type="button" onClick={() => navigateAccountMenu("/account/personalization")}>Personalization</button>
            <button type="button" onClick={() => navigateAccountMenu("/account/profile")}>Profile</button>
            <button type="button" onClick={() => navigateAccountMenu("/account/settings")}>Settings</button>
            <button type="button" onClick={() => navigateAccountMenu("/account/language")}>Language</button>
            <button type="button" onClick={() => navigateAccountMenu("/account/apps")}>Apps & Extensions</button>
            <button type="button" onClick={() => navigateAccountMenu("/account/gift")}>Gift / Invite / Credits</button>
            <button type="button" onClick={() => navigateAccountMenu("/account/help")}>Help & Status</button>
            <button type="button" onClick={() => navigateAccountMenu("/account/learn-more")}>Learn more</button>

            <hr />

            <button type="button" className="danger" onClick={closeAndSignOut}>Log out</button>
          </div>
        ) : null}
      </div>
      {activeModal ? (
        <StreamsMediaLibraryModal
          mode={activeModal}
          chatRuntime={chatRuntime}
          onClose={() => setActiveModal(null)}
        />
      ) : null}
    </aside>
    </>
  );
}
