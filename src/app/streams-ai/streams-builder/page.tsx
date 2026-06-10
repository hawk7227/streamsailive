import StreamsBuilderControlPanel from "@/components/streams-builder/StreamsBuilderControlPanel";
import {
  createStreamsBuilderBridgePayloadFromSearchParams,
  createStreamsBuilderBridgeState,
} from "@/lib/streams-builder/bridge";
import type { StreamsBuilderTruthState } from "@/lib/streams-builder/types";

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const truthColor: Record<StreamsBuilderTruthState, string> = {
  PROVEN: "#22c55e",
  FAILED: "#ef4444",
  UNPROVEN: "#f59e0b",
  UNKNOWN: "#64748b",
  WAITING_FOR_USER: "#38bdf8",
};

function TruthBadge({ state }: { state: StreamsBuilderTruthState }) {
  return (
    <span className="rounded-full border border-slate-600 px-3 py-1 text-xs font-bold text-slate-100">
      <span
        aria-hidden="true"
        className="mr-2 inline-block size-2 rounded-full"
        style={{ backgroundColor: truthColor[state] }}
      />
      {state}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-t border-slate-700 py-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="max-w-[60%] break-words text-right font-semibold text-slate-100">
        {value || "UNPROVEN"}
      </span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-950/70 p-5 shadow-2xl shadow-black/20">
      <h2 className="mb-4 text-lg font-black text-white">{title}</h2>
      {children}
    </section>
  );
}

export default async function StreamsAIBuilderPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await Promise.resolve(searchParams) : {};
  const payload = createStreamsBuilderBridgePayloadFromSearchParams(resolvedSearchParams);
  const bridge = createStreamsBuilderBridgeState(payload);

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-sky-400">
            Streams AI / Streams Builder Bridge
          </p>
          <h1 className="mb-4 text-4xl font-black tracking-tight sm:text-6xl">
            Conversation becomes execution here.
          </h1>
          <p className="max-w-4xl text-base leading-7 text-slate-300">
            This route lives inside Streams AI at /streams-ai/streams-builder. It receives conversation context,
            creates a project container, opens a builder session, exposes source truth, tracks loop state, runs browser
            verification, and blocks live approval until the required proof gates are satisfied.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Project Container">
            <TruthBadge state={bridge.project.truthState} />
            <Row label="Project" value={bridge.project.name} />
            <Row label="Project ID" value={bridge.project.projectId} />
            <Row label="Repo" value={bridge.project.repo} />
            <Row label="Status" value={bridge.project.status} />
            <Row label="Conversation" value={bridge.project.createdFromConversationId} />
          </Card>

          <Card title="Builder Session">
            <TruthBadge state={bridge.session.activeProofStatus} />
            <Row label="Session" value={bridge.session.sessionId} />
            <Row label="Workspace" value={bridge.session.activeWorkspace} />
            <Row label="Route" value={bridge.session.activeRoute} />
            <Row label="Component" value={bridge.session.activeComponent} />
            <Row label="File" value={bridge.session.activeFile} />
          </Card>

          <Card title="Source Truth Registry">
            <TruthBadge state={bridge.sourceTruth.truthState} />
            <Row label="Preview URL" value={bridge.sourceTruth.previewUrl} />
            <Row label="Route" value={bridge.sourceTruth.route} />
            <Row label="Component" value={bridge.sourceTruth.component} />
            <Row label="GitHub Path" value={bridge.sourceTruth.githubPath} />
            <Row label="Checkpoint" value={bridge.sourceTruth.checkpoint} />
          </Card>
        </div>

        <StreamsBuilderControlPanel bridge={bridge} />

        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Transferred Requirements">
            <pre className="whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">
              {bridge.transferredContext.requirements}
            </pre>
          </Card>
          <Card title="Transferred Architecture">
            <pre className="whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">
              {bridge.transferredContext.architecture}
            </pre>
          </Card>
          <Card title="Transferred Blueprint">
            <pre className="whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">
              {bridge.transferredContext.blueprint}
            </pre>
          </Card>
        </div>

        <Card title="Loop Logic">
          <div className="grid gap-4 lg:grid-cols-4">
            {bridge.loops.map((loop) => (
              <section key={loop.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                <TruthBadge state={loop.truthState} />
                <h3 className="mt-4 text-base font-black text-white">{loop.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{loop.currentStep}</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">Stop: {loop.stopCondition}</p>
              </section>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
