"use client";

const capabilities = [
  {
    name: "AI Website Builder",
    tag: "Build",
    detail: "Prompt-first pages, landing sections, and launch-ready site flows.",
  },
  {
    name: "Image Studio",
    tag: "Create",
    detail: "Generate, edit, upscale, and organize visual assets from one board.",
  },
  {
    name: "Video Studio",
    tag: "Motion",
    detail: "Turn ideas, images, and scripts into cinematic video jobs.",
  },
  {
    name: "Voice Lab",
    tag: "Audio",
    detail: "Create narration, voiceovers, character reads, and spoken scenes.",
  },
  {
    name: "Music / Song",
    tag: "Sound",
    detail: "Draft hooks, songs, background music, and branded audio ideas.",
  },
  {
    name: "Business Planner",
    tag: "Plan",
    detail: "Shape offers, funnels, launch plans, and operating steps with AI.",
  },
  {
    name: "Automation Hub",
    tag: "Run",
    detail: "Route projects through jobs, tools, previews, storage, and launch actions.",
  },
];

const stats = ["7 creation modes", "One prompt-first board", "No oversized hero"];

export default function Home() {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#05070d] text-white">
      <div className="mx-auto flex h-dvh max-w-7xl flex-col px-4 py-3 sm:px-5 lg:px-6">
        <header className="flex h-14 shrink-0 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-sm font-black text-black">
              S
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight">Streams AI</p>
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">creation command board</p>
            </div>
          </div>

          <nav className="hidden items-center gap-5 text-xs font-semibold text-white/62 md:flex">
            <span>Build</span>
            <span>Create</span>
            <span>Video</span>
            <span>Launch</span>
          </nav>

          <button className="rounded-full border border-white/15 bg-white px-4 py-2 text-xs font-black text-black shadow-lg shadow-white/10 transition hover:bg-white/90">
            Start
          </button>
        </header>

        <section className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-3 py-3">
          <div className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-[1.65rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.22),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.11),rgba(255,255,255,0.035))] p-5 shadow-2xl shadow-black/35">
              <div className="mb-3 inline-flex rounded-full border border-white/12 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.26em] text-cyan-200">
                Compact homepage board
              </div>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <h1 className="max-w-3xl text-4xl font-black leading-[0.92] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
                    Build every AI creation flow from one clean screen.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/64 sm:text-base">
                    A tighter first viewport with the top bar, hero message, and all seven capability cards visible without the old oversized homepage sections.
                  </p>
                </div>
                <div className="grid min-w-48 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  {stats.map((stat) => (
                    <div key={stat} className="rounded-2xl border border-white/10 bg-black/22 px-3 py-2 text-xs font-bold text-white/72">
                      {stat}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[1.65rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/30">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/38">Live intent</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Prompt → route → preview → launch</h2>
              <p className="mt-2 text-sm leading-6 text-white/60">
                The homepage now acts like a command board: fast to scan, compact enough to show every major product lane immediately.
              </p>
              <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-xs font-bold leading-5 text-cyan-100">
                No imported Hero, Features, Testimonials, CTA, or Footer components.
              </div>
            </div>
          </div>

          <div className="grid min-h-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {capabilities.map((capability, index) => (
              <article
                key={capability.name}
                className="group flex min-h-0 flex-col justify-between rounded-[1.35rem] border border-white/10 bg-white/[0.055] p-4 shadow-xl shadow-black/25 transition hover:-translate-y-0.5 hover:border-cyan-200/30 hover:bg-white/[0.075]"
              >
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
                      {capability.tag}
                    </span>
                    <span className="text-xs font-black text-white/22">0{index + 1}</span>
                  </div>
                  <h3 className="text-base font-black leading-tight tracking-[-0.035em] text-white">
                    {capability.name}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-white/55">{capability.detail}</p>
                </div>

                <div className="mt-5 h-1.5 rounded-full bg-white/10">
                  <div className="h-full w-2/3 rounded-full bg-cyan-200/70 transition group-hover:w-full" />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
