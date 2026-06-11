import StreamsBuilderDashboard from "@/components/streams-builder/StreamsBuilderDashboard";

export default function StreamsBuilderProjectsPage() {
  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-sky-400">Streams Builder / Projects</p>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Project dashboard.</h1>
          <p className="mt-4 max-w-4xl text-base leading-7 text-slate-300">Real project containers, preview slots, thumbnail switching, source truth, and activity-backed notifications.</p>
        </header>
        <StreamsBuilderDashboard mode="projects" />
      </div>
    </main>
  );
}
