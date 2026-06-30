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

export default function ActualRecentChatsOverlay({ chatRuntime }) {
  const [remoteSessions, setRemoteSessions] = useState([]);
  const [menuTarget, setMenuTarget] = useState(null);
  const sessions = useMemo(() => {
    const combined = [...(Array.isArray(remoteSessions) ? remoteSessions : []), ...(Array.isArray(chatRuntime?.sessions) ? chatRuntime.sessions : [])];
    const seen = new Set();
    return combined
      .filter((session) => session?.id && String(session.status || "active") !== "archived")
      .filter((session) => {
        if (seen.has(session.id)) return false;
        seen.add(session.id);
        return true;
      })
      .sort((a, b) => toTime(b.updated_at || b.updatedAt || b.created_at || b.createdAt) - toTime(a.updated_at || a.updatedAt || a.created_at || a.createdAt))
      .slice(0, 18);
  }, [remoteSessions, chatRuntime?.sessions]);

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
      try {
        const response = await fetch("/api/streams-ai/sessions?includeSummary=true", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        const rows = Array.isArray(data.sessions) ? data.sessions : Array.isArray(data.threads) ? data.threads : [];
        if (!cancelled) setRemoteSessions(rows);
      } catch {
        if (!cancelled) setRemoteSessions([]);
      }
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

  if (!sessions.length || !menuTarget) return null;

  const recentNode = (
    <section className="actualRecentChats" aria-label="Recent chats">
      <div className="actualRecentChatsHead">RECENT</div>
      <div className="actualRecentChatsList">
        {groupSessions(sessions).map(([label, items]) => (
          <div key={label} className="actualRecentGroup">
            <h3>{label}</h3>
            {items.map((session) => (
              <button
                key={session.id}
                type="button"
                className={session.id === chatRuntime?.sessionId ? "active" : ""}
                onClick={() => chatRuntime?.selectSession?.(session.id)}
                title={cleanTitle(session.title)}
              >
                <span>{cleanTitle(session.title)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <style jsx>{`
        .actualRecentChats{
          position:relative;
          width:100%;
          margin:8px 0 10px;
          padding:8px 4px 10px;
          color:#eaf3ff;
          pointer-events:auto;
          border-top:1px solid rgba(77,133,226,.22);
        }
        .actualRecentChatsHead{
          margin:0 0 6px 4px;
          color:#8dabdb;
          font-size:10px;
          letter-spacing:.18em;
          font-weight:900;
        }
        .actualRecentChatsList{
          display:flex;
          flex-direction:column;
          gap:2px;
        }
        .actualRecentGroup h3{
          margin:8px 0 4px 4px;
          color:#8dabdb;
          font-size:10px;
          letter-spacing:.14em;
          font-weight:900;
        }
        .actualRecentGroup button{
          width:100%;
          min-height:34px;
          border:0;
          border-radius:10px;
          background:transparent;
          color:#eef6ff;
          display:flex;
          align-items:center;
          gap:9px;
          padding:0 10px;
          text-align:left;
          font-size:13px;
          font-weight:760;
          cursor:pointer;
        }
        .actualRecentGroup button:before{
          content:"";
          width:8px;
          height:8px;
          border-radius:50%;
          background:#37e5ff;
          box-shadow:0 0 10px rgba(55,229,255,.75);
          flex:0 0 auto;
        }
        .actualRecentGroup button span{
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .actualRecentGroup button:hover,
        .actualRecentGroup button.active{
          background:linear-gradient(90deg,rgba(119,70,255,.62),rgba(8,108,255,.62));
        }
      `}</style>
    </section>
  );

  return createPortal(recentNode, menuTarget);
}
