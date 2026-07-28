"use client";

import Link from "next/link";
import { Box, MessageCircle, Search } from "lucide-react";

const pillars = [
  {
    title: "Ask",
    description: "Get intelligent answers and brainstorm ideas with A.S.K. AI.",
    icon: MessageCircle,
    accent: "text-cyan-300",
    glow: "shadow-[0_0_30px_rgba(34,211,238,.24)]",
  },
  {
    title: "Seek",
    description: "Find insights, research, and the right information instantly.",
    icon: Search,
    accent: "text-sky-300",
    glow: "shadow-[0_0_30px_rgba(56,189,248,.22)]",
  },
  {
    title: "A.S.K. Knock",
    description: "Execute ideas with powerful building and automation tools.",
    icon: Box,
    accent: "text-violet-300",
    glow: "shadow-[0_0_30px_rgba(139,92,246,.24)]",
  },
];

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden px-5 pb-14 pt-28 sm:px-8 sm:pb-20 sm:pt-32 lg:px-10 lg:pb-24 lg:pt-36">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[#020713]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_72%_42%,rgba(37,99,235,.18),transparent_30%),radial-gradient(circle_at_78%_46%,rgba(147,51,234,.14),transparent_24%)]" />

      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,.95fr)] lg:gap-8">
        <div className="max-w-3xl">
          <span className="inline-flex text-[11px] font-semibold uppercase tracking-[.2em] text-slate-400">
            Streams Workspace
          </span>

          <h1 className="mt-5 text-[clamp(2.65rem,8vw,5.4rem)] font-semibold leading-[.98] tracking-[-.055em] text-white">
            Your intelligent workspace for{" "}
            <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
              thinking, creating,
            </span>{" "}
            and building.
          </h1>

          <p className="mt-7 text-lg font-medium text-white sm:text-xl">
            Streams Workspace, hosted by <span className="text-cyan-300">A.S.K. AI.</span>
          </p>

          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
            Ask questions, seek answers, organize work, create content, and turn ideas into completed projects from one connected workspace.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_50px_rgba(37,99,235,.28)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              Get Started for Free
            </Link>
            <Link
              href="/streams-ai"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              See How It Works <span className="ml-3" aria-hidden="true">▶</span>
            </Link>
          </div>
        </div>

        <div className="relative mx-auto flex aspect-square w-full max-w-[31rem] items-center justify-center" aria-hidden="true">
          <div className="absolute h-[82%] w-[82%] rounded-full bg-[radial-gradient(circle,rgba(30,64,175,.3),rgba(91,33,182,.14)_45%,transparent_70%)] blur-2xl" />
          <div className="absolute h-[72%] w-[72%] rounded-full border border-blue-500/20 shadow-[0_0_90px_rgba(37,99,235,.25),inset_0_0_70px_rgba(124,58,237,.12)]" />
          <div className="absolute h-[58%] w-[58%] rotate-12 rounded-full border border-violet-500/30 shadow-[0_0_55px_rgba(124,58,237,.28)]" />
          <div className="absolute h-[48%] w-[48%] -rotate-12 rounded-full border border-cyan-400/35 shadow-[0_0_45px_rgba(34,211,238,.25)]" />
          <div className="absolute h-[31%] w-[31%] rounded-full bg-[radial-gradient(circle_at_40%_36%,rgba(103,232,249,.98),rgba(14,165,233,.95)_22%,rgba(37,99,235,.72)_48%,rgba(76,29,149,.36)_68%,transparent_72%)] shadow-[0_0_45px_rgba(34,211,238,.8),0_0_100px_rgba(79,70,229,.65)]" />
          <div className="absolute h-[8%] w-[8%] rounded-full bg-cyan-200 shadow-[0_0_30px_rgba(103,232,249,1)]" />
        </div>
      </div>

      <div className="mx-auto mt-12 grid w-full max-w-7xl grid-cols-1 gap-8 border-t border-white/8 pt-9 sm:grid-cols-3 lg:mt-8">
        {pillars.map(({ title, description, icon: Icon, accent, glow }) => (
          <div key={title} className="flex items-start gap-4">
            <span className={`mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[.025] ${accent} ${glow}`}>
              <Icon size={23} strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">{title}</h2>
              <p className="mt-1.5 max-w-xs text-sm leading-6 text-slate-500">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
