"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { useStreamsChatRuntime } from "./useStreamsChatRuntime";
import type { StreamsRuntimeStatus, StreamsWorkspaceArtifact, StreamsWorkspaceMessage } from "./types";

function ActionStatusPill({ status, streaming }: { status: StreamsRuntimeStatus; streaming: boolean }) {
  const tone = status.phase === "error" ? "border-red-400/40 bg-red-500/10 text-red-100" : status.phase === "complete" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" : "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
  return (
    <div className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${streaming ? "animate-pulse bg-current" : "bg-current"}`} />
      <span className="font-semibold tracking-[0.22em]">{status.label}</span>
      <span className="truncate text-white/70">{status.title}</span>
    </div>
  );
}

function MessageBubble({ message }: { message: StreamsWorkspaceMessage }) {
  const assistant = message.role === "assistant";
  return (
    <article className={`flex ${assistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[84%] rounded-[28px] border px-5 py-4 shadow-2xl ${
          assistant
            ? "border-white/10 bg-white/[0.06] text-white"
            : "border-fuchsia-300/30 bg-gradient-to-br from-fuchsia-500/25 to-cyan-500/20 text-white"
        }`}
      >
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">{message.role}</div>
        <div className="whitespace-pre-wrap text-sm leading-6 text-white/85">
          {message.content || (assistant ? "Streaming…" : "")}
        </div>
        {message.artifactIds.length > 0 ? (
          <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100">
            Artifact attached: {message.artifactIds.join(", ")}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function SessionRail({
  sessions,
  activeSessionId,
  loading,
  onNewChat,
  onSelect,
}: {
  sessions: ReturnType<typeof useStreamsChatRuntime>["sessions"];
  activeSessionId: string | null;
  loading: boolean;
  onNewChat: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="hidden w-[280px] shrink-0 border-r border-white/10 bg-black/25 p-4 lg:block">
      <button
        type="button"
        onClick={onNewChat}
        className="mb-5 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/15"
      >
        + New Chat
      </button>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-white/35">Sessions</div>
      <div className="space-y-2">
        {loading ? <div className="rounded-2xl border border-white/10 p-3 text-sm text-white/50">Loading sessions…</div> : null}
        {!loading && sessions.length === 0 ? <div className="rounded-2xl border border-white/10 p-3 text-sm text-white/50">No persisted sessions returned.</div> : null}
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => onSelect(session.id)}
            className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
              session.id === activeSessionId ? "border-cyan-300/40 bg-cyan-300/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
            }`}
          >
            <div className="truncate text-sm font-medium text-white">{session.title}</div>
            <div className="mt-1 truncate text-xs text-white/35">{session.id}</div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function ArtifactPreview({ artifact }: { artifact: StreamsWorkspaceArtifact | null }) {
  if (!artifact) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-[32px] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
        <div className="mb-3 text-4xl">✦</div>
        <h2 className="text-lg font-semibold text-white">Preview waits for real artifacts</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-white/50">When `/api/streams/chat` emits an artifact event, this panel opens on that active artifact and the code editor uses the same object.</p>
      </div>
    );
  }

  if (artifact.code) {
    return (
      <div className="flex h-full min-h-0 flex-col rounded-[32px] border border-white/10 bg-[#070711] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-white">{artifact.title ?? "Generated artifact"}</div>
            <div className="text-xs text-white/45">{artifact.type} · {artifact.language ?? "code"}</div>
          </div>
          <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-xs text-cyan-100">activeArtifact</span>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto p-5 text-xs leading-5 text-cyan-50"><code>{artifact.code}</code></pre>
      </div>
    );
  }

  const mediaUrl = artifact.storageUrl ?? artifact.url ?? artifact.thumbnailUrl;
  return (
    <div className="flex h-full flex-col rounded-[32px] border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">{artifact.title ?? "Generated artifact"}</div>
          <div className="text-xs text-white/45">{artifact.type}</div>
        </div>
        <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-xs text-cyan-100">preview</span>
      </div>
      {mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl} alt={artifact.title ?? "Generated artifact"} className="min-h-0 flex-1 rounded-3xl object-contain" />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-3xl border border-white/10 text-sm text-white/50">Artifact metadata received without a media URL.</div>
      )}
    </div>
  );
}

function CodeEditorPanel({ artifact }: { artifact: StreamsWorkspaceArtifact | null }) {
  return (
    <section className="mt-4 rounded-[28px] border border-white/10 bg-black/25 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Code editor</h3>
        <span className="text-xs text-white/40">same active artifact</span>
      </div>
      <textarea
        readOnly
        value={artifact?.code ?? "// No code artifact is active yet."}
        className="h-36 w-full resize-none rounded-2xl border border-white/10 bg-black/35 p-4 font-mono text-xs leading-5 text-white/70 outline-none"
      />
    </section>
  );
}

export default function StreamsWorkspaceShell() {
  const runtime = useStreamsChatRuntime();
  const [draft, setDraft] = useState("");
  const [leftWidth, setLeftWidth] = useState(58);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateKeyboardInset = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--streams-keyboard-inset", `${inset}px`);
    };

    updateKeyboardInset();
    window.visualViewport?.addEventListener("resize", updateKeyboardInset);
    window.visualViewport?.addEventListener("scroll", updateKeyboardInset);
    return () => {
      window.visualViewport?.removeEventListener("resize", updateKeyboardInset);
      window.visualViewport?.removeEventListener("scroll", updateKeyboardInset);
      document.documentElement.style.removeProperty("--streams-keyboard-inset");
    };
  }, []);

  const previewWidth = useMemo(() => `${100 - leftWidth}%`, [leftWidth]);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = shellRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const move = (moveEvent: PointerEvent) => {
      const pct = ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
      setLeftWidth(Math.min(72, Math.max(42, pct)));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt) return;
    setDraft("");
    void runtime.sendMessage(prompt);
  };

  return (
    <div className="min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_30%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.18),transparent_28%),#050510] text-white">
      <div className="flex h-dvh min-h-0 flex-col pb-[var(--streams-keyboard-inset,0px)]">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-black/20 px-4 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-2xl border border-white/15 bg-white/10 text-lg">✶</div>
            <div>
              <div className="text-sm font-semibold tracking-[0.18em] text-white">Lumen Streams</div>
              <div className="text-xs text-white/40">Standalone workspace · no login gate</div>
            </div>
          </div>
          <ActionStatusPill status={runtime.status} streaming={runtime.isStreaming} />
        </header>

        <div className="flex min-h-0 flex-1">
          <SessionRail
            sessions={runtime.sessions}
            activeSessionId={runtime.activeSessionId}
            loading={runtime.isLoadingSessions}
            onNewChat={() => void runtime.startNewChat()}
            onSelect={(id) => void runtime.selectSession(id)}
          />

          <main ref={shellRef} className="flex min-w-0 flex-1 flex-col lg:flex-row">
            <section className="flex min-h-0 min-w-0 flex-1 flex-col p-3 md:p-5 lg:flex-none" style={{ width: runtime.isPreviewOpen ? `${leftWidth}%` : "100%" }}>
              <div className="mb-4 grid grid-cols-3 gap-3">
                {["Chat", "Artifacts", "Build"].map((label) => (
                  <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.05] p-4">
                    <div className="text-xs uppercase tracking-[0.3em] text-white/35">{label}</div>
                    <div className="mt-2 text-sm text-white/80">Runtime wired</div>
                  </div>
                ))}
              </div>

              {runtime.error ? (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-3xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                  <span>{runtime.error}</span>
                  <button type="button" onClick={runtime.retryLastMessage} className="rounded-full border border-red-200/40 px-3 py-1 text-xs font-semibold">Retry</button>
                </div>
              ) : null}

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-[32px] border border-white/10 bg-black/20 p-4">
                {runtime.messages.length === 0 ? (
                  <div className="grid h-full place-items-center text-center">
                    <div>
                      <div className="mb-3 text-5xl">☾</div>
                      <h1 className="text-2xl font-semibold">Streams workspace</h1>
                      <p className="mt-3 max-w-xl text-sm leading-6 text-white/50">Sessions and messages load from the Streams chat backend. Send a prompt to stream real `/api/streams/chat` events into this shell.</p>
                    </div>
                  </div>
                ) : (
                  runtime.messages.map((message) => <MessageBubble key={message.id} message={message} />)
                )}
              </div>

              <form onSubmit={submit} className="mt-4 rounded-[30px] border border-white/10 bg-white/[0.06] p-2 shadow-2xl backdrop-blur-xl">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder="Ask Streams to build, explain, generate, or create an artifact…"
                    className="max-h-36 min-h-12 flex-1 resize-none rounded-[24px] border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                  />
                  <button
                    type="submit"
                    disabled={runtime.isStreaming || !draft.trim()}
                    className="rounded-[22px] bg-white px-5 py-3 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {runtime.isStreaming ? "Sending" : "Send"}
                  </button>
                </div>
              </form>
            </section>

            {runtime.isPreviewOpen ? (
              <>
                <div onPointerDown={startDrag} className="hidden w-2 cursor-col-resize items-center justify-center lg:flex">
                  <div className="h-16 w-1 rounded-full bg-white/15" />
                </div>
                <aside className="hidden min-h-0 shrink-0 flex-col border-l border-white/10 p-5 lg:flex" style={{ width: previewWidth }}>
                  <ArtifactPreview artifact={runtime.activeArtifact} />
                  <CodeEditorPanel artifact={runtime.activeArtifact} />
                </aside>
              </>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
