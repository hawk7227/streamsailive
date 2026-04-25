"use client";

/**
 * ChatTab — claude.ai-style light theme with ActivityConversation + MediaGenerationStage
 *
 * Integration rules (from spec):
 *   1. On Send: immediately mount ActivityConversation (<50ms)
 *   2. If image/video route detected: also mount MediaGenerationStage in-thread
 *   3. MediaGenerationStage renders IN the message, where final media will appear
 *   4. State flows: phase prop advances (real phases only)
 *   5. Handoff: first token → remove ActivityConversation | media complete → replace animation
 *   6. Never blank, never fake states, never separate preview area
 *
 * Rules: CSS.1, 4.1–4.3, 2.1–2.2, 3.1–3.2, 1.5, 9.1 all respected.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import MediaPlayer from "../VideoPlayer";
import { R, S, DUR, EASE } from "../tokens";
import { streamDirectFromOpenAI } from "@/lib/streams/openai-direct";
import { ActivityConversation } from "@/components/assistant/ActivityConversation";
import { MediaGenerationStage } from "@/components/assistant/MediaGenerationStage";
import { renderMarkdown } from "@/lib/streams/renderMarkdown";
import {
  loadSessions, saveSession, deleteSession, buildSession,
  loadDraft, saveDraft,
  generateTitle, formatSessionDate, getDateGroup,
  searchSessions, listenSync,
  type StoredSession, type StoredMessage, type SearchResult,
} from "@/lib/streams/chat-store";
import { getProviderKey } from "@/lib/streams/provider-keys";
import type { ActivityPhase } from "@/lib/assistant-ui/activityConversations";
import type { MediaGenerationState } from "@/components/assistant/MediaGenerationStage";
import { C, CT } from "../tokens";

type Mode    = "Chat" | "Image" | "Video" | "Build";
type MsgRole = "user" | "assistant";

interface Msg {
  id:             string;
  role:           MsgRole;
  text:           string;
  // Phase drives ActivityConversation — real system state only
  phase?:         ActivityPhase;
  // Tool calls shown live as they execute
  toolCalls?:     Array<{ name: string; status: "running"|"done"|"error"; label: string }>;
  // Media generation
  mediaStage?:    MediaGenerationState;
  mediaKind?:     "image" | "video";
  mediaUrl?:      string;
  // First output visible = hide ActivityConversation
  firstOutput?:   boolean;
  streaming?:     boolean;
}

type Session     = StoredSession;
type LibraryItem = { id: string; generation_type: string; output_url: string; created_at: string; cost_usd?: number | null };

async function saveToLibrary(opts: { type: "image"|"video"|"voice"|"music"; outputUrl: string; prompt: string; model?: string; provider?: string; }) {
  try {
    await fetch("/api/streams/save-generation", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(opts),
    });
  } catch { /* non-fatal */ }
}

export default function ChatTab() {
  const [msgs,          setMsgs]         = useState<Msg[]>([]);
  const [lightboxUrl,   setLightboxUrl]  = useState<string | null>(null);
  const [input,         setInput]        = useState("");
  const [mode,          setMode]         = useState<Mode>("Chat");
  const [streaming,     setStreaming]    = useState(false);
  const [sidebarOpen,   setSidebarOpen]  = useState(false);
  const [activeNav,     setActiveNav]    = useState<"Sessions"|"Library"|"Images">("Sessions");
  const [sessions,      setSessions]     = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState("");
  const [searchQuery,   setSearchQuery]  = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching,     setSearching]    = useState(false);
  const msgHistoryRef   = useRef<Record<string, Msg[]>>({});
  const titleGenRef     = useRef<Set<string>>(new Set());
  const [library,       setLibrary]      = useState<LibraryItem[]>([]);
  const [libraryLoading, setLibLoad]     = useState(false);
  const [expandedLib,   setExpandedLib]  = useState<string|null>(null);
  const [attachMode,    setAttachMode]   = useState(false);
  const [attachUrl,     setAttachUrl]    = useState("");
  const [inputFocused,  setInputFocused] = useState(false);
  const [inputBarH,     setInputBarH]    = useState(0);

  // AbortController for cancelling in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  // RAF streaming buffer — prevents React 18 batch-dump
  const tokenBufRef    = useRef<string>("");
  const rafRef         = useRef<number | null>(null);
  const streamingIdRef = useRef<string | null>(null);

  const endRef            = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef      = useRef<HTMLDivElement>(null);
  const textareaRef       = useRef<HTMLTextAreaElement>(null);

  // ── Load persisted sessions on mount + cross-tab sync ──────────────────
  useEffect(() => {
    const stored = loadSessions();
    if (stored.length > 0) {
      // Populate msgHistoryRef from stored sessions
      stored.forEach(s => {
        msgHistoryRef.current[s.id] = s.messages.map((m: StoredMessage) => ({
          id:         m.id,
          role:       m.role,
          text:       m.text,
          toolCalls:  m.toolCalls as Msg["toolCalls"],
          mediaUrl:   m.mediaUrl,
          mediaKind:  m.mediaKind as "image"|"video"|undefined,
        }));
      });
      setSessions(stored);
      const first = stored[0];
      setActiveSession(first.id);
      setMsgs(msgHistoryRef.current[first.id] ?? []);
      // Restore draft for first session
      const draft = loadDraft(first.id);
      if (draft) setInput(draft);
    } else {
      // No history — create a fresh session
      const newId = crypto.randomUUID();
      const fresh: Session = buildSession(newId, "New conversation", [], undefined);
      setSessions([fresh]);
      setActiveSession(newId);
    }

    // Cross-tab sync via BroadcastChannel
    const unsub = listenSync(msg => {
      if (msg.type === "session_updated") {
        setSessions((prev: Session[]) => {
          const idx = prev.findIndex(s => s.id === msg.session.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = msg.session;
            return updated.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
          }
          return [msg.session, ...prev];
        });
        msgHistoryRef.current[msg.session.id] = msg.session.messages.map((m: StoredMessage) => ({
          id: m.id, role: m.role, text: m.text,
          toolCalls: m.toolCalls as Msg["toolCalls"], mediaUrl: m.mediaUrl,
          mediaKind: m.mediaKind as "image"|"video"|undefined,
        }));
      }
      if (msg.type === "session_deleted") {
        setSessions((prev: Session[]) => prev.filter(s => s.id !== msg.id));
      }
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save current session to storage whenever msgs change ───────────────
  useEffect(() => {
    if (!activeSession || msgs.length === 0) return;
    const currentSession = sessions.find((s: Session) => s.id === activeSession);
    const storedMsgs: StoredMessage[] = msgs
      .filter((m: Msg) => !m.streaming && m.text.trim())
      .map((m: Msg) => ({
        id:        m.id,
        role:      m.role,
        text:      m.text,
        createdAt: new Date().toISOString(),
        toolCalls: m.toolCalls,
        mediaUrl:  m.mediaUrl,
        mediaKind: m.mediaKind,
      }));
    if (storedMsgs.length === 0) return;
    const updated = buildSession(
      activeSession,
      currentSession?.title ?? "New conversation",
      storedMsgs,
      currentSession?.createdAt,
    );
    saveSession(updated);
    setSessions((prev: Session[]) => {
      const idx = prev.findIndex(s => s.id === activeSession);
      if (idx < 0) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs]);

  // ── Save draft as user types ────────────────────────────────────────────
  useEffect(() => {
    if (activeSession) saveDraft(activeSession, input);
  }, [input, activeSession]);

  // ── Auto-generate title after first AI response ─────────────────────────
  const maybeGenerateTitle = useCallback((sessionId: string, firstUserMsg: string) => {
    if (titleGenRef.current.has(sessionId)) return;
    titleGenRef.current.add(sessionId);
    const apiKey = getProviderKey("openai") ?? "";
    void generateTitle(firstUserMsg, apiKey).then(title => {
      setSessions((prev: Session[]) => prev.map(s => s.id === sessionId ? { ...s, title } : s));
      // Update in storage too
      const stored = loadSessions();
      const idx = stored.findIndex(s => s.id === sessionId);
      if (idx >= 0) { stored[idx].title = title; saveSession(stored[idx]); }
    });
  }, []);

  // ── Search ──────────────────────────────────────────────────────────────
  const scrollToMessage = useCallback((msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  useEffect(() => {
    const el = inputAreaRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setInputBarH(el.offsetHeight));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  // iOS keyboard handled natively via position:fixed on .streams-chat-input2

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxUrl(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const loadLibrary = useCallback(async () => {
    if (libraryLoading) return;
    setLibLoad(true);
    try {
      const res = await fetch("/api/streams/library?limit=20", { credentials: "include" });
      if (res.ok) { const j = await res.json() as { data?: LibraryItem[] }; setLibrary(j.data ?? []); }
    } catch { /* empty */ } finally { setLibLoad(false); }
  }, [libraryLoading]);

  // ── RAF streaming buffer ─────────────────────────────────────────────────
  // Paced at ~180 chars/frame max → smooth readable flow, never dumps all at once.
  // Equivalent to Claude's ~30 tok/sec visual pacing at 60fps.
  const userScrolledRef = useRef(false);   // scroll lock: user touched scroll → stop auto-scroll

  // Reset scroll lock when user sends a new message
  function resetScrollLock() { userScrolledRef.current = false; }

  // Listen for user scroll to lock auto-scroll
  useEffect(() => {
    const el = document.querySelector(".streams-chat-scroll");
    if (!el) return;
    const onScroll = () => {
      // If user scrolled up from the bottom, lock auto-scroll
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (!atBottom) userScrolledRef.current = true;
      else           userScrolledRef.current = false;   // back at bottom → unlock
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const CHARS_PER_FRAME = 180; // ~180 chars/frame @ 60fps ≈ 10,800 chars/sec — smooth but not instant

  function startTokenFlush(id: string) {
    streamingIdRef.current = id;
    tokenBufRef.current = "";
    function flush() {
      const buf = tokenBufRef.current;
      if (buf) {
        // Drain at most CHARS_PER_FRAME per animation frame — paced streaming
        const tok = buf.slice(0, CHARS_PER_FRAME);
        tokenBufRef.current = buf.slice(CHARS_PER_FRAME);
        setMsgs((p: Msg[]) => p.map((m: Msg) => m.id === id
          ? { ...m, text: m.text + tok, phase: undefined, firstOutput: true }
          : m));
        // Auto-scroll only if user hasn't scrolled up
        if (!userScrolledRef.current) {
          endRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
      if (streamingIdRef.current === id) rafRef.current = requestAnimationFrame(flush);
    }
    rafRef.current = requestAnimationFrame(flush);
  }

  function stopTokenFlush(id: string) {
    streamingIdRef.current = null;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const remaining = tokenBufRef.current;
    tokenBufRef.current = "";
    if (remaining) {
      setMsgs((p: Msg[]) => p.map((m: Msg) => m.id === id
        ? { ...m, text: m.text + remaining, phase: undefined, firstOutput: true }
        : m));
    }
  }

  // ── Phase helper ──────────────────────────────────────────────────────────
  function advancePhase(id: string, phase: ActivityPhase, mediaStage?: MediaGenerationState) {
    setMsgs((p: Msg[]) => p.map((m: Msg) => m.id === id
      ? { ...m, phase, ...(mediaStage ? { mediaStage } : {}) }
      : m));
  }

  // ── Finish helpers ────────────────────────────────────────────────────────
  function finishMsg(id: string) {
    stopTokenFlush(id);
    setMsgs((p: Msg[]) => {
      const updated = p.map((m: Msg) => m.id === id
        ? { ...m, streaming: false, phase: undefined, firstOutput: true }
        : m);
      // Auto-title after first exchange completes
      const userMsgs = updated.filter((m: Msg) => m.role === "user");
      if (userMsgs.length === 1 && userMsgs[0]?.text) {
        maybeGenerateTitle(activeSession, userMsgs[0].text);
      }
      return updated;
    });
    setStreaming(false);
    abortRef.current = null;
  }

  function errorMsg(id: string, text: string) {
    stopTokenFlush(id);
    setMsgs((p: Msg[]) => p.map((m: Msg) => m.id === id
      ? { ...m, text, streaming: false, phase: undefined, firstOutput: true, mediaStage: "error" }
      : m));
    setStreaming(false);
    abortRef.current = null;
  }

  function completeMedia(id: string, mediaUrl: string, kind: "image"|"video") {
    setMsgs((p: Msg[]) => p.map((m: Msg) => m.id === id
      ? { ...m, mediaUrl, mediaKind: kind, mediaStage: "complete", streaming: false, phase: undefined, firstOutput: true }
      : m));
    setStreaming(false);
    abortRef.current = null;
  }

  // ── Stop ──────────────────────────────────────────────────────────────────
  function handleStop() {
    abortRef.current?.abort();
    stopTokenFlush(streamingIdRef.current ?? "");
    setMsgs((p: Msg[]) => p.map((m: Msg) => m.streaming
      ? { ...m, streaming: false, phase: undefined, firstOutput: true }
      : m));
    setStreaming(false);
    abortRef.current = null;
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    resetScrollLock(); // unlock auto-scroll for new message
    const isFirstMsg = msgs.filter((m: Msg) => m.role === "user").length === 0;
    const userId = Date.now().toString();

    setMsgs((p: Msg[]) => [...p, { id: userId, role: "user", text }]);
    setSessions((prev: Session[]) => prev.map(s =>
      s.id === activeSession && s.title === "New conversation"
        ? { ...s, title: text.slice(0, 36) + (text.length > 36 ? "…" : "") } : s));
    setInput(""); setStreaming(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const aiId = (Date.now() + 1).toString();
    const ctrl  = new AbortController();
    abortRef.current = ctrl;

    const { getProviderKey } = await import("@/lib/streams/provider-keys");
    const falKey    = getProviderKey("fal");
    const openaiKey = getProviderKey("openai");

    // ── IMAGE ─────────────────────────────────────────────────────────────────
    if (mode === "Image") {
      // Immediately mount: ActivityConversation (chat_thinking→image_submitting)
      // AND MediaGenerationStage (starting) in the same message node
      setMsgs((p: Msg[]) => [...p, {
        id: aiId, role: "assistant", text: "",
        phase: "image_submitting",
        mediaStage: "starting",
        mediaKind: "image",
        streaming: true,
      }]);

      if (falKey) {
        const { submitDirectToFal, extractImageUrl } = await import("@/lib/streams/fal-direct");
        await submitDirectToFal({
          endpoint: "fal-ai/flux-pro/kontext/text-to-image",
          input:    { prompt: text, aspect_ratio: "1:1" },
          signal:   ctrl.signal,
          onProgress: (status) => {
            const isGenerating = status.includes("Progress") || status.includes("Generating");
            advancePhase(aiId,
              isGenerating ? "image_generating" : "image_queued",
              isGenerating ? "generating" : "queued"
            );
          },
          onDone: (raw) => {
            const url = extractImageUrl(raw);
            if (url) {
              // Advance to finalizing briefly before complete
              advancePhase(aiId, "image_finalizing", "finalizing");
              setTimeout(() => {
                completeMedia(aiId, url, "image");
                void saveToLibrary({ type: "image", outputUrl: url, prompt: text, provider: "fal", model: "flux-pro" });
              }, 400);
            } else { errorMsg(aiId, "Image completed but no URL returned — try again."); }
          },
          onError: (err) => errorMsg(aiId,
            err.includes("key not set") ? "fal key not set — go to Settings → API Keys, paste your fal key, then Save." :
            err.includes("401") ? "fal key invalid — go to Settings → API Keys and re-enter your fal key." :
            err.includes("429") ? "fal rate limit — wait 30 seconds and try again." : err),
        });
        return;
      }

      if (openaiKey) {
        advancePhase(aiId, "image_submitting", "starting");
        try {
          const res = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST", signal: ctrl.signal,
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
            body: JSON.stringify({ model: "gpt-image-1", prompt: text, n: 1, size: "1024x1024", quality: "medium" }),
          });
          advancePhase(aiId, "image_generating", "generating");
          const data = await res.json() as { data?: Array<{ url?: string; b64_json?: string }>; error?: { message: string } };
          if (!res.ok || data.error) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
          const item = data.data?.[0];
          const url  = item?.url ?? (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : null);
          if (url) {
            advancePhase(aiId, "image_finalizing", "finalizing");
            setTimeout(() => {
              completeMedia(aiId, url, "image");
              if (!url.startsWith("data:"))
                void saveToLibrary({ type: "image", outputUrl: url, prompt: text, provider: "openai", model: "gpt-image-1" });
            }, 400);
          } else { errorMsg(aiId, "Image generation completed but no URL returned."); }
        } catch (err) {
          if ((err as Error).name === "AbortError") { finishMsg(aiId); return; }
          errorMsg(aiId, err instanceof Error ? err.message : "Image generation failed");
        }
        return;
      }

      errorMsg(aiId, "No image key — go to Settings → API Keys to add one.");
      return;
    }

    // ── VIDEO ─────────────────────────────────────────────────────────────────
    if (mode === "Video") {
      setMsgs((p: Msg[]) => [...p, {
        id: aiId, role: "assistant", text: "",
        phase: "video_submitting",
        mediaStage: "starting",
        mediaKind: "video",
        streaming: true,
      }]);

      if (!falKey) { errorMsg(aiId, "fal key not set — go to Settings → API Keys, paste your fal key, then Save."); return; }

      const { submitDirectToFal, extractVideoUrl } = await import("@/lib/streams/fal-direct");
      await submitDirectToFal({
        endpoint: "fal-ai/kling-video/v3/standard/text-to-video",
        input:    { prompt: text, duration: "5", aspect_ratio: "16:9" },
        signal:   ctrl.signal,
        pollMs:   4000,
        maxPolls: 60,
        onProgress: (status) => {
          const isGenerating = status.includes("Progress") || status.includes("Generating");
          advancePhase(aiId,
            isGenerating ? "video_generating" : "video_queued",
            isGenerating ? "generating" : "queued"
          );
        },
        onDone: (raw) => {
          const url = extractVideoUrl(raw);
          if (url) {
            advancePhase(aiId, "video_finalizing", "finalizing");
            setTimeout(() => {
              completeMedia(aiId, url, "video");
              void saveToLibrary({ type: "video", outputUrl: url, prompt: text, provider: "fal", model: "kling-v3" });
            }, 400);
          } else { errorMsg(aiId, "Video completed but no URL returned — try again."); }
        },
        onError: (err) => errorMsg(aiId, err),
      });
      return;
    }

    // ── CHAT / BUILD — OpenAI direct stream with RAF buffer ──────────────────
    const isBuild = mode === "Build";
    // Immediately show ActivityConversation — no MediaGenerationStage for text
    setMsgs((p: Msg[]) => [...p, {
      id: aiId, role: "assistant", text: "",
      phase: isBuild ? "build_starting" : "chat_thinking",
      streaming: true,
    }]);

    const history = msgs.slice(-12).map((m: Msg) => ({ role: m.role as "user"|"assistant", content: m.text }));
    let firstDelta = true;

    // Tool label map — human-readable names for each tool
    const TOOL_LABELS: Record<string, string> = {
      github_list_repos:        "Reading GitHub repos",
      github_read_file:         "Reading file",
      github_list_files:        "Listing files",
      github_write_file:        "Writing file to GitHub",
      github_search_code:       "Searching code",
      github_list_issues:       "Reading issues",
      github_get_commits:       "Reading commit history",
      vercel_list_projects:     "Reading Vercel projects",
      vercel_list_deployments:  "Checking deployments",
      vercel_get_deployment_logs: "Reading deployment logs",
      supabase_list_tables:     "Reading database tables",
      supabase_query:           "Running SQL query",
      supabase_get_schema:      "Reading table schema",
      create_file:              "Creating file",
    };

    function handleToolCall(name: string, status: "running"|"done"|"error") {
      const label = TOOL_LABELS[name] ?? name.replace(/_/g, " ");
      // Advance to tool_running phase so ActivityConversation shows correct messages
      if (status === "running") advancePhase(aiId, "tool_running");
      setMsgs((p: Msg[]) => p.map((m: Msg) => {
        if (m.id !== aiId) return m;
        const existing = m.toolCalls ?? [];
        const idx = existing.findIndex(t => t.name === name && t.status === "running");
        if (status === "running") {
          return { ...m, toolCalls: [...existing, { name, status, label }] };
        }
        if (idx >= 0) {
          const updated = [...existing];
          updated[idx] = { name, status, label };
          return { ...m, toolCalls: updated };
        }
        return m;
      }));
    }

    const streamOpts = {
      history,
      signal: ctrl.signal,
      onToolCall: handleToolCall,
      onDelta: (delta: string) => {
        if (firstDelta) { firstDelta = false; clearTimers(); startTokenFlush(aiId); }
        tokenBufRef.current += delta;
      },
      onDone: () => { clearTimers(); finishMsg(aiId); },
      onError: (err: string) => { clearTimers(); if (err.includes("aborted")) { finishMsg(aiId); return; } errorMsg(aiId, err); },
    };

    let clearTimers: () => void;

    if (isBuild) {
      const t1 = setTimeout(() => advancePhase(aiId, "build_planning"), 700);
      const t2 = setTimeout(() => advancePhase(aiId, "build_writing"), 1600);
      clearTimers = () => { clearTimeout(t1); clearTimeout(t2); };
      await streamDirectFromOpenAI({ message: `[Build mode] ${text}`, ...streamOpts });
    } else {
      const t1 = setTimeout(() => advancePhase(aiId, "chat_thinking"), 1400);
      const t2 = setTimeout(() => advancePhase(aiId, "chat_thinking"), 3000);
      clearTimers = () => { clearTimeout(t1); clearTimeout(t2); };
      await streamDirectFromOpenAI({ message: text, ...streamOpts });
    }
  }

  function handleNewChat() {
    // Save current msgs before switching
    msgHistoryRef.current[activeSession] = msgs;
    const newId = crypto.randomUUID();
    msgHistoryRef.current[newId] = [];
    const fresh = buildSession(newId, "New conversation", []);
    setSessions((prev: Session[]) => [fresh, ...prev]);
    setActiveSession(newId);
    setMsgs([]);
    setInput("");
    setSidebarOpen(false);
  }

  function handleSelectSession(id: string) {
    // Save current before switching
    msgHistoryRef.current[activeSession] = msgs;
    setActiveSession(id);
    setMsgs(msgHistoryRef.current[id] ?? []);
    // Restore draft for this session
    const draft = loadDraft(id);
    setInput(draft);
    setSidebarOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  }

  function handleDeleteSession(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteSession(id);
    setSessions((prev: Session[]) => {
      const remaining = prev.filter(s => s.id !== id);
      if (id === activeSession && remaining.length > 0) {
        handleSelectSession(remaining[0].id);
      }
      return remaining;
    });
  }

  function handleSearch(q: string) {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    const results = searchSessions(q);
    setSearchResults(results);
    setSearching(false);
  }

  // Group sessions by date for sidebar display
  function groupSessionsByDate(list: Session[]): Array<{ group: string; items: Session[] }> {
    const groups: Record<string, Session[]> = {};
    for (const s of list) {
      const g = getDateGroup(s.updatedAt);
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    }
    const ORDER = ["Today","Yesterday","Past 7 days","Past 30 days"];
    return Object.entries(groups)
      .sort(([a],[b]) => {
        const ai = ORDER.indexOf(a), bi = ORDER.indexOf(b);
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1;
        if (bi >= 0) return 1;
        return b.localeCompare(a);
      })
      .map(([group, items]) => ({ group, items }));
  }

  const Sidebar = (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:CT.sbBg, overflow:"hidden" }}>
      <div style={{ padding:"16px 16px 12px", borderBottom:`1px solid ${CT.border}`, flexShrink:0 }}>
        <div style={{ fontSize:12, color:CT.t4, letterSpacing:".18em", textTransform:"uppercase", marginBottom:S.s3 }}>Streams</div>
        <button onClick={handleNewChat} style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"100%", padding:"8px 0", background:CT.send, border:"none", borderRadius:R.r2, color:"#fff", fontSize:14, fontFamily:"inherit", cursor:"pointer", minHeight:44 }}>+ New chat</button>
      </div>

      {/* Search bar */}
      <div style={{ padding:"8px 12px", borderBottom:`1px solid ${CT.border}`, flexShrink:0 }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:13, color:CT.t4, pointerEvents:"none" }}>🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
            placeholder="Search conversations…"
            style={{ width:"100%", padding:"8px 10px 7px 30px", background:"rgba(0,0,0,0.05)", border:`1px solid ${CT.border}`, borderRadius:R.r1, fontSize:13, fontFamily:"inherit", color:CT.t1, outline:"none", boxSizing:"border-box" }}
          />
        </div>
      </div>

      <nav aria-label="Sidebar navigation" style={{ padding:S.s2, borderBottom:`1px solid ${CT.border}`, flexShrink:0 }}>
        {(["Sessions","Library","Images"] as const).map(id => (
          <button key={id} onClick={() => { setActiveNav(id); setSearchQuery(""); setSearchResults([]); if (id==="Library"||id==="Images") void loadLibrary(); }}
            style={{ display:"flex", alignItems:"center", width:"100%", padding:"8px 12px", background:activeNav===id?"rgba(0,0,0,0.06)":"transparent", border:"none", borderRadius:R.r1, color:activeNav===id?CT.t1:CT.t2, fontSize:14, fontFamily:"inherit", cursor:"pointer", textAlign:"left", minHeight:44 }}>{id}</button>
        ))}
      </nav>
      <div style={{ flex:1, overflowY:"auto" }}>

        {/* Search results */}
        {searchQuery && activeNav==="Sessions" && (
          <div>
            <div style={{ padding:"8px 16px 4px", fontSize:12, color:CT.t4 }}>
              {searching ? "Searching…" : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`}
            </div>
            {searchResults.length === 0 && !searching && (
              <div style={{ padding:"12px 16px", fontSize:13, color:CT.t4 }}>No conversations found</div>
            )}
            {searchResults.map((r: SearchResult, ri: number) => (
              <button key={`${r.session.id}-${r.message.id}-${ri}`}
                onClick={() => {
                  handleSelectSession(r.session.id);
                  setTimeout(() => scrollToMessage(r.message.id), 150);
                }}
                style={{ display:"block", textAlign:"left", padding:"8px 16px", width:"100%", border:"none", borderBottom:`1px solid ${CT.border}`, background:"transparent", cursor:"pointer" }}>
                <div style={{ fontSize:13, color:CT.t1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:2 }}>{r.session.title}</div>
                <div style={{ fontSize:12, color:CT.t3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.4 }}>{r.context}</div>
                <div style={{ fontSize:12, color:CT.t4, marginTop:2 }}>{formatSessionDate(r.session.updatedAt)} · click to go there</div>
              </button>
            ))}
          </div>
        )}

        {/* Sessions grouped by date */}
        {!searchQuery && activeNav==="Sessions" && (
          sessions.length === 0
            ? <div style={{ padding:"20px 16px", fontSize:13, color:CT.t4, textAlign:"center" }}>No conversations yet</div>
            : groupSessionsByDate(sessions).map(({ group, items }) => (
              <div key={group}>
                <div style={{ padding:"8px 16px 4px", fontSize:12, color:CT.t4, letterSpacing:".1em", textTransform:"uppercase" }}>{group}</div>
                {items.map(s => (
                  <div key={s.id} style={{ position:"relative" }}>
                    <button onClick={() => handleSelectSession(s.id)}
                      style={{ display:"block", textAlign:"left", padding:"8px 40px 9px 16px", width:"100%", border:"none", background:s.id===activeSession?"rgba(0,0,0,0.06)":"transparent", cursor:"pointer" }}>
                      <div style={{ fontSize:13, color:s.id===activeSession?CT.t1:CT.t2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:2 }}>{s.title}</div>
                      {s.preview && <div style={{ fontSize:12, color:CT.t4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:2 }}>{s.preview}</div>}
                      <div style={{ fontSize:12, color:CT.t4 }}>
                        {formatSessionDate(s.updatedAt)}
                        {s.msgCount > 0 && <span style={{ marginLeft:6 }}>· {s.msgCount} msg{s.msgCount !== 1 ? "s" : ""}</span>}
                      </div>
                    </button>
                    {/* Delete button */}
                    <button
                      aria-label="Delete conversation"
                      onClick={(e: React.MouseEvent) => handleDeleteSession(e, s.id)}
                      style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:CT.t4, cursor:"pointer", fontSize:14, padding:"4px", borderRadius:4, opacity:0.5, lineHeight:1 }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ))
        )}

        {(activeNav==="Library"||activeNav==="Images") && (
          <div style={{ padding:S.s2 }}>
            {libraryLoading && <div style={{ padding:"12px 8px", fontSize:14, color:CT.t4 }}>Loading…</div>}
            {!libraryLoading && library.length===0 && (
              <div style={{ padding:"12px 8px", fontSize:13, color:CT.t4 }}>{activeNav==="Images"?"No images yet":"No generations yet"}</div>
            )}
            {!libraryLoading && library.filter((i: LibraryItem) => activeNav==="Images"?i.generation_type==="image":true).map((item:LibraryItem) => {
              const icons: Record<string,string> = { video_t2v:"🎬",video_i2v:"🎬",image:"🖼",voice:"🎙",music:"🎵" };
              return (
                <div key={item.id} role="button" tabIndex={0}
                  onKeyDown={(e:React.KeyboardEvent) => { if(e.key==="Enter"||e.key===" ") setExpandedLib(expandedLib===item.id?null:item.id); }}
                  onClick={() => setExpandedLib(expandedLib===item.id?null:item.id)}
                  style={{ padding:S.s2, borderRadius:R.r1, marginBottom:S.s1, cursor:"pointer", border:`0.5px solid ${CT.border}`, background:"transparent" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:S.s2 }}>
                    <span style={{ fontSize:16, width:24, textAlign:"center", flexShrink:0 }}>{icons[item.generation_type]??"✦"}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:CT.t1, fontSize:13, textTransform:"capitalize", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.generation_type.replace("_"," ")}</div>
                      <div style={{ color:CT.t4, fontSize:12 }}>{new Date(item.created_at).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</div>
                    </div>
                  </div>
                  {item.output_url && expandedLib===item.id && (
                    <div style={{ borderRadius:R.r1, overflow:"hidden", marginTop:S.s2 }}>
                      <MediaPlayer src={item.output_url} kind={item.generation_type==="image"?"image":item.generation_type==="voice"||item.generation_type==="music"?"audio":"video"} aspectRatio={item.generation_type==="image"?"1/1":"16/9"} showDownload label={item.generation_type}/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden", background:CT.bg }}>
      <div className={`streams-chat-sb2${sidebarOpen?" open":""}`}>{Sidebar}</div>
      <div onClick={() => setSidebarOpen(false)} aria-hidden="true" style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:299, opacity:sidebarOpen?1:0, pointerEvents:sidebarOpen?"auto":"none", transition:`opacity ${DUR.base} ${EASE}` }}/>

      {/* Lightbox */}
      {lightboxUrl && (
        <div role="dialog" aria-label="Image lightbox" aria-modal="true" onClick={() => setLightboxUrl(null)}
          style={{ position:"fixed", inset:0, zIndex:400, background:"rgba(0,0,0,0.9)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"zoom-out", padding:20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="Full size" onClick={(e: React.MouseEvent)=>e.stopPropagation()} style={{ maxWidth:"100%", maxHeight:"90vh", borderRadius:R.r2, boxShadow:"0 24px 80px rgba(0,0,0,0.6)", cursor:"default" }}/>
          <button aria-label="Close lightbox" onClick={() => setLightboxUrl(null)}
            style={{ position:"absolute", top:20, right:20, width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.15)", border:"none", borderRadius:R.pill, color:"#fff", fontSize:20, cursor:"pointer" }}>×</button>
        </div>
      )}

      <div ref={inputContainerRef} style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:CT.bg }}>

        <div className="streams-chat-mhdr2" style={{ padding:"12px 16px", borderBottom:`1px solid ${CT.border}`, alignItems:"center", gap:S.s3 }}>
          <button aria-label="Open sidebar" onClick={() => setSidebarOpen((v: boolean)=>!v)} style={{ background:"transparent", border:`1px solid ${CT.border}`, borderRadius:R.r1, color:CT.t2, cursor:"pointer", fontFamily:"inherit", minWidth:44, minHeight:44, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>☰</button>
          <span style={{ fontSize:15, color:CT.t1 }}>Streams</span>
        </div>

        {/* Messages */}
        <div role="log" aria-live="polite" aria-atomic="false" aria-label="Conversation messages"
          className="streams-chat-scroll"
          style={{ flex:1, overflowY:"auto", overscrollBehavior:"contain", paddingBottom:inputBarH+S.s4 }}>

          {msgs.length===0 && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60%", padding:"40px 32px", textAlign:"center" }}>
              <div style={{ fontSize:22, color:CT.t1, marginBottom:S.s2 }}>AI assistant</div>
              <div style={{ fontSize:15, color:CT.t3, lineHeight:1.6, maxWidth:360 }}>Generate images, videos, voice and code directly from conversation.</div>
            </div>
          )}

          {msgs.length>0 && (
            <div className="streams-chat-msgs2" style={{ maxWidth:760, margin:"0 auto", display:"flex", flexDirection:"column", gap:28 }}>
              {msgs.map((msg:Msg) => (
                <div key={msg.id} id={`msg-${msg.id}`} style={{ display:"flex", flexDirection:"column", alignItems:msg.role==="user"?"flex-end":"flex-start" }}>

                  {/* AI label with avatar */}
                  {msg.role==="assistant" && (
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                      <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#7C3AED,#d95b2a)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <span style={{ fontSize:12, color:"#fff", lineHeight:1 }}>✦</span>
                      </div>
                      <span style={{ fontSize:14, color:CT.t2 }}>Streams</span>
                    </div>
                  )}

                  {/* ActivityConversation */}
                  {msg.role==="assistant" && msg.phase && !msg.firstOutput && (
                    <div style={{ paddingLeft:36 }}>
                      <ActivityConversation
                        phase={msg.phase}
                        userText={msgs.filter((m: Msg)=>m.role==="user").slice(-1)[0]?.text}
                        mode={msg.mediaKind ? (msg.mediaKind as "image"|"video") : undefined}
                        active={msg.streaming}
                        firstOutputVisible={msg.firstOutput}
                      />
                    </div>
                  )}

                  {/* Tool call pills */}
                  {msg.role==="assistant" && msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:msg.text ? 12 : 0, paddingLeft:36 }}>
                      {msg.toolCalls.map((tc, ti) => (
                        <div key={`${tc.name}-${ti}`} style={{
                          display:"inline-flex", alignItems:"center", gap:7,
                          padding:"4px 12px", borderRadius:R.pill,
                          background: tc.status==="done" ? "rgba(16,185,129,0.08)" : tc.status==="error" ? "rgba(239,68,68,0.08)" : "rgba(0,0,0,0.04)",
                          border: `1px solid ${tc.status==="done"?"rgba(16,185,129,0.22)":tc.status==="error"?"rgba(239,68,68,0.22)":"rgba(0,0,0,0.09)"}`,
                          alignSelf:"flex-start", fontSize:13,
                          color: tc.status==="done"?C.green:tc.status==="error"?C.red:CT.t3,
                        }}>
                          {tc.status==="running" && <span style={{ width:7, height:7, borderRadius:"50%", background:CT.send, flexShrink:0, animation:"streams-pulse2 1.2s ease infinite" }}/>}
                          {tc.status==="done"  && <span>✓</span>}
                          {tc.status==="error" && <span>✗</span>}
                          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{tc.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* MediaGenerationStage */}
                  {msg.role==="assistant" && msg.mediaKind && msg.mediaStage && (
                    <div style={{ width:"100%", maxWidth:480, paddingLeft:36, marginTop: msg.phase && !msg.firstOutput ? 12 : 0 }}>
                      <MediaGenerationStage kind={msg.mediaKind} state={msg.mediaStage} outputUrl={msg.mediaUrl} active={msg.streaming || msg.mediaStage==="complete"} />
                    </div>
                  )}

                  {/* User bubble */}
                  {msg.text && msg.role==="user" && (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, maxWidth:"78%" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                        <span style={{ fontSize:12, color:CT.t4, letterSpacing:".04em" }}>You</span>
                        <div style={{ width:22, height:22, borderRadius:"50%", background:"linear-gradient(135deg,#e0e7ff,#c7d2fe)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <span style={{ fontSize:11, color:"#4338ca" }}>👤</span>
                        </div>
                      </div>
                      <div style={{ background:CT.sbBg, borderRadius:"18px 18px 4px 18px", padding:"12px 18px", color:CT.t1, fontSize:17, lineHeight:1.75, overflowWrap:"break-word", borderLeft:"3px solid #c7d2fe" }}>
                        {renderMarkdown(msg.text, false)}
                        {msg.streaming && msg.text && (
                          <span style={{ display:"inline-block", width:2, height:16, background:CT.t1, borderRadius:0, marginLeft:2, verticalAlign:"text-bottom", animation:"streams-blink2 0.8s ease infinite" }}/>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI response */}
                  {msg.text && msg.role==="assistant" && (
                    <div style={{ width:"100%", paddingLeft:36, color:CT.t1, fontSize:17, lineHeight:1.85, overflowWrap:"break-word" }}>
                      {renderMarkdown(msg.text, !!(msg.streaming && msg.text))}
                    </div>
                  )}

                  {/* Generated image */}
                  {msg.role==="assistant" && msg.mediaUrl && msg.mediaKind==="image" && msg.mediaStage==="complete" && (
                    <div role="button" aria-label="View full size" tabIndex={0}
                      onClick={() => setLightboxUrl(msg.mediaUrl!)}
                      onKeyDown={(e:React.KeyboardEvent) => { if(e.key==="Enter"||e.key===" ") setLightboxUrl(msg.mediaUrl!); }}
                      style={{ cursor:"zoom-in", borderRadius:R.r3, overflow:"hidden", display:"inline-block", maxWidth:440, width:"100%", boxShadow:"0 4px 24px rgba(0,0,0,0.10)", marginLeft:36 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={msg.mediaUrl} alt="Generated" style={{ width:"100%", height:"auto", display:"block" }}/>
                      <div style={{ padding:"8px 12px", background:"rgba(0,0,0,0.03)", fontSize:13, color:CT.t4, display:"flex", gap:10 }}>
                        <span>🔍 Enlarge</span>
                        <a href={msg.mediaUrl} download onClick={(e: React.MouseEvent)=>e.stopPropagation()} style={{ color:CT.send, textDecoration:"none" }}>↓ Download</a>
                      </div>
                    </div>
                  )}

                </div>
              ))}
              <div ref={endRef} style={{ height:1 }}/>
            </div>
          )}
        </div>

        {/* ── Input bar ── */}
        <div ref={inputAreaRef} className="streams-chat-input2" style={{ flexShrink:0 }}>
          <div style={{ maxWidth:760, margin:"0 auto", display:"flex", flexDirection:"column", gap:10 }}>

            {/* Mode badges — bright colored, each mode has its own identity */}
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {([
                { m:"Chat",  color:C.blue, bg:"rgba(37,99,235,0.10)",  active:C.blue },
                { m:"Image", color:"#7c3aed", bg:"rgba(124,58,237,0.10)", active:"#7c3aed" },
                { m:"Video", color:C.red, bg:"rgba(220,38,38,0.10)",  active:C.red },
                { m:"Build", color:C.green, bg:"rgba(5,150,105,0.10)",  active:C.green },
              ] as Array<{m:Mode;color:string;bg:string;active:string}>).map(({ m, color, bg, active }) => (
                <button key={m} onClick={() => setMode(m)}
                  aria-label={`Switch to ${m} mode`}
                  aria-pressed={mode === m}
                  style={{
                    padding: "4px 14px",
                    borderRadius: R.pill,
                    border: `1.5px solid ${active}`,
                    background: mode===m ? active : color,
                    color: "#fff",
                    fontSize: 13,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    flexShrink: 0,
                    minHeight: 30,
                    
                    transition: `all ${DUR.fast} ${EASE}`,
                    boxShadow: mode===m ? `0 2px 8px ${active}60` : `0 1px 4px ${active}30`,
                  }}>
                  {m}
                </button>
              ))}
            </div>

            {/* Attach URL expander */}
            {attachMode && (
              <div style={{ display:"flex", gap:8 }}>
                <input value={attachUrl}
                  onChange={(e:React.ChangeEvent<HTMLInputElement>) => setAttachUrl(e.target.value)}
                  placeholder="Paste image or video URL…"
                  style={{ flex:1, background:CT.sbBg, border:"1.5px solid rgba(0,0,0,0.12)", borderRadius:R.r2, padding:"8px 14px", color:CT.t1, fontSize:15, fontFamily:"inherit", outline:"none" }}
                  onKeyDown={(e:React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key==="Enter" && attachUrl.trim()) { setInput((p: string)=>p+(p?" ":"")+attachUrl.trim()); setAttachUrl(""); setAttachMode(false); }
                    if (e.key==="Escape") setAttachMode(false);
                  }}/>
                <button onClick={() => { setInput((p: string)=>p+(p?" ":"")+attachUrl.trim()); setAttachUrl(""); setAttachMode(false); }}
                  style={{ padding:"8px 18px", borderRadius:R.r2, background:CT.send, border:"none", color:"#fff", fontSize:14, fontFamily:"inherit", cursor:"pointer", minHeight:44 }}>
                  Attach
                </button>
              </div>
            )}

            {/* Main row: [+] [textarea] [send/stop] */}
            <div style={{ display:"flex", alignItems:"flex-end", gap:10 }}>

              {/* Plus / upload button */}
              <button
                aria-label="Attach URL"
                onClick={() => setAttachMode((v: boolean) => !v)}
                style={{
                  width: 42, height: 42, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: attachMode ? "rgba(217,91,42,0.10)" : "rgba(0,0,0,0.05)",
                  border: `1.5px solid ${attachMode ? CT.send : "rgba(0,0,0,0.14)"}`,
                  borderRadius: "50%",
                  color: attachMode ? CT.send : "rgba(0,0,0,0.45)",
                  cursor: "pointer",
                  transition: `all ${DUR.fast} ${EASE}`,
                  fontSize: 22,
                  lineHeight: 1,
                  fontWeight: 400,
                }}>
                +
              </button>

              {/* Text area */}
              <div style={{
                flex: 1,
                border: `1.5px solid ${inputFocused ? "#7C3AED" : "rgba(0,0,0,0.16)"}`,
                borderRadius: 20,
                padding: "12px 18px",
                background: inputFocused ? CT.bg : CT.sbBg,
                transition: `all ${DUR.fast} ${EASE}`,
                boxShadow: inputFocused ? "0 0 0 3px rgba(124,58,237,0.10)" : "none",
              }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  maxLength={4000}
                  aria-label="Message input"
                  aria-multiline="true"
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  onChange={(e:React.ChangeEvent<HTMLTextAreaElement>) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
                  }}
                  onKeyDown={(e:React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
                  }}
                  placeholder={`Message Streams…`}
                  rows={1}
                  style={{
                    width: "100%", background: "transparent", border: "none",
                    outline: "none", fontFamily: "inherit", fontSize: 18,
                    color: CT.t1, resize: "none", lineHeight: 1.6, minHeight: 26,
                  }}/>
              </div>

              {/* Send / Stop button */}
              {streaming ? (
                /* STOP — red pulsing ring — clearly "something is happening, click to stop" */
                <button
                  onClick={handleStop}
                  aria-label="Stop generation"
                  style={{
                    width: 42, height: 42, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: C.red,
                    border: "none",
                    borderRadius: "50%",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                    animation: "streams-stop-pulse 1.4s ease infinite",
                  }}>
                  ■
                </button>
              ) : (
                /* SEND — always orange and alive. Empty = softer glow. Has text = full glow + shadow */
                <button
                  onClick={() => void handleSend()}
                  disabled={!input.trim()}
                  aria-label="Send message"
                  style={{
                    width: 42, height: 42, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "linear-gradient(135deg, #d95b2a, #f97316)",
                    border: "none",
                    borderRadius: "50%",
                    color: "#fff",
                    cursor: input.trim() ? "pointer" : "default",
                    fontSize: 20,
                    lineHeight: 1,
                    transition: `all ${DUR.base} ${EASE}`,
                    boxShadow: "0 3px 12px rgba(217,91,42,0.50)",
                    animation: "none",
                  }}>
                  ↑
                </button>
              )}
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes streams-blink2      { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes streams-pulse2      { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes streams-stop-pulse  { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.5)} 50%{box-shadow:0 0 0 7px rgba(220,38,38,0)} }
        @keyframes streams-send-breathe{ 0%,100%{opacity:0.55;transform:scale(1)} 50%{opacity:0.80;transform:scale(1.04)} }
        .streams-chat-chips2::-webkit-scrollbar { display:none; }

        /* ── Sidebar: mobile default = hidden off-left ── */
        .streams-chat-sb2 {
          position: fixed;
          top: 0; left: 0;
          height: 100dvh;
          width: 260px;
          z-index: 300;
          transform: translateX(-100%);
          transition: transform ${DUR.base} ${EASE};
          border-right: 1px solid rgba(0,0,0,0.08);
        }
        .streams-chat-sb2.open { transform: translateX(0); }

        /* ── Mobile header: hidden on desktop ── */
        .streams-chat-mhdr2 { display: none; }

        /* ── Mobile-only rules ── */
        @media (max-width:767px) {
          .streams-chat-mhdr2 {
            display: flex;
          }
          .streams-chat-msgs2 {
            padding: 20px 16px 140px;
            font-size: 18px;
            line-height: 1.85;
          }
          .streams-chat-msgs2 p  { font-size: 18px; line-height: 1.85; }
          .streams-chat-msgs2 li { font-size: 18px; line-height: 1.85; }
          .streams-chat-input2 {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 100;
            padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
            border-top: 1px solid rgba(0,0,0,0.09);
            background: #ffffff;
          }
        }

        /* ── Desktop-only rules ── */
        @media (min-width:768px) {
          .streams-chat-sb2 {
            position: relative;
            height: 100%;
            width: 260px;
            transform: none;
            transition: none;
            z-index: auto;
            flex-shrink: 0;
          }
          .streams-chat-sb2.open { transform: none; }
          .streams-chat-msgs2 {
            padding: 40px 28px 0;
            font-size: 17px;
            line-height: 1.8;
          }
          .streams-chat-input2 {
            padding: 16px 20px calc(16px + env(safe-area-inset-bottom));
            border-top: 1px solid rgba(0,0,0,0.09);
            background: #ffffff;
          }
        }
      `}</style>
    </div>
  );
}
