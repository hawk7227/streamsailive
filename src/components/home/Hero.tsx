"use client";

import Link from "next/link";

const modes = ["Business", "Image", "Video", "Voice", "Website", "Launch"];

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#030712] pt-28 pb-20 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.34),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(14,165,233,0.16),transparent_26%),linear-gradient(180deg,#090b1b_0%,#030712_70%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_86%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-[0_0_40px_rgba(34,211,238,0.12)]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.9)]" />
            STREAMS AI universal creation workspace
          </div>

          <h1 className="mx-auto max-w-4xl text-balance text-[clamp(44px,7vw,86px)] font-black leading-[0.95] tracking-[-0.07em]">
            What do you want to
            <span className="block bg-gradient-to-br from-indigo-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
              build or create?
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-300">
            Start with one prompt. Build websites, brands, content, ads, images,
            videos, voiceovers, launch plans, and income-stream systems from one AI front door.
          </p>

          <div className="mx-auto mt-10 max-w-4xl rounded-[28px] border border-white/10 bg-[#090f1f]/90 p-3 shadow-[0_35px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="rounded-[22px] border border-white/10 bg-[#050a14] p-5 text-left">
              <div className="mb-4 flex flex-wrap gap-2">
                {modes.map((mode, index) => (
                  <span
                    key={mode}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                      index === 0
                        ? "border-purple-300/40 bg-purple-500/20 text-purple-100"
                        : "border-white/10 bg-white/[0.04] text-slate-300"
                    }`}
                  >
                    {mode}
                  </span>
                ))}
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="min-h-[74px] flex-1 rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 text-slate-300">
                  Tell STREAMS what you want to build, launch, generate, promote, or automate...
                </div>

                <Link
                  href="/signup"
                  className="inline-flex h-[58px] items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 px-8 text-base font-extrabold text-white shadow-[0_18px_46px_rgba(168,85,247,0.35)] transition hover:-translate-y-0.5"
                >
                  Start Building →
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">Business builder</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">AI media studio</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">Launch workspace</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">Creator tools</span>
          </div>
        </div>
      </div>
    </section>
  );
}
