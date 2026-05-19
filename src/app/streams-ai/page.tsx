"use client";

import Link from "next/link";
import { useState } from "react";

const chatAppUrl = "https://streamsailive-chat-streamsa-git-9a8852-marcus-projects-d02c47f6.vercel.app/";

export default function StreamsAIPage() {
  const [loaded, setLoaded] = useState(false);

  return (
    <main className="min-h-screen bg-[#050711] text-white">
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/45 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
              STREAMS AI module · bridge phase
            </p>
            <h1 className="truncate text-lg font-black tracking-[-0.03em] text-white sm:text-xl">
              STREAMS AI Chat
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-xs font-bold">
            <a
              href={chatAppUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-cyan-100 transition hover:bg-cyan-300/15 sm:inline-flex"
            >
              Open source app
            </a>
            <Link
              href="/"
              className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-white transition hover:bg-white/[0.12]"
            >
              Home
            </Link>
          </div>
        </header>

        <section className="relative min-h-0 flex-1 overflow-hidden bg-white">
          {!loaded ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-[#050711] px-5 text-center">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
                <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-2xl bg-gradient-to-br from-cyan-400 to-fuchsia-500" />
                <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">
                  Loading current chat UI
                </p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
                  The existing deployed chat UI is mounted here intact while auth,
                  scoped sessions, messages, storage, jobs, credits, and history
                  are wired into streamsailive one layer at a time.
                </p>
              </div>
            </div>
          ) : null}

          <iframe
            title="STREAMS AI Chat"
            src={chatAppUrl}
            className="h-[calc(100dvh-57px)] w-full border-0 bg-white"
            allow="clipboard-read; clipboard-write; camera; microphone; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setLoaded(true)}
          />
        </section>
      </div>
    </main>
  );
}
