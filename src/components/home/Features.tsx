"use client";

import { BrainCircuit, Folder, ShieldCheck, Sparkles, Zap } from "lucide-react";

const benefits = [
  { title: "All your work, in one place", description: "Projects, files, tasks, and more—organized around the work you want to finish.", icon: Folder },
  { title: "AI that understands your context", description: "A.S.K. AI remembers and stays in sync across your workspace.", icon: BrainCircuit },
  { title: "Create without limits", description: "Generate content, visuals, videos, voices, and more from one connected flow.", icon: Sparkles },
  { title: "Build and automate faster", description: "A.S.K. Knock helps you build, deploy, automate, and ship with confidence.", icon: Zap },
  { title: "Secure and private by design", description: "Workspace-level access and protection keep your data under control.", icon: ShieldCheck },
];

export default function Features() {
  return (
    <section id="workspace-benefits" className="relative overflow-hidden border-t border-white/8 bg-[#020713] px-5 py-14 sm:px-8 sm:py-20 lg:px-[clamp(2.5rem,5vw,7rem)] lg:py-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,.08),transparent_68%)]" />
      <div className="relative mx-auto w-full max-w-[1680px]">
        <h2 className="text-center text-2xl font-semibold tracking-[-.035em] text-white sm:text-3xl lg:text-4xl">Everything you need, in <span className="text-cyan-300">one connected workspace.</span></h2>
        <div className="mt-12 grid grid-cols-1 gap-9 sm:grid-cols-2 lg:grid-cols-5 lg:gap-[clamp(2rem,3vw,4rem)]">
          {benefits.map(({ title, description, icon: Icon }) => (
            <div key={title} className="text-center sm:text-left lg:text-center">
              <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400/[.04] text-cyan-300 shadow-[0_0_28px_rgba(34,211,238,.16)] sm:mx-0 lg:mx-auto"><Icon size={25} strokeWidth={1.7} /></span>
              <h3 className="mt-5 text-sm font-semibold leading-5 text-white">{title}</h3>
              <p className="mx-auto mt-2 max-w-[17rem] text-sm leading-6 text-slate-500 sm:mx-0 lg:mx-auto">{description}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-7 border-t border-white/8 pt-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-cyan-300 shadow-[0_0_24px_rgba(34,211,238,.2)]"><Sparkles size={20} /></span><div><strong className="block text-white">Always evolving</strong><span>New features. New possibilities.</span></div></div>
          <div className="flex items-center gap-3 sm:text-right"><span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-violet-300 shadow-[0_0_24px_rgba(139,92,246,.2)] sm:order-2"><ShieldCheck size={20} /></span><div><strong className="block text-white">Built for results</strong><span>From ideas to completed work.</span></div></div>
        </div>
      </div>
    </section>
  );
}
