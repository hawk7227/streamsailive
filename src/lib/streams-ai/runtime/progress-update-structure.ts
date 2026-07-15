import { sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "../protected-reasoning";

export type ProgressEvidence = {
  level: string;
  summary: string;
  verificationState: string;
};

export type StructuredProgressUpdate = {
  goal: string;
  completedWork: string[];
  currentAction: string;
  evidence: ProgressEvidence;
  nextAction: string;
  remainingWork: string[];
  planVersion: number;
};

type ProgressInput = Record<string, any> & {
  message?: string | null;
  jobInput?: Record<string, any> | null;
};

function text(value: unknown, fallback = "") {
  const clean = sanitizeStreamsAIText(value, 1200).trim();
  return clean || fallback;
}

function list(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(typeof item === "string" ? item : item?.label || item?.name || item?.id || ""))
    .filter(Boolean)
    .slice(0, 20);
}

export function buildStructuredProgressUpdate(input: ProgressInput): StructuredProgressUpdate {
  const data = sanitizeStreamsAIPayload(input || {}) as Record<string, any>;
  const jobInput = sanitizeStreamsAIPayload(input.jobInput || {}) as Record<string, any>;
  const phases = Array.isArray(data.phases) ? data.phases : Array.isArray(jobInput.phases) ? jobInput.phases : [];
  const completedWork = list(data.completedWork || data.completedItems);
  const remainingWork = list(data.remainingWork || data.remainingItems || phases.filter((phase: any) => !completedWork.includes(text(phase?.label || phase?.id))).map((phase: any) => phase?.label || phase?.id));
  const currentAction = text(data.currentAction || input.message || data.message, "Working on the accepted task.");
  const nextAction = text(data.nextAction, remainingWork[0] || "Continue the accepted work plan.");
  const evidenceLevel = text(data.evidenceLevel, "runtime_observed");
  const verificationState = text(data.verificationState, "in_progress");
  const evidenceSummary = text(data.evidenceSummary || data.finding || data.decision || input.message, currentAction);

  return {
    goal: text(data.goal || jobInput.goal, "Complete the accepted Streams task."),
    completedWork,
    currentAction,
    evidence: {
      level: evidenceLevel,
      summary: evidenceSummary,
      verificationState,
    },
    nextAction,
    remainingWork,
    planVersion: Number(data.planVersion || jobInput.planVersion || 1),
  };
}

export function progressUpdateMessage(update: StructuredProgressUpdate) {
  const completed = update.completedWork.length ? `Completed: ${update.completedWork.join("; ")}. ` : "";
  return `${completed}Now: ${update.currentAction} Evidence: ${update.evidence.summary} Next: ${update.nextAction}`;
}
