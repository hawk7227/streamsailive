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

import { useState, useCallback } from "react";
import { C, R, DUR, EASE } from "./tokens";
import ChatTab       from "./tabs/ChatTab";
import VideoEditorTab from "./tabs/VideoEditorTab";
import GenerateTab   from "./tabs/GenerateTab";
import ReferenceTab  from "./tabs/ReferenceTab";
import PersonTab     from "./tabs/PersonTab";
import SettingsTab   from "./tabs/SettingsTab";

type Tab = "chat" | "editor" | "generate" | "reference" | "person" | "settings";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "chat",      icon: "💬", label: "Chat"      },
  { id: "editor",    icon: "🎬", label: "Editor"    },
  { id: "generate",  icon: "✦",  label: "Generate"  },
  { id: "reference", icon: "⬡",  label: "Reference" },
  { id: "person",    icon: "◈",  label: "Person"    },
  { id: "settings",  icon: "⚙",  label: "Settings"  },
];

export default function StreamsPanel() {
  const [active, setActive] = useState<Tab>("generate");

  // ── Cross-tab shared state ──────────────────────────────────────────────
  const [sharedPrompt, setSharedPrompt] = useState<string|null>(null);

  // Called by ReferenceTab when user selects a variation prompt
  const onSelectPrompt = useCallback((prompt: string) => {
    setSharedPrompt(prompt);
    setActive("generate");   // switch to Generate tab
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
  const onGenerationComplete = useCallback((url: string) => {
    setSharedVideoUrl(url);
  }, []);

  return (
    <>
      {/* Google Fonts — scoped to this panel */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
      />

      <div style={{
        display:       "flex",
        flexDirection: "column",
        height:        "100dvh",
        overflow:      "hidden",
        fontFamily:    "'IBM Plex Mono', monospace",
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
        }}>
          {/* Brand */}
          <div style={{
            fontFamily:    "'DM Serif Display', serif",
            fontStyle:     "italic",
            fontSize: 20,
            color:         C.t1,
            letterSpacing: "-.01em",
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
          }} className="streams-desktop-nav">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
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
                  letterSpacing:  ".02em",
                }}
              >
                <span style={{ fontSize: 16 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Content ─────────────────────────────────────────── */}
        <main style={{ flex: 1, overflow: "hidden", position: "relative" }}>
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
              onClick={() => setActive(tab.id)}
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
                fontSize: 12,
                color:      active === tab.id ? C.acc2 : C.t4,
                fontFamily: "inherit",
                transition: `color ${DUR.fast} ${EASE}`,
                letterSpacing: ".04em",
              }}>
                {tab.label}
              </span>
            </button>
          ))}
        </nav>

        {/* Responsive styles — scoped to streams panel */}
        <style>{`
          @media (max-width: 768px) {
            .streams-desktop-nav { display: none !important; }
            .streams-mobile-nav  { display: flex !important; }
          }
        `}</style>
      </div>
    </>
  );
}
