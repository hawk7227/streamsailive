"use client";

import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SessionRow = {
  id: string;
  title: string;
  status: string;
  updated_at?: string;
  created_at?: string;
};

type MessageRow = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  created_at?: string;
};

type AssetRow = {
  id: string;
  name: string;
  kind: string;
  mime_type?: string;
  size_bytes?: number;
  created_at?: string;
};

type CreditState = {
  balance: number;
  ledger: unknown[];
};

type JobRow = {
  id: string;
  status: string;
  kind: string;
  created_at?: string;
};

function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    global: { headers: { "x-streams-ai-client": "streams-ai-shell" } },
  });
}

async function getToken() {
  const client = createBrowserClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session?.access_token || null;
}

async function api(path: string, init: RequestInit = {}) {
  const token = await getToken();
  if (!token) throw new Error("Sign in is required before using STREAMS AI.");
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(data?.error || `Request failed: ${response.status}`);
  return data;
}

export default function StreamsAIChatShell() {
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [credits, setCredits] = useState<CreditState | null>(null);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || null,
    [sessions, activeSessionId],
  );

  const refreshSessions = useCallback(async () => {
    const data = await api("/api/streams-ai/sessions");
    const rows = (data.sessions || []) as SessionRow[];
    setSessions(rows);
    return rows;
  }, []);

  const refreshSessionData = useCallback(async (sessionId: string) => {
    const [messageData, assetData, jobData, creditData] = await Promise.all([
      api(`/api/streams-ai/messages?sessionId=${encodeURIComponent(sessionId)}`),
      api(`/api/streams-ai/assets?sessionId=${encodeURIComponent(sessionId)}`),
      api(`/api/streams-ai/jobs?sessionId=${encodeURIComponent(sessionId)}`),
      api("/api/streams-ai/credits"),
    ]);
    setMessages((messageData.messages || []) as MessageRow[]);
    setAssets((assetData.assets || []) as AssetRow[]);
    setJobs((jobData.jobs || []) as JobRow[]);
    setCredits({ balance: Number(creditData.balance || 0), ledger: creditData.ledger || [] });
  }, []);

  const createNewSession = useCallback(async () => {
    const data = await api("/api/streams-ai/sessions", {
      method: "POST",
      body: JSON.stringify({ title: "New STREAMS AI chat" }),
    });
    const session = data.session as SessionRow;
    setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
    setActiveSessionId(session.id);
    setMessages([]);
    setAssets([]);
    setJobs([]);
    await refreshSessionData(session.id);
  }, [refreshSessionData]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setBooting(true);
      setError(null);
      try {
        const rows = await refreshSessions();
        if (cancelled) return;
        if (rows.length) {
          setActiveSessionId(rows[0].id);
          await refreshSessionData(rows[0].id);
        } else {
          const data = await api("/api/streams-ai/sessions", {
            method: "POST",
            body: JSON.stringify({ title: "New STREAMS AI chat" }),
          });
          const session = data.session as SessionRow;
          setSessions([session]);
          setActiveSessionId(session.id);
          await refreshSessionData(session.id);
        }
      } catch (bootError) {
        setError(bootError instanceof Error ? bootError.message : "STREAMS AI failed to load.");
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [refreshSessions, refreshSessionData]);

  async function selectSession(sessionId: string) {
    setActiveSessionId(sessionId);
    setError(null);
    try {
      await refreshSessionData(sessionId);
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "Failed to load session.");
    }
  }

  async function sendMessage() {
    const text = composer.trim();
    if (!text || !activeSessionId || sending) return;
    setComposer("");
    setSending(true);
    setError(null);
    setMessages((current) => [
      ...current,
      { id: `optimistic-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() },
    ]);
    try {
      await api("/api/streams-ai/messages", {
        method: "POST",
        body: JSON.stringify({ sessionId: activeSessionId, content: text, role: "user", runAssistant: true }),
      });
      const rows = await refreshSessions();
      setSessions(rows);
      await refreshSessionData(activeSessionId);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || !activeSessionId) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append("file", file));
      form.set("sessionId", activeSessionId);
      await api("/api/streams-ai/assets", { method: "POST", body: form });
      await refreshSessionData(activeSessionId);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <main className="min-h-screen bg-[#050711] text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[310px_minmax(0,1fr)_320px]">
        <aside className="border-b border-white/10 bg-black/35 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">STREAMS AI</p>
              <h1 className="text-xl font-black tracking-[-0.03em]">Chat</h1>
            </div>
            <Link href="/" className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10">
              Home
            </Link>
          </div>

          <button
            type="button"
            onClick={createNewSession}
            disabled={booting}
            className="mb-4 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
          >
            New chat
          </button>

          <div className="space-y-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => selectSession(session.id)}
                className={`w-full rounded-2xl border px-3 py-3 text-left text-sm transition ${
                  session.id === activeSessionId
                    ? "border-cyan-300/40 bg-cyan-300/10 text-white"
                    : "border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.07]"
                }`}
              >
                <div className="truncate font-black">{session.title || "New STREAMS AI chat"}</div>
                <div className="mt-1 text-[11px] text-slate-500">{session.status || "active"}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[70dvh] min-w-0 flex-col">
          <header className="border-b border-white/10 bg-black/25 px-4 py-3 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Physical module</p>
            <h2 className="mt-1 truncate text-xl font-black text-white">
              {activeSession?.title || "STREAMS AI Chat"}
            </h2>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            {booting ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center text-slate-300">
                Loading STREAMS AI from the main streamsailive account system…
              </div>
            ) : null}

            {error ? (
              <div className="mb-4 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm font-semibold text-red-100">
                {error}
              </div>
            ) : null}

            {!booting && !messages.length ? (
              <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/30">
                <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-fuchsia-500" />
                <h3 className="text-2xl font-black tracking-[-0.03em]">Start, fix, or grow an income stream.</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  This physical `/streams-ai` module writes sessions, messages, uploads, jobs, credits, and history through the main streamsailive APIs.
                </p>
              </div>
            ) : null}

            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[86%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm leading-6 ${
                      message.role === "user"
                        ? "bg-white text-slate-950"
                        : "border border-white/10 bg-white/[0.05] text-slate-100"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {sending ? (
                <div className="self-start rounded-3xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-slate-300">
                  STREAMS AI is responding…
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/35 p-4 sm:p-5">
            <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.05] p-3 shadow-2xl shadow-black/25">
              <textarea
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask STREAMS AI to build, fix, improve, or grow something…"
                className="min-h-[82px] w-full resize-none bg-transparent p-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1">
                <input ref={fileRef} type="file" multiple className="hidden" onChange={(event) => uploadFiles(event.target.files)} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={!activeSessionId || uploading}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-black text-slate-200 hover:bg-white/10 disabled:opacity-50"
                >
                  {uploading ? "Uploading…" : "Upload asset"}
                </button>
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!composer.trim() || !activeSessionId || sending}
                  className="rounded-2xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-5 py-2.5 text-xs font-black text-white disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="border-t border-white/10 bg-black/25 p-4 lg:border-l lg:border-t-0">
          <div className="mb-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Credits</p>
            <div className="mt-2 text-3xl font-black text-white">{credits ? credits.balance : "—"}</div>
            <p className="mt-1 text-xs text-slate-500">Main streamsailive ledger</p>
          </div>

          <div className="mb-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Assets</p>
            <div className="space-y-2">
              {assets.slice(0, 8).map((asset) => (
                <div key={asset.id} className="rounded-2xl bg-black/30 px-3 py-2 text-xs text-slate-300">
                  <div className="truncate font-bold text-white">{asset.name}</div>
                  <div className="text-slate-500">{asset.kind}</div>
                </div>
              ))}
              {!assets.length ? <p className="text-xs text-slate-500">No assets uploaded yet.</p> : null}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Jobs</p>
            <div className="space-y-2">
              {jobs.slice(0, 8).map((job) => (
                <div key={job.id} className="rounded-2xl bg-black/30 px-3 py-2 text-xs text-slate-300">
                  <div className="truncate font-bold text-white">{job.kind}</div>
                  <div className="text-slate-500">{job.status}</div>
                </div>
              ))}
              {!jobs.length ? <p className="text-xs text-slate-500">No jobs yet.</p> : null}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
