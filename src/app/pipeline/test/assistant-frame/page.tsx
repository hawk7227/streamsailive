"use client";
import { useMemo, useState } from "react";
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

import { useAssistantSession } from "./useAssistantSession.ts";
import type { AssistantPreviewDescriptor } from "./assistant-protocol.ts";

type AssistantFramePageProps = {
  websocketUrl: string;
  initialContext?: Record<string, unknown>;
};

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

function PreviewCard({ preview }: { preview: AssistantPreviewDescriptor }) {
  return (
    <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{preview.title || "Preview"}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {preview.previewType} · {preview.route} · {preview.status}
          </div>
        </div>
        <div className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          Inline preview
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500">
        Real preview target attached for this turn. Heavy or interactive previews should promote to the main preview screen.
      </div>
    </div>
  );
}

export default function AssistantFramePage(props: AssistantFramePageProps) {
  const { websocketUrl, initialContext } = props;
  const [draft, setDraft] = useState("");
  const [toolbarOpen, setToolbarOpen] = useState(true);

  const session = useAssistantSession({
    websocketUrl,
    initialContext,
    autoConnect: true,
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
                <div>
                  <div className="text-xs font-medium text-zinc-900">{formatConnectionLabel(session.connectionState)}</div>
                  <div className="text-[11px] text-zinc-500">{session.session.sessionId || "Awaiting session"}</div>
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
                    <div className={`mt-2 whitespace-pre-wrap text-sm leading-7 ${isUser ? "text-white" : "text-zinc-800"}`}>
                      {message.content || (!isUser && message.status === "streaming" ? "…" : "")}
                    </div>

                    {activity && !isUser ? (
                      <div className="mt-3 inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600">
                        {activity.activity}
                        {activity.toolName ? ` · ${activity.toolName}` : ""}
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
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
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
