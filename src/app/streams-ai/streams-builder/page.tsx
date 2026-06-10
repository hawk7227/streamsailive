import {
  createStreamsBuilderBridgePayloadFromSearchParams,
  createStreamsBuilderBridgeState,
} from "@/lib/streams-builder/bridge";
import type { StreamsBuilderTruthState } from "@/lib/streams-builder/types";

type SearchParams = Record<string, string | string[] | undefined>;

type StreamsBuilderPageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const truthColor: Record<StreamsBuilderTruthState, string> = {
  PROVEN: "#22c55e",
  FAILED: "#ef4444",
  UNPROVEN: "#f59e0b",
  UNKNOWN: "#64748b",
  WAITING_FOR_USER: "#38bdf8",
};

const styles = {
  page: {
    minHeight: "100dvh",
    background: "linear-gradient(135deg, #020617 0%, #0f172a 52%, #111827 100%)",
    color: "#f8fafc",
    padding: "32px",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  shell: {
    display: "grid",
    gap: "18px",
    maxWidth: "1440px",
    margin: "0 auto",
  },
  hero: {
    border: "1px solid rgba(148, 163, 184, 0.26)",
    background: "rgba(15, 23, 42, 0.78)",
    borderRadius: "28px",
    padding: "24px",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.32)",
  },
  eyebrow: {
    color: "#38bdf8",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.16em",
    textTransform: "uppercase" as const,
    marginBottom: "10px",
  },
  title: {
    fontSize: "clamp(30px, 5vw, 60px)",
    lineHeight: 1,
    margin: "0 0 14px",
    fontWeight: 900,
  },
  description: {
    color: "#cbd5e1",
    fontSize: "16px",
    lineHeight: 1.65,
    maxWidth: "920px",
    margin: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "18px",
  },
  card: {
    border: "1px solid rgba(148, 163, 184, 0.22)",
    background: "rgba(15, 23, 42, 0.72)",
    borderRadius: "24px",
    padding: "20px",
  },
  cardTitle: {
    fontSize: "18px",
    margin: "0 0 14px",
    fontWeight: 850,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    borderTop: "1px solid rgba(148, 163, 184, 0.14)",
    padding: "10px 0",
    fontSize: "13px",
  },
  label: {
    color: "#94a3b8",
  },
  value: {
    color: "#f8fafc",
    fontWeight: 700,
    textAlign: "right" as const,
    overflowWrap: "anywhere" as const,
  },
  status: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    borderRadius: "999px",
    border: "1px solid rgba(148, 163, 184, 0.28)",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 850,
  },
  dot: {
    width: "9px",
    height: "9px",
    borderRadius: "999px",
  },
  contextBox: {
    minHeight: "110px",
    borderRadius: "18px",
    background: "rgba(2, 6, 23, 0.58)",
    border: "1px solid rgba(148, 163, 184, 0.16)",
    padding: "14px",
    color: "#dbeafe",
    whiteSpace: "pre-wrap" as const,
    fontSize: "13px",
    lineHeight: 1.55,
  },
};

function ValueRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <span style={styles.value}>{value || "UNPROVEN"}</span>
    </div>
  );
}

function TruthBadge({ state }: { state: StreamsBuilderTruthState }) {
  return (
    <span style={styles.status}>
      <span style={{ ...styles.dot, background: truthColor[state] }} />
      {state}
    </span>
  );
}

export default async function StreamsAIBuilderPage({ searchParams }: StreamsBuilderPageProps) {
  const resolvedSearchParams = searchParams ? await Promise.resolve(searchParams) : {};
  const payload = createStreamsBuilderBridgePayloadFromSearchParams(resolvedSearchParams);
  const bridge = createStreamsBuilderBridgeState(payload);

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.hero}>
          <div style={styles.eyebrow}>Streams AI / Streams Builder Bridge</div>
          <h1 style={styles.title}>Conversation becomes execution here.</h1>
          <p style={styles.description}>
            This nested Builder route receives Streams AI conversation context, creates a project container,
            opens a builder session, exposes source truth, and tracks the required loops before repository
            execution, proof, and approval are allowed.
          </p>
        </div>

        <div style={styles.grid}>
          <article style={styles.card}>
            <h2 style={styles.cardTitle}>Project Container</h2>
            <TruthBadge state={bridge.project.truthState} />
            <ValueRow label="Project" value={bridge.project.name} />
            <ValueRow label="Project ID" value={bridge.project.projectId} />
            <ValueRow label="Repo" value={bridge.project.repo} />
            <ValueRow label="Status" value={bridge.project.status} />
            <ValueRow label="Conversation" value={bridge.project.createdFromConversationId} />
          </article>

          <article style={styles.card}>
            <h2 style={styles.cardTitle}>Builder Session</h2>
            <TruthBadge state={bridge.session.activeProofStatus} />
            <ValueRow label="Session" value={bridge.session.sessionId} />
            <ValueRow label="Workspace" value={bridge.session.activeWorkspace} />
            <ValueRow label="Route" value={bridge.session.activeRoute} />
            <ValueRow label="Component" value={bridge.session.activeComponent} />
            <ValueRow label="File" value={bridge.session.activeFile} />
          </article>

          <article style={styles.card}>
            <h2 style={styles.cardTitle}>Source Truth Registry</h2>
            <TruthBadge state={bridge.sourceTruth.truthState} />
            <ValueRow label="Preview URL" value={bridge.sourceTruth.previewUrl} />
            <ValueRow label="Route" value={bridge.sourceTruth.route} />
            <ValueRow label="Component" value={bridge.sourceTruth.component} />
            <ValueRow label="GitHub Path" value={bridge.sourceTruth.githubPath} />
            <ValueRow label="Checkpoint" value={bridge.sourceTruth.checkpoint} />
          </article>
        </div>

        <div style={styles.grid}>
          <article style={styles.card}>
            <h2 style={styles.cardTitle}>Transferred Requirements</h2>
            <div style={styles.contextBox}>{bridge.transferredContext.requirements}</div>
          </article>
          <article style={styles.card}>
            <h2 style={styles.cardTitle}>Transferred Architecture</h2>
            <div style={styles.contextBox}>{bridge.transferredContext.architecture}</div>
          </article>
          <article style={styles.card}>
            <h2 style={styles.cardTitle}>Transferred Blueprint</h2>
            <div style={styles.contextBox}>{bridge.transferredContext.blueprint}</div>
          </article>
        </div>

        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Loop Logic</h2>
          <div style={styles.grid}>
            {bridge.loops.map((loop) => (
              <section key={loop.id} style={styles.contextBox}>
                <TruthBadge state={loop.truthState} />
                <h3 style={{ fontSize: "16px", margin: "14px 0 8px" }}>{loop.label}</h3>
                <p style={{ margin: "0 0 8px", color: "#cbd5e1" }}>{loop.currentStep}</p>
                <p style={{ margin: 0, color: "#94a3b8" }}>Stop: {loop.stopCondition}</p>
              </section>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
