export type BuilderWorkstationView = "frontend" | "code" | "diff" | "logs" | "media" | "devtools";

export type BuilderAgentCommunication = {
  id: string;
  phase: string;
  message: string;
  detail?: string;
  status: "working" | "question" | "success" | "warning" | "error";
  view?: BuilderWorkstationView;
  reason?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  requiresResponse?: boolean;
  createdAt: string;
};

export const BUILDER_AGENT_COMMUNICATION_EVENT = "streams-builder:agent-communication";
export const BUILDER_VIEW_INTENT_EVENT = "streams-builder:view-intent";

function id() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `builder-agent-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function inferBuilderView(input: {
  phase?: string;
  message?: string;
  filePath?: string;
  hasPreview?: boolean;
  hasPatch?: boolean;
}): { view: BuilderWorkstationView; reason: string; confidence: number } {
  const text = `${input.phase || ""} ${input.message || ""} ${input.filePath || ""}`.toLowerCase();

  if (/screenshot|visual capture|image evidence|media artifact/.test(text)) {
    return { view: "media", reason: "The agent produced visual evidence that is easiest to verify in Media.", confidence: 0.96 };
  }
  if (/console|network|runtime error|hydration|unhandled|browser error|request failed|devtools/.test(text)) {
    return { view: "devtools", reason: "The current evidence is a browser-runtime or network failure.", confidence: 0.95 };
  }
  if (input.hasPatch || /editing lines|applying patch|patch applied|source range|reading .*\.(tsx?|jsx?|html|css|scss|js)/.test(text)) {
    return { view: "code", reason: "The agent is reading or changing a specific source range.", confidence: 0.94 };
  }
  if (/diff|changed files|review changes|before and after/.test(text)) {
    return { view: "diff", reason: "The user should inspect the exact source delta.", confidence: 0.93 };
  }
  if (/build|test|verify command|worker|clone|commit|push|pull|repository/.test(text)) {
    return { view: "logs", reason: "The active work is command execution or repository proof.", confidence: 0.86 };
  }
  if (input.hasPreview || /preview|frontend|render|page|screen|layout|button|form|visible|verified/.test(text)) {
    return { view: "frontend", reason: "The result is best confirmed in the running interface.", confidence: 0.84 };
  }
  return { view: "logs", reason: "No stronger visual target was inferred, so the activity stream remains visible.", confidence: 0.55 };
}

export function emitBuilderAgentCommunication(input: Omit<BuilderAgentCommunication, "id" | "createdAt">) {
  if (typeof window === "undefined") return;
  const communication: BuilderAgentCommunication = {
    ...input,
    id: id(),
    createdAt: new Date().toISOString(),
  };
  window.dispatchEvent(new CustomEvent(BUILDER_AGENT_COMMUNICATION_EVENT, { detail: communication }));
  if (communication.view) {
    window.dispatchEvent(new CustomEvent(BUILDER_VIEW_INTENT_EVENT, {
      detail: {
        view: communication.view,
        reason: communication.reason || communication.message,
        phase: communication.phase,
        filePath: communication.filePath,
        startLine: communication.startLine,
        endLine: communication.endLine,
        confidence: 1,
        source: "builder-agent",
      },
    }));
  }
}

export function emitInferredBuilderView(input: {
  phase?: string;
  message?: string;
  filePath?: string;
  hasPreview?: boolean;
  hasPatch?: boolean;
  force?: boolean;
}) {
  if (typeof window === "undefined") return;
  const inferred = inferBuilderView(input);
  if (!input.force && inferred.confidence < 0.72) return;
  window.dispatchEvent(new CustomEvent(BUILDER_VIEW_INTENT_EVENT, {
    detail: {
      view: inferred.view,
      reason: inferred.reason,
      phase: input.phase || "builder.activity",
      filePath: input.filePath,
      confidence: inferred.confidence,
      source: "builder-intelligence",
    },
  }));
}
