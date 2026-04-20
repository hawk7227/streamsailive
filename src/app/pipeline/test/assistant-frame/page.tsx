"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Search,
  Folder,
  Image as ImageIcon,
  Boxes,
  AppWindow,
  Settings,
  Send,
  Square,
  Wifi,
  WifiOff,
} from "lucide-react";

import { useAssistantSession } from "./useAssistantSession";
import type { AssistantPreviewDescriptor, AssistantPreviewType, AssistantPreviewStatus } from "@/lib/assistant-core/assistant-protocol";

// ── WebSocket URL resolution ───────────────────────────────────────────────
// Priority:
//   1. NEXT_PUBLIC_ASSISTANT_REALTIME_URL env var (set in DO App Platform)
//   2. Hard fallback to the live realtime service
const REALTIME_WS_URL =
  process.env.NEXT_PUBLIC_ASSISTANT_REALTIME_URL ??
  "wss://octopus-app-4szwt.ondigitalocean.app/api/assistant/realtime";

type ToolbarItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const toolbarItems: ToolbarItem[] = [
  { id: "new_chat", label: "New chat", icon: Plus },
  { id: "search", label: "Search chats", icon: Search },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "library", label: "Library", icon: Folder },
  { id: "apps", label: "Apps", icon: AppWindow },
  { id: "projects", label: "Projects", icon: Boxes },
  { id: "settings", label: "Settings", icon: Settings },
];

function formatConnectionLabel(state: ReturnType<typeof useAssistantSession>["connectionState"]) {
  switch (state) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "closing":
      return "Closing";
    case "closed":
      return "Closed";
    case "error":
      return "Connection error";
    default:
      return "Disconnected";
  }
}

// ── Preview card ──────────────────────────────────────────────────────────
// Renders a typed preview descriptor from the assistant protocol.
// The descriptor is metadata only — actual artifact content arrives via
// text.delta in the message body and is rendered by renderContent().
// This card shows type, status lifecycle, and route — no fake placeholders.

type PreviewTypeConfig = {
  icon: string;
  label: string;
  bg: string;
  border: string;
  iconBg: string;
};

const PREVIEW_TYPE_CONFIG: Record<AssistantPreviewType, PreviewTypeConfig> = {
  image:               { icon: "🖼", label: "Image",          bg: "bg-violet-50",  border: "border-violet-200", iconBg: "bg-violet-100" },
  video:               { icon: "🎬", label: "Video",          bg: "bg-rose-50",    border: "border-rose-200",   iconBg: "bg-rose-100"   },
  app_runtime:         { icon: "⚡", label: "App",            bg: "bg-blue-50",    border: "border-blue-200",   iconBg: "bg-blue-100"   },
  page_editor:         { icon: "📄", label: "Page",           bg: "bg-sky-50",     border: "border-sky-200",    iconBg: "bg-sky-100"    },
  document:            { icon: "📝", label: "Document",       bg: "bg-amber-50",   border: "border-amber-200",  iconBg: "bg-amber-100"  },
  code_output:         { icon: "💻", label: "Code",           bg: "bg-zinc-100",   border: "border-zinc-300",   iconBg: "bg-zinc-200"   },
  diff:                { icon: "🔀", label: "Diff",           bg: "bg-green-50",   border: "border-green-200",  iconBg: "bg-green-100"  },
  build_result:        { icon: "🏗", label: "Build",          bg: "bg-orange-50",  border: "border-orange-200", iconBg: "bg-orange-100" },
  artifact_collection: { icon: "📦", label: "Collection",     bg: "bg-purple-50",  border: "border-purple-200", iconBg: "bg-purple-100" },
};

const FALLBACK_CONFIG: PreviewTypeConfig = {
  icon: "🔮", label: "Preview", bg: "bg-zinc-50", border: "border-zinc-200", iconBg: "bg-zinc-100",
};

// PreviewStatus is the protocol's AssistantPreviewStatus — imported above.

function PreviewStatusBadge({ status }: { status: AssistantPreviewStatus }) {
  const map: Record<string, { label: string; className: string }> = {
    created:    { label: "Queued",      className: "bg-zinc-100 text-zinc-500" },
    partial:    { label: "Generating…", className: "bg-amber-100 text-amber-600" },
    ready:      { label: "Ready",       className: "bg-emerald-100 text-emerald-700" },
    stale:      { label: "Stale",       className: "bg-zinc-100 text-zinc-400" },
    superseded: { label: "Superseded",  className: "bg-zinc-100 text-zinc-400" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-zinc-100 text-zinc-500" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${cfg.className}`}>
      {status === "partial" && (
        <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
      )}
      {cfg.label}
    </span>
  );
}

function PreviewCard({ preview }: { preview: AssistantPreviewDescriptor }) {
  const cfg = PREVIEW_TYPE_CONFIG[preview.previewType] ?? FALLBACK_CONFIG;
  const isSuperseded = preview.status === "superseded" || preview.status === "stale";

  return (
    <div
      className={`mt-3 rounded-2xl border p-4 transition-opacity ${cfg.bg} ${cfg.border} ${
        isSuperseded ? "opacity-40" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-base ${cfg.iconBg}`}>
            {cfg.icon}
          </span>
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              {preview.title || cfg.label}
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-zinc-400">
              {preview.route}
            </div>
          </div>
        </div>
        <PreviewStatusBadge status={preview.status} />
      </div>

      {/* Indeterminate shimmer — transform-only animation, motion compliant */}
      {preview.status === "partial" && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-black/5">
          <div className="h-full w-full origin-left animate-[shimmer_1.6s_ease-in-out_infinite] rounded-full bg-amber-400" />
        </div>
      )}

      {/* Ready state — artifact is in message content above this card */}
      {preview.status === "ready" && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-600">
          <span>✓</span>
          <span>Artifact delivered in message above</span>
        </div>
      )}

      {/* Type label */}
      <div className="mt-3 flex items-center gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400">
          {cfg.label}
        </span>
        <span className="text-[10px] text-zinc-300">·</span>
        <span className="font-mono text-[10px] text-zinc-400">
          {preview.previewId.slice(0, 8)}
        </span>
      </div>
    </div>
  );
}

// ── Inline markdown renderer ──────────────────────────────────────────────
// Handles: images ![alt](url), bold **text**, and plain text.
// No external dependency — only renders patterns the assistant actually emits.
function renderContent(text: string): React.ReactNode[] {
  if (!text) return [];

  const nodes: React.ReactNode[] = [];
  // Split on markdown images first
  const imgPattern = /!\[([^\]]*)\][\s\S]*?\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = imgPattern.exec(text)) !== null) {
    // Text before image
    if (match.index > lastIndex) {
      nodes.push(...renderInlineText(text.slice(lastIndex, match.index)));
    }
    // The image itself
    nodes.push(
      <div key={match.index} className="mt-3">
        <img
          src={match[2]}
          alt={match[1]}
          className="max-w-full rounded-2xl border border-zinc-200 shadow-sm"
          style={{ maxHeight: 480 }}
        />
      </div>
    );
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last image
  if (lastIndex < text.length) {
    nodes.push(...renderInlineText(text.slice(lastIndex)));
  }

  return nodes;
}

function renderInlineText(text: string): React.ReactNode[] {
  if (!text) return [];
  const nodes: React.ReactNode[] = [];
  // Split on bold **text**
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <span key={keyIdx++}>{text.slice(lastIndex, match.index)}</span>
      );
    }
    nodes.push(<strong key={keyIdx++}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(<span key={keyIdx++}>{text.slice(lastIndex)}</span>);
  }

  return nodes;
}



// ── Neon skeleton loader ───────────────────────────────────────────────────
// Shown in the assistant message bubble while image generation is in progress.
// Animated CSS — no JS timers, no layout shift.
function NeonSkeleton() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{ width: "100%", aspectRatio: "16/9", background: "#0a0a0a" }}
    >
      <style>{`
        @keyframes neon-drift {
          0%   { transform: translate(0px, 0px) rotate(0deg); opacity: 0.9; }
          25%  { transform: translate(18px, -12px) rotate(8deg); opacity: 0.6; }
          50%  { transform: translate(-10px, 16px) rotate(-6deg); opacity: 1; }
          75%  { transform: translate(14px, 8px) rotate(4deg); opacity: 0.7; }
          100% { transform: translate(0px, 0px) rotate(0deg); opacity: 0.9; }
        }
        @keyframes neon-pulse {
          0%, 100% { filter: brightness(1) blur(0px); }
          50%       { filter: brightness(1.6) blur(1px); }
        }
        .neon-stick {
          position: absolute;
          border-radius: 3px;
          animation: neon-drift var(--dur, 2.4s) ease-in-out infinite,
                     neon-pulse var(--pulse, 1.8s) ease-in-out infinite;
          animation-delay: var(--delay, 0s);
        }
      `}</style>

      {/* Neon sticks — varied colors, sizes, positions, durations */}
      {[
        { left:"8%",  top:"12%", w:48, h:6,  color:"#ff0080", rot:"-20deg", dur:"2.2s", pulse:"1.6s", delay:"0s"    },
        { left:"22%", top:"8%",  w:36, h:5,  color:"#ffee00", rot:"35deg",  dur:"2.8s", pulse:"2.0s", delay:"0.3s"  },
        { left:"55%", top:"6%",  w:52, h:7,  color:"#ff6600", rot:"-12deg", dur:"2.4s", pulse:"1.9s", delay:"0.6s"  },
        { left:"75%", top:"14%", w:40, h:5,  color:"#ff0080", rot:"28deg",  dur:"3.0s", pulse:"2.2s", delay:"0.1s"  },
        { left:"5%",  top:"40%", w:44, h:6,  color:"#00ff88", rot:"15deg",  dur:"2.6s", pulse:"1.7s", delay:"0.9s"  },
        { left:"30%", top:"35%", w:38, h:5,  color:"#0080ff", rot:"-30deg", dur:"2.3s", pulse:"2.1s", delay:"0.4s"  },
        { left:"62%", top:"32%", w:56, h:7,  color:"#aa00ff", rot:"10deg",  dur:"2.9s", pulse:"1.8s", delay:"0.7s"  },
        { left:"82%", top:"38%", w:34, h:5,  color:"#ff0040", rot:"-22deg", dur:"2.5s", pulse:"2.0s", delay:"0.2s"  },
        { left:"12%", top:"65%", w:50, h:6,  color:"#ffee00", rot:"38deg",  dur:"2.7s", pulse:"1.6s", delay:"1.1s"  },
        { left:"40%", top:"60%", w:42, h:6,  color:"#ff6600", rot:"-8deg",  dur:"2.1s", pulse:"2.3s", delay:"0.5s"  },
        { left:"68%", top:"58%", w:46, h:7,  color:"#00ff88", rot:"25deg",  dur:"3.1s", pulse:"1.9s", delay:"0.8s"  },
        { left:"88%", top:"62%", w:36, h:5,  color:"#0080ff", rot:"-40deg", dur:"2.4s", pulse:"2.1s", delay:"0.3s"  },
        { left:"18%", top:"82%", w:54, h:6,  color:"#aa00ff", rot:"18deg",  dur:"2.6s", pulse:"1.7s", delay:"1.3s"  },
        { left:"50%", top:"78%", w:40, h:5,  color:"#ff0080", rot:"-15deg", dur:"2.2s", pulse:"2.0s", delay:"0.6s"  },
        { left:"72%", top:"84%", w:48, h:7,  color:"#ffee00", rot:"42deg",  dur:"2.8s", pulse:"1.8s", delay:"0.9s"  },
        // Cross-sticks (perpendicular pairs)
        { left:"35%", top:"22%", w:8,  h:32, color:"#ff6600", rot:"0deg",   dur:"2.5s", pulse:"2.2s", delay:"0.4s"  },
        { left:"33%", top:"24%", w:32, h:8,  color:"#ff6600", rot:"0deg",   dur:"2.5s", pulse:"2.2s", delay:"0.4s"  },
        { left:"60%", top:"70%", w:8,  h:28, color:"#00ff88", rot:"0deg",   dur:"2.3s", pulse:"1.9s", delay:"1.0s"  },
        { left:"58%", top:"72%", w:28, h:8,  color:"#00ff88", rot:"0deg",   dur:"2.3s", pulse:"1.9s", delay:"1.0s"  },
      ].map((stick, i) => (
        <div
          key={i}
          className="neon-stick"
          style={{
            left: stick.left,
            top: stick.top,
            width: stick.w,
            height: stick.h,
            background: stick.color,
            boxShadow: `0 0 8px 2px ${stick.color}88, 0 0 20px 4px ${stick.color}44`,
            transform: `rotate(${stick.rot})`,
            "--dur": stick.dur,
            "--pulse": stick.pulse,
            "--delay": stick.delay,
          } as React.CSSProperties}
        />
      ))}

      {/* Subtle scan line */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.015) 3px, rgba(255,255,255,0.015) 4px)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ── Activity label mapping — no raw tool names in UI ──────────────────────
function formatActivityLabel(activity: string, toolName?: string): string {
  if (activity === "understanding") return "Thinking";
  if (activity === "executing_tool") {
    switch (toolName) {
      case "openai":            return "Reasoning";
      case "generate_media":    return "Generating";
      case "send_workspace_action": return "Updating workspace";
      case "list_workspace_files":  return "Reading files";
      case "read_workspace_file":   return "Reading file";
      case "write_workspace_file":  return "Writing file";
      case "apply_workspace_patch": return "Patching file";
      case "build_workspace":       return "Building";
      case "run_workspace_command": return "Running command";
      case "run_verification":      return "Verifying";
      default: return "Working";
    }
  }
  return "Working";
}

export default function AssistantFramePage() {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [toolbarOpen, setToolbarOpen] = useState(true);

  // ── postMessage bridge ────────────────────────────────────────────────────
  // Forward workspace.action events from WS to parent frame.
  // Also send PIPELINE_ASSISTANT_READY on mount so parent can init context.
  const handleWorkspaceAction = useCallback((action: { type: string; payload?: Record<string, unknown> }) => {
    window.parent.postMessage(
      { type: "PIPELINE_ASSISTANT_ACTION", action: action.type, payload: action.payload ?? {} },
      "*",
    );
  }, []);

  useEffect(() => {
    window.parent.postMessage({ type: "PIPELINE_ASSISTANT_READY" }, "*");
  }, []);

  const session = useAssistantSession({
    websocketUrl: REALTIME_WS_URL,
    autoConnect: true,
    onWorkspaceAction: handleWorkspaceAction,
  });

  const activeTurnId = session.session.activeTurnId;

  const previewsByTurn = useMemo(() => {
    const index = new Map<string, AssistantPreviewDescriptor[]>();

    Object.entries(session.previewsByTurn).forEach(([turnId, previewIds]) => {
      const previews = previewIds
        .map((previewId) => session.previews[previewId])
        .filter(Boolean) as AssistantPreviewDescriptor[];

      if (previews.length > 0) {
        index.set(turnId, previews);
      }
    });

    return index;
  }, [session.previews, session.previewsByTurn]);

  const handleSend = async () => {
    const value = draft.trim();
    if (!value || session.connectionState !== "connected") return;
    await session.sendTurn(value);
    setDraft("");
  };

  // Auto-resize textarea — PRD §14 input behavior
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const handleCancel = async () => {
    if (!session.isTurnRunning) return;
    await session.cancelTurn(activeTurnId ?? undefined);
  };

  return (
    <div className="grid h-screen grid-cols-[auto_1fr] bg-white text-zinc-900">
      <aside
        className={`border-r border-zinc-200 bg-zinc-50 transition-all ${toolbarOpen ? "w-[280px]" : "w-[68px]"}`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4">
            {toolbarOpen ? (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Assistant runtime
                </div>
                <div className="mt-1 text-xl font-semibold text-zinc-950">Session chat</div>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white p-2">
                <MessageSquare className="h-5 w-5 text-zinc-700" />
              </div>
            )}
            <button
              onClick={() => setToolbarOpen((value) => !value)}
              className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-600 hover:bg-zinc-100"
              aria-label={toolbarOpen ? "Collapse toolbar" : "Expand toolbar"}
            >
              {toolbarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          <div className="border-b border-zinc-200 px-4 py-3">
            <div className="flex items-center gap-2">
              {session.connectionState === "connected" ? (
                <Wifi className="h-4 w-4 text-emerald-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-zinc-400" />
              )}
              {toolbarOpen ? (
                <div className="flex-1">
                  <div className="text-xs font-medium text-zinc-900">{formatConnectionLabel(session.connectionState)}</div>
                  <div className="text-[11px] text-zinc-500">{session.session.sessionId || "Awaiting session"}</div>
                  {(session.connectionState === "closed" || session.connectionState === "error") ? (
                    <button
                      onClick={() => void session.connect()}
                      className="mt-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2"
                    >
                      Reconnect
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex-1 overflow-auto px-3 py-3">
            <div className="space-y-1">
              {toolbarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-zinc-700 hover:bg-white"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {toolbarOpen ? <span>{item.label}</span> : null}
                  </button>
                );
              })}
            </div>

            {toolbarOpen ? (
              <div className="mt-6">
                <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Recents
                </div>
                <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-2">
                  <div className="rounded-xl px-3 py-3 text-sm text-zinc-700">Current session</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <main className="grid h-screen grid-rows-[1fr_auto] bg-white">
        <div className="overflow-auto px-6 py-6">
          <div className="mx-auto flex max-w-4xl flex-col gap-5">
            {session.messages.length === 0 ? (
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Session runtime
                </div>
                <div className="mt-2 text-2xl font-semibold text-zinc-950">Start a real assistant session</div>
                <div className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                  Messages, activity, and inline preview attach here from the real session runtime. Heavy previews should promote to the main workspace preview screens.
                </div>
                <div className="mt-3 text-[11px] text-zinc-400 font-mono">
                  {REALTIME_WS_URL}
                </div>
              </div>
            ) : null}

            {session.messages.map((message) => {
              const isUser = message.role === "user";
              const turnPreviews = message.turnId ? previewsByTurn.get(message.turnId) ?? [] : [];
              const activity = message.turnId ? session.activities[message.turnId] : undefined;

              return (
                <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-3xl rounded-3xl border px-5 py-4 ${isUser ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-900"}`}>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      {isUser ? "You" : "Assistant"}
                    </div>
                    <div className={`mt-2 text-sm leading-7 ${isUser ? "text-white" : "text-zinc-800"}`}>
                      {isUser
                        ? (message.content || "")
                        : (message.content
                            ? renderContent(message.content)
                            : message.status === "streaming" && activity && formatActivityLabel(activity.activity, activity.toolName) === "Generating"
                              ? <NeonSkeleton />
                              : (message.status === "streaming" ? "…" : ""))
                      }
                    </div>

                    {activity && !isUser ? (
                      <div className="mt-3 inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium tracking-[0.06em] text-zinc-500">
                        {formatActivityLabel(activity.activity, activity.toolName)}
                      </div>
                    ) : null}

                    {!isUser && turnPreviews.length > 0 ? (
                      <div>
                        {turnPreviews.map((preview) => (
                          <PreviewCard key={preview.previewId} preview={preview} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {session.error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {session.error.message}
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-zinc-200 bg-white px-6 py-4">
          <div className="mx-auto flex max-w-4xl items-end gap-3">
            <div className="flex-1 rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Ask normally — chat, build, files, or generation requests"
                rows={1}
                className="max-h-48 min-h-[28px] w-full resize-none bg-transparent text-sm leading-6 text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </div>

            {session.isTurnRunning ? (
              <button
                onClick={handleCancel}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-zinc-200 px-4 text-sm font-medium text-zinc-800"
              >
                <Square className="h-4 w-4" />
                Cancel
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!draft.trim() || session.connectionState !== "connected"}
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}




