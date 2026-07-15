export type StreamsTaskComplexity = "simple" | "multi_step" | "long_running" | "side_effecting" | "blocked";

export type StreamsInitialPlan = {
  classification: StreamsTaskComplexity;
  requiresNarration: boolean;
  goal: string;
  phases: Array<{ id: string; label: string }>;
  preservedItems: string[];
  risksAvoided: string[];
  nextAction: string;
  clarificationState: "not_required" | "required" | "bypassed_with_safe_assumption";
  clarificationQuestion?: string;
};

type ClassifyInput = {
  message: string;
  attachments?: unknown[];
  mode?: string | null;
  metadata?: Record<string, unknown>;
};

const MULTI_STEP_SIGNALS = [
  /\b(first|then|after that|finally|step|phase|each|all of|end[- ]to[- ]end)\b/i,
  /\b(audit|inspect|compare|trace|research|verify|validate|test|debug|repair|refactor|migrate|deploy|merge)\b/i,
  /\b(file|files|repository|repo|route|component|database|schema|frontend|backend|api|worker|queue|migration)\b/i,
  /\b(build|implement|wire|mount|persist|restore|synchronize|cancel|supersede|replace)\b/i,
];

const SIDE_EFFECT_SIGNALS = /\b(create|update|edit|change|delete|remove|replace|commit|merge|deploy|send|publish|apply|write|save)\b/i;
const SIMPLE_SIGNALS = /^(?:what is|who is|define|translate|rewrite|summarize|calculate|convert|hello|hi\b)/i;

function compactGoal(message: string) {
  const clean = String(message || "").replace(/\s+/g, " ").trim();
  if (!clean) return "Complete the requested work.";
  return clean.length <= 180 ? clean : `${clean.slice(0, 177).trim()}…`;
}

function inferredPreservation(message: string) {
  const items: string[] = [];
  if (/\b(preserve|keep|do not change|don't change|unchanged|existing|reuse|extend)\b/i.test(message)) items.push("existing working behavior and user data");
  if (/\b(layout|design|ui|frontend)\b/i.test(message)) items.push("unrelated interface layout and interactions");
  if (/\b(route|api|backend|database|schema)\b/i.test(message)) items.push("existing routes, ownership boundaries, and persistence contracts");
  return [...new Set(items)];
}

function inferredRisks(message: string) {
  const risks: string[] = [];
  if (/\b(repo|repository|route|component|database|schema|api|worker)\b/i.test(message)) risks.push("duplicating or bypassing existing infrastructure");
  if (/\b(delete|remove|replace|migration|database|persist|data)\b/i.test(message)) risks.push("data loss or an irreversible partial write");
  if (/\b(deploy|production|live|merge)\b/i.test(message)) risks.push("claiming completion before deployment and runtime verification");
  return [...new Set(risks)];
}

export function classifyStreamsTask(input: ClassifyInput): StreamsInitialPlan {
  const message = String(input.message || "").trim();
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  const explicitComplex = input.metadata?.forceMultiStep === true || input.metadata?.enforceDeterministicStructure === true;
  const signalCount = MULTI_STEP_SIGNALS.reduce((count, pattern) => count + (pattern.test(message) ? 1 : 0), 0);
  const sideEffecting = SIDE_EFFECT_SIGNALS.test(message) && signalCount > 0;
  const longRunning = /\b(video|render|generation|deep research|full audit|entire repository|all 40|non[- ]?condensed)\b/i.test(message);
  const simpleCandidate = message.length < 180 && attachments.length === 0 && SIMPLE_SIGNALS.test(message) && signalCount <= 1 && !sideEffecting;
  const requiresNarration = explicitComplex || attachments.length > 1 || signalCount >= 2 || sideEffecting || longRunning || message.length > 700;
  const classification: StreamsTaskComplexity = simpleCandidate && !requiresNarration
    ? "simple"
    : sideEffecting
      ? "side_effecting"
      : longRunning
        ? "long_running"
        : requiresNarration
          ? "multi_step"
          : "simple";

  const phases: Array<{ id: string; label: string }> = [];
  if (attachments.length || /\b(inspect|audit|trace|review|file|repo|repository|existing)\b/i.test(message)) phases.push({ id: "inspect", label: "Inspect the current source and existing implementation" });
  if (/\b(research|latest|current|compare sources|web)\b/i.test(message)) phases.push({ id: "research", label: "Gather and verify the required evidence" });
  if (sideEffecting || /\b(build|implement|wire|fix|replace|add)\b/i.test(message)) phases.push({ id: "implement", label: "Apply the smallest complete connected change" });
  if (/\b(test|verify|validate|build|deploy|production|complete)\b/i.test(message) || sideEffecting) phases.push({ id: "verify", label: "Run checks and verify the requested outcome" });
  if (!phases.length && requiresNarration) phases.push({ id: "analyze", label: "Analyze the request and produce the complete result" });

  const preservedItems = inferredPreservation(message);
  const risksAvoided = inferredRisks(message);
  const nextAction = phases[0]?.label || "Answer the request directly.";

  return {
    classification,
    requiresNarration,
    goal: compactGoal(message),
    phases,
    preservedItems,
    risksAvoided,
    nextAction,
    clarificationState: "not_required",
  };
}
