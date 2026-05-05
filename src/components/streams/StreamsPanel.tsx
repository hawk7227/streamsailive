"use client";

/**
 * src/components/streams/StreamsPanel.tsx
 *
 * Streams panel shell — 5 tabs, mobile-first.
 * Desktop: top nav + left sidebar visible
 * Mobile: top bar (brand only) + bottom nav (💬 🎬 ✦ ⬡ ◈)
 *
 * Fonts loaded here via <link> — IBM Plex Mono + DM Serif Display.
 * Cannot use next/font/google in client components.
 */

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateUserWorkspace } from "@/lib/streams/getOrCreateUserWorkspace";
import { ToastProvider } from "./Toast";
import { SearchPanel } from "./SearchPanel";
import { C, R, DUR, EASE } from "./tokens";
import ChatTab       from "./tabs/ChatTab";
import VideoEditorTab from "./tabs/VideoEditorTab";
import GenerateTab   from "./tabs/GenerateTab";
import ReferenceTab  from "./tabs/ReferenceTab";
import PersonTab     from "./tabs/PersonTab";
import SettingsTab   from "./tabs/SettingsTab";
import BuilderTab    from "./tabs/BuilderTab";

type Tab = "chat" | "editor" | "generate" | "reference" | "person" | "settings" | "builder";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "chat",      icon: "💬", label: "Chat"      },
  { id: "editor",    icon: "🎬", label: "Editor"    },
  { id: "generate",  icon: "✦",  label: "Generate"  },
  { id: "reference", icon: "⬡",  label: "Reference" },
  { id: "person",    icon: "◈",  label: "Person"    },
  { id: "builder",   icon: "⬢",  label: "Build"     },
  { id: "settings",  icon: "⚙",  label: "Settings"  },
];

export default function StreamsPanel() {
  const [active, setActive] = useState<Tab>("generate");
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [showSearch, setShowSearch] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Get current user from auth
  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUserId(session.user.id);
          // Get or create workspace for this user
          const workspaceId = await getOrCreateUserWorkspace(session.user.id);
          setWorkspaceId(workspaceId);
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  // V.3 — read ?tab= on mount so deep links and hard-reload restore tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as Tab | null;
    if (t && TABS.some(tab => tab.id === t)) setActive(t);
  }, []);

  // Cmd+K or Ctrl+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Write ?tab= on every switch — replaceState keeps history clean
  const switchTab = useCallback((tab: Tab) => {
    setActive(tab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, []);

  // ── Cross-tab shared state ──────────────────────────────────────────────
  const [sharedPrompt, setSharedPrompt] = useState<string|null>(null);

  // Called by ReferenceTab when user selects a variation prompt
  const onSelectPrompt = useCallback((prompt: string) => {
    setSharedPrompt(prompt);
    switchTab("generate");   // switch to Generate tab
  }, []);

  // Lifted here so PersonTab ingest flows into VideoEditorTab and GenerateTab.
  const [sharedAnalysisId, setSharedAnalysisId] = useState<string|null>(null);
  const [sharedGenLogId,   setSharedGenLogId]   = useState<string|null>(null);
  const [sharedVoiceId,    setSharedVoiceId]    = useState<string|null>(null);
  const [sharedVideoUrl,   setSharedVideoUrl]   = useState<string|null>(null);

  // Called by PersonTab when ingest completes
  const onIngestComplete = useCallback((data: {
    analysisId: string; genLogId: string; voiceId?: string|null;
  }) => {
    setSharedAnalysisId(data.analysisId);
    setSharedGenLogId(data.genLogId);
    if (data.voiceId) setSharedVoiceId(data.voiceId);
  }, []);

  // Called by GenerateTab/VideoEditorTab when a generation completes
  const onGenerationComplete = useCallback((url: string, generationId?: string) => {
    setSharedVideoUrl(url);
    if (generationId) setSharedGenLogId(generationId);
  }, []);

  return (
    <ToastProvider>
      {/* Google Fonts — scoped to this panel */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Mono:wght@400;500&display=swap"
      />

      {/* Scoped font reset — forces Inter on every element inside the panel
          regardless of global CSS or browser UA stylesheet overrides */}
      <style>{`
        .streams-root, .streams-root *,
        .streams-root input, .streams-root textarea,
        .streams-root button, .streams-root select {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .streams-root .streams-serif {
          font-family: 'DM Serif Display', serif;
        }
        .streams-root .streams-mono {
          font-family: 'IBM Plex Mono', monospace;
        }
        @media (prefers-reduced-motion: reduce) {
          .streams-root *, .streams-root *::before, .streams-root *::after {
            animation-duration: 0.01ms;
            transition-duration: 0.01ms;
          }
        }
      `}</style>

      <div className="streams-root streams-shell" data-testid="streams-shell" style={{
        display:       "flex",
        flexDirection: "column",
        height:        "100dvh",
        overflow:      "hidden",
        background:    C.bg,
        color:         C.t1,
      }}>

        {/* ── Top nav ─────────────────────────────────────────── */}
        <nav style={{
          display:        "flex",
          alignItems:     "center",
          height:         56,
          flexShrink:     0,
          borderBottom:   `1px solid ${C.bdr}`,
          background:     C.bg,
          padding:        "0 20px",
          gap:            8,
          minWidth:       0,
          overflowX:      "hidden",
        }}>
          {/* Brand */}
          <div className="streams-serif" style={{
            fontStyle:     "italic",
            fontSize: 20,
            color:         C.t1,
            flexShrink:    0,
            marginRight:   20,
          }}>
            Streams
          </div>

          {/* Desktop tabs */}
          <div style={{
            display:   "flex",
            gap:       2,
            flex:      1,
            minWidth:  0,
            overflowX: "hidden",
          }} className="streams-desktop-nav">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            6,
                  padding:        "8px 16px",
                  borderRadius:   0,
                  border:         "none",
                  borderBottom:   active === tab.id
                    ? `2px solid ${C.acc}`
                    : "2px solid transparent",
                  background:     active === tab.id ? C.surf2 : "transparent",
                  color:          active === tab.id ? C.t1 : C.t3,
                  fontSize: 15,
                  fontFamily:     "inherit",
                  fontWeight:     active === tab.id ? 500 : 400,
                  cursor:         "pointer",
                  transition:     `color ${DUR.fast} ${EASE}, background ${DUR.fast} ${EASE}`,
                }}
              >
                <span style={{ fontSize: 16 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search button - right aligned */}
          <button
            className="streams-desktop-nav"
            onClick={() => setShowSearch(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              marginLeft: 'auto',
              backgroundColor: C.bg3,
              border: `1px solid ${C.bdr}`,
              borderRadius: 8,
              color: C.t2,
              fontSize: 12,
              cursor: 'pointer',
              transition: `background ${DUR.fast} ${EASE}, color ${DUR.fast} ${EASE}`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.bg2;
              (e.currentTarget as HTMLButtonElement).style.color = C.t1;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.bg3;
              (e.currentTarget as HTMLButtonElement).style.color = C.t2;
            }}
            title="Search conversations (Cmd+K)"
          >
            🔍
            <span style={{ display: 'none' }} className="streams-desktop-nav">Search</span>
          </button>

          {/* Notification + Profile */}
          <div style={{ position: 'relative', marginLeft: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20, cursor: 'pointer' }}>🔔</span>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: '#9333ea',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
              title="Profile menu"
            >
              MH
            </button>

            {showUserMenu && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 220,
                backgroundColor: C.bg2,
                border: `1px solid ${C.bdr}`,
                borderRadius: 12,
                padding: 12,
                zIndex: 1000,
                boxShadow: '0 10px 32px rgba(0,0,0,0.15)',
              }}>
                <div style={{ paddingBottom: 12, borderBottom: `1px solid ${C.bdr}`, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>MARCUS HAWKINS</div>
                  <div style={{ fontSize: 12, color: C.t3 }}>Pro</div>
                </div>
                <button onClick={() => setShowUserMenu(false)} style={{ width: '100%', textAlign: 'left', padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', color: C.t2, fontSize: 13, marginBottom: 8 }}>⬆ Upgrade plan</button>
                <button onClick={() => setShowUserMenu(false)} style={{ width: '100%', textAlign: 'left', padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', color: C.t2, fontSize: 13, marginBottom: 8 }}>🎨 Personalization</button>
                <button onClick={() => setShowUserMenu(false)} style={{ width: '100%', textAlign: 'left', padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', color: C.t2, fontSize: 13, marginBottom: 8 }}>👤 Profile</button>
                <button onClick={() => setShowUserMenu(false)} style={{ width: '100%', textAlign: 'left', padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', color: C.t2, fontSize: 13, marginBottom: 8 }}>⚙ Settings</button>
                <button onClick={() => setShowUserMenu(false)} style={{ width: '100%', textAlign: 'left', padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', color: C.t2, fontSize: 13, marginBottom: 12 }}>❓ Help</button>
                <button onClick={() => setShowUserMenu(false)} style={{ width: '100%', textAlign: 'left', padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>🚪 Log out</button>
              </div>
            )}
          </div>
        </nav>

        {/* ── Content ─────────────────────────────────────────── */}
        <main className="streams-mobile-shell" data-testid="streams-mobile-shell" style={{ flex: 1, overflow: "hidden", position: "relative", display: 'flex', minWidth: 0, maxWidth: "100vw" }}>
          <aside
            style={{
              width: railCollapsed ? 72 : 278,
              borderRight: `1px solid ${C.bdr}`,
              background: C.bg,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: 8,
            }}
            className="streams-desktop-nav"
          >
            <button onClick={() => setRailCollapsed((v) => !v)} style={{ border: `1px solid ${C.bdr}`, background: C.bg2, borderRadius: 12, padding: '8px 10px', color: C.t2, cursor: 'pointer' }}>{railCollapsed ? '»' : '«'} {!railCollapsed ? 'Collapse' : ''}</button>
            <button onClick={() => switchTab('chat')} style={{ border: `1px solid ${C.bdr}`, background: active === 'chat' ? C.surf2 : C.bg, borderRadius: 12, padding: '8px 10px', color: C.t2, cursor: 'pointer', textAlign: 'left' }}>💬 {!railCollapsed && 'Chat'}</button>
            <button onClick={() => switchTab('generate')} style={{ border: `1px solid ${C.bdr}`, background: active === 'generate' ? C.surf2 : C.bg, borderRadius: 12, padding: '8px 10px', color: C.t2, cursor: 'pointer', textAlign: 'left' }}>✦ {!railCollapsed && 'Generate'}</button>
            <button onClick={() => switchTab('editor')} style={{ border: `1px solid ${C.bdr}`, background: active === 'editor' ? C.surf2 : C.bg, borderRadius: 12, padding: '8px 10px', color: C.t2, cursor: 'pointer', textAlign: 'left' }}>🎬 {!railCollapsed && 'Editor'}</button>
            <button onClick={() => switchTab('reference')} style={{ border: `1px solid ${C.bdr}`, background: active === 'reference' ? C.surf2 : C.bg, borderRadius: 12, padding: '8px 10px', color: C.t2, cursor: 'pointer', textAlign: 'left' }}>⬡ {!railCollapsed && 'Reference'}</button>
            <button onClick={() => switchTab('person')} style={{ border: `1px solid ${C.bdr}`, background: active === 'person' ? C.surf2 : C.bg, borderRadius: 12, padding: '8px 10px', color: C.t2, cursor: 'pointer', textAlign: 'left' }}>◈ {!railCollapsed && 'Person'}</button>
            <button onClick={() => switchTab('builder')} style={{ border: `1px solid ${C.bdr}`, background: active === 'builder' ? C.surf2 : C.bg, borderRadius: 12, padding: '8px 10px', color: C.t2, cursor: 'pointer', textAlign: 'left' }}>⬢ {!railCollapsed && 'Build'}</button>
            <button onClick={() => switchTab('settings')} style={{ border: `1px solid ${C.bdr}`, background: active === 'settings' ? C.surf2 : C.bg, borderRadius: 12, padding: '8px 10px', color: C.t2, cursor: 'pointer', textAlign: 'left' }}>⚙ {!railCollapsed && 'Settings'}</button>
            <button onClick={() => switchTab('chat')} style={{ border: `1px dashed ${C.bdr}`, background: C.bg, borderRadius: 12, padding: '8px 10px', color: C.t3, cursor: 'pointer', textAlign: 'left' }}>＋ {!railCollapsed && 'New Chat'}</button>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowMoreMenu((v) => !v)} style={{ border: `1px solid ${C.bdr}`, background: C.bg, borderRadius: 12, padding: '8px 10px', color: C.t2, cursor: 'pointer', textAlign: 'left', width: '100%' }}>⋯ {!railCollapsed && 'More'}</button>
              {showMoreMenu ? (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: railCollapsed ? 'auto' : 0, minWidth: 180, border: `1px solid ${C.bdr}`, borderRadius: 12, background: C.bg2, padding: 8, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => { switchTab('generate'); setShowMoreMenu(false); }} style={{ border: `1px solid ${C.bdr}`, background: C.bg, borderRadius: 12, padding: '8px 12px', color: C.t2, cursor: 'pointer', textAlign: 'left' }}>✦ Images</button>
                  <button onClick={() => { setShowSearch(true); setShowMoreMenu(false); }} style={{ border: `1px solid ${C.bdr}`, background: C.bg, borderRadius: 12, padding: '8px 12px', color: C.t2, cursor: 'pointer', textAlign: 'left' }}>🔍 Search</button>
                  <button onClick={() => { switchTab('reference'); setShowMoreMenu(false); }} style={{ border: `1px solid ${C.bdr}`, background: C.bg, borderRadius: 12, padding: '8px 12px', color: C.t2, cursor: 'pointer', textAlign: 'left' }}>⬡ Deep Research</button>
                </div>
              ) : null}
            </div>
          </aside>
          <div style={{ flex: 1, minWidth: 0, maxWidth: "100vw", overflowX: "hidden" }}>
          {active === "chat"      && <ChatTab />}
          {active === "editor"    && (
            <VideoEditorTab
              analysisId={sharedAnalysisId}
              genLogId={sharedGenLogId}
              videoUrl={sharedVideoUrl}
            />
          )}
          {active === "generate"  && (
            <GenerateTab
              userId={userId}
              workspaceId={workspaceId}
              voiceId={sharedVoiceId}
              initialPrompt={sharedPrompt}
              onGenerationComplete={onGenerationComplete}
              onPromptConsumed={() => setSharedPrompt(null)}
            />
          )}
          {active === "reference" && <ReferenceTab onSelectPrompt={onSelectPrompt} />}
          {active === "person"    && (
            <PersonTab
              onIngestComplete={onIngestComplete}
              videoUrl={sharedVideoUrl}
            />
          )}
          {active === "settings"  && <SettingsTab />}
          {active === "builder"   && <BuilderTab />}
          </div>
        </main>

        {/* ── Mobile bottom nav ───────────────────────────────── */}
        <nav
          className="streams-mobile-nav"
          style={{
            display:        "none",
            height:         72,
            flexShrink:     0,
            borderTop:      `1px solid ${C.bdr}`,
            background:     C.bg,
            alignItems:     "center",
            justifyContent: "space-around",
            paddingBottom:  "env(safe-area-inset-bottom)",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              style={{
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                gap:            3,
                padding:        "8px 12px",
                border:         "none",
                background:     "transparent",
                cursor:         "pointer",
                minWidth:       48,
                minHeight:      48,
              }}
            >
              <span style={{
                fontSize: 18,
                lineHeight: 1,
                color:      active === tab.id ? C.acc2 : C.t4,
                transition: `color ${DUR.fast} ${EASE}`,
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontSize: 13,
                color:      active === tab.id ? C.acc2 : C.t4,
                fontFamily: "inherit",
                transition: `color ${DUR.fast} ${EASE}`,
              }}>
                {tab.label}
              </span>
            </button>
          ))}
        </nav>

        {/* Responsive styles — scoped to streams panel */}
        <style>{`
          .streams-root .streams-mobile-nav { display: none; }
          .streams-root { overflow-x: hidden; }
          @media (max-width: 767px) {
            .streams-root .streams-desktop-nav { display: none; }
            .streams-root .streams-mobile-nav  { display: flex; }
            .streams-root .streams-mobile-shell {
              display: block;
              min-width: 0;
              width: 100%;
              max-width: 100vw;
              overflow-x: hidden;
            }
          }
        `}</style>

        {/* Search Panel Modal */}
        {showSearch && (
          <SearchPanel
            onSelectResult={(result) => {
              if (result.conversationId) {
                // In a real app, navigate to that conversation
                // For now, just close and switch to chat tab
                setShowSearch(false);
                switchTab('chat');
              }
            }}
            onClose={() => setShowSearch(false)}
          />
        )}
      </div>
    </ToastProvider>
  );
}
