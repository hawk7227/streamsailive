"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

function cleanTitle(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || "New chat";
}

function toTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function groupSessions(sessions = []) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const week = today - 6 * 24 * 60 * 60 * 1000;
  const groups = { Today: [], Yesterday: [], "Previous 7 Days": [], Older: [] };
  sessions.forEach((session) => {
    const time = toTime(session.updated_at || session.updatedAt || session.created_at || session.createdAt);
    if (time >= today) groups.Today.push(session);
    else if (time >= yesterday) groups.Yesterday.push(session);
    else if (time >= week) groups["Previous 7 Days"].push(session);
    else groups.Older.push(session);
  });
  return Object.entries(groups).filter(([, items]) => items.length);
}

function sessionHaystack(session) {
  return [session.title, session.session_summary, session.summary, session.id, JSON.stringify(session.metadata || {})].join(" ").toLowerCase();
}

export default function ActualRecentChatsOverlay({ chatRuntime }) {
  const [remoteSessions, setRemoteSessions] = useState([]);
  const [serverSearchResults, setServerSearchResults] = useState([]);
  const [menuTarget, setMenuTarget] = useState(null);
  const [query, setQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState("");
  const sessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q && serverSearchResults.length ? serverSearchResults : [...(Array.isArray(remoteSessions) ? remoteSessions : []), ...(Array.isArray(chatRuntime?.sessions) ? chatRuntime.sessions : [])];
    const seen = new Set();
    return base
      .filter((session) => session?.id && String(session.status || "active") !== "archived")
      .filter((session) => {
        if (seen.has(session.id)) return false;
        seen.add(session.id);
        return true;
      })
      .filter((session) => !q || serverSearchResults.length || sessionHaystack(session).includes(q))
      .sort((a, b) => toTime(b.updated_at || b.updatedAt || b.created_at || b.createdAt) - toTime(a.updated_at || a.updatedAt || a.created_at || a.createdAt))
      .slice(0, 24);
  }, [remoteSessions, serverSearchResults, chatRuntime?.sessions, query]);

  async function loadSessions({ silent = false } = {}) {
    try {
      const response = await fetch("/api/streams-ai/sessions?includeSummary=true", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      const rows = Array.isArray(data.sessions) ? data.sessions : Array.isArray(data.threads) ? data.threads : [];
      setRemoteSessions(rows);
      return rows;
    } catch {
      if (!silent) setRemoteSessions([]);
      return [];
    }
  }

  async function patchSession(sessionId, patch) {
    if (!sessionId) return;
    const response = await fetch("/api/streams-ai/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, ...patch }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw new Error(data?.error || "Session update failed");
    await loadSessions({ silent: true });
    window.dispatchEvent(new Event("streams:recent-chats-refresh"));
  }

  async function renameSession(session) {
    setOpenMenuId("");
    const next = window.prompt("Rename chat", cleanTitle(session.title));
    if (!next || !next.trim()) return;
    await patchSession(session.id, { title: next.trim() });
  }

  async function archiveSession(session) {
    setOpenMenuId("");
    if (!window.confirm(`Archive “${cleanTitle(session.title)}”?`)) return;
    await patchSession(session.id, { status: "archived" });
    if (session.id === chatRuntime?.sessionId) chatRuntime?.newChat?.();
  }

  async function deleteSession(session) {
    setOpenMenuId("");
    if (!window.confirm(`Delete “${cleanTitle(session.title)}” from Recents?`)) return;
    chatRuntime?.deleteSession?.(session.id);
    await patchSession(session.id, { status: "archived" });
  }

  useEffect(() => {
    let stopped = false;
    function locateSidebarMenu() {
      if (stopped) return;
      const target = document.querySelector(".desktopSide:not(.collapsed) .navScroll");
      setMenuTarget(target || null);
    }
    locateSidebarMenu();
    const timer = window.setInterval(locateSidebarMenu, 600);
    const observer = new MutationObserver(locateSidebarMenu);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", locateSidebarMenu);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      observer.disconnect();
      window.removeEventListener("resize", locateSidebarMenu);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    async function load() {
      if (cancelled) return;
      await loadSessions({ silent: true });
    }
    timer = window.setTimeout(load, 450);
    const interval = window.setInterval(load, 7000);
    window.addEventListener("popstate", load);
    window.addEventListener("streams:recent-chats-refresh", load);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("popstate", load);
      window.removeEventListener("streams:recent-chats-refresh", load);
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setServerSearchResults([]);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/streams-ai/search-chats?q=${encodeURIComponent(q)}&limit=30`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        const rows = Array.isArray(data.results) ? data.results : [];
        if (!cancelled) setServerSearchResults(rows);
      } catch {
        if (!cancelled) setServerSearchResults([]);
      }
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  if (!menuTarget) return null;

  const recentNode = (
    <section className="actualRecentChats" aria-label="Recent chats">
      <div className="actualRecentChatsHead">RECENTS</div>
      <input
        className="actualRecentSearch"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search chats"
        aria-label="Search chats"
      />
      <div className="actualRecentChatsList">
        {sessions.length ? groupSessions(sessions).map(([label, items]) => (
          <div key={label} className="actualRecentGroup">
            <h3>{query.trim() ? "Search results" : label}</h3>
            {items.map((session) => (
              <div key={session.id} className={session.id === chatRuntime?.sessionId ? "actualRecentRow active" : "actualRecentRow"}>
                <button
                  type="button"
                  className="actualRecentOpen"
                  onClick={() => chatRuntime?.selectSession?.(session.id)}
                  title={cleanTitle(session.title)}
                >
                  <span>{cleanTitle(session.title)}</span>
                </button>
                <button type="button" className="actualRecentMenuBtn" aria-label={`Actions for ${cleanTitle(session.title)}`} onClick={() => setOpenMenuId((value) => value === session.id ? "" : session.id)}>•••</button>
                {openMenuId === session.id ? (
                  <div className="actualRecentMenu" role="menu">
                    <button type="button" onClick={() => renameSession(session)}>Rename</button>
                    <button type="button" onClick={() => archiveSession(session)}>Archive</button>
                    <button type="button" className="danger" onClick={() => deleteSession(session)}>Delete</button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )) : <div className="actualRecentEmpty">{query.trim() ? "No matching chats found." : "No recent chats yet."}</div>}
      </div>
      <style jsx>{`
        .actualRecentChats{position:relative;width:100%;margin:8px 0 10px;padding:8px 4px 10px;color:#eaf3ff;pointer-events:auto;border-top:1px solid rgba(77,133,226,.22)}
        .actualRecentChatsHead{margin:0 0 6px 4px;color:#8dabdb;font-size:10px;letter-spacing:.18em;font-weight:900}
        .actualRecentSearch{width:calc(100% - 8px);height:32px;margin:0 4px 8px;border:1px solid rgba(77,133,226,.28);border-radius:10px;background:rgba(255,255,255,.06);color:#eef6ff;padding:0 10px;font-size:12px;outline:0}
        .actualRecentSearch::placeholder{color:#8dabdb}
        .actualRecentChatsList{display:flex;flex-direction:column;gap:2px}
        .actualRecentGroup h3{margin:8px 0 4px 4px;color:#8dabdb;font-size:10px;letter-spacing:.14em;font-weight:900}
        .actualRecentRow{position:relative;display:flex;align-items:center;border-radius:10px}
        .actualRecentRow:hover,.actualRecentRow.active{background:linear-gradient(90deg,rgba(119,70,255,.62),rgba(8,108,255,.62))}
        .actualRecentOpen{flex:1;min-width:0;min-height:34px;border:0;border-radius:10px;background:transparent;color:#eef6ff;display:flex;align-items:center;gap:9px;padding:0 6px 0 10px;text-align:left;font-size:13px;font-weight:760;cursor:pointer}
        .actualRecentOpen:before{content:"";width:8px;height:8px;border-radius:50%;background:#37e5ff;box-shadow:0 0 10px rgba(55,229,255,.75);flex:0 0 auto}
        .actualRecentOpen span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .actualRecentMenuBtn{width:34px;height:30px;border:0;background:transparent;color:#cfe3ff;border-radius:9px;font-size:11px;letter-spacing:-1px;cursor:pointer}
        .actualRecentMenuBtn:hover{background:rgba(255,255,255,.09)}
        .actualRecentMenu{position:absolute;right:4px;top:32px;z-index:200;width:132px;padding:6px;border:1px solid rgba(77,133,226,.28);border-radius:12px;background:#081126;box-shadow:0 18px 40px rgba(0,0,0,.38)}
        .actualRecentMenu button{width:100%;height:32px;border:0;border-radius:8px;background:transparent;color:#eef6ff;text-align:left;padding:0 9px;font-size:12px;font-weight:760;cursor:pointer}
        .actualRecentMenu button:hover{background:rgba(255,255,255,.08)}
        .actualRecentMenu .danger{color:#ffb4b4}
        .actualRecentEmpty{padding:8px 6px;color:#8dabdb;font-size:12px}
      `}</style>
    </section>
  );

  return createPortal(recentNode, menuTarget);
}
