import BeforeAfterReviewPanel from "@/components/streams-builder/BeforeAfterReviewPanel";
import WorkspaceGrid from "@/components/streams-builder/WorkspaceGrid";

export const dynamic = "force-dynamic";

export default function StreamsBuilderPage() {
  return (
    <main className="h-dvh min-h-dvh overflow-hidden bg-slate-950 text-white">
      <header className="flex h-8 items-center gap-2 border-b border-slate-800 bg-slate-950 px-2">
        <div aria-hidden="true">◆</div>
        <div>
          <h1 className="m-0 text-sm font-black">STREAMS BUILDER</h1>
          <p className="m-0 text-xs text-blue-300">Intelligent Build Operating System</p>
        </div>
      </header>
      <section className="h-full min-h-0 overflow-hidden" aria-label="Streams Builder workspace">
        <WorkspaceGrid />
      </section>
      <BeforeAfterReviewPanel />
    </main>
  );
}
