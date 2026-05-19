"use client";

import Link from "next/link";

const chatAppUrl = "https://streamsailive-chat-streamsa-git-9a8852-marcus-projects-d02c47f6.vercel.app/";

export default function StreamsAIPage() {
  return (
    <main className="min-h-screen bg-[#050711] text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-5 py-16 text-center">
        <div className="mb-6 inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
          STREAMS AI module · bridge phase
        </div>

        <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.06em] sm:text-7xl">
          STREAMS AI Chat
        </h1>

        <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
          This route is the isolated landing point for moving the current STREAMS AI chat UI into the main streamsailive app. The standalone chat app remains untouched until this route is proven.
        </p>

        <div className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-left text-sm leading-6 text-slate-300 shadow-2xl shadow-black/30 sm:grid-cols-2">
          <div>
            <h2 className="font-black text-white">Current source UI</h2>
            <p className="mt-2 break-all text-slate-400">{chatAppUrl}</p>
          </div>
          <div>
            <h2 className="font-black text-white">Production target</h2>
            <p className="mt-2 text-slate-400">Main streamsailive auth, sessions, messages, assets, jobs, credits, and history will be wired one layer at a time.</p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href={chatAppUrl}
            className="rounded-2xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-6 py-4 text-sm font-black text-white shadow-xl shadow-cyan-950/30"
          >
            Open current chat UI
          </a>
          <Link
            href="/"
            className="rounded-2xl border border-white/15 bg-white/[0.06] px-6 py-4 text-sm font-black text-white transition hover:bg-white/[0.1]"
          >
            Back to home
          </Link>
        </div>

        <p className="mt-8 max-w-2xl text-xs leading-6 text-slate-500">
          Status: bridge route only. No production persistence, credit, job, asset, or provider-run claim is made by this page.
        </p>
      </section>
    </main>
  );
}
