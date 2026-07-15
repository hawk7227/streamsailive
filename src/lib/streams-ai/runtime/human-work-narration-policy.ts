import { sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "../protected-reasoning";

export const HUMAN_WORK_ITEMS = Object.freeze({
  6: "Update When the Plan Changes",
  7: "Explain Reuse Before New Construction",
  8: "Communicate Findings Before Implementation",
  9: "Communicate Architectural Decisions",
  10: "Autosave and Background Work Language",
  11: "Tool and File Activity Updates",
  12: "Status Labels",
  13: "Natural Language Around Status Labels",
  14: "Do Not Narrate Trivial Micro-Actions",
  15: "Update Frequency",
  16: "Human-Like Continuity",
  17: "Communicate What Is Being Preserved",
  18: "Communicate Risks Being Avoided",
  19: "Error and Blocker Communication",
  20: "Partial Completion",
  21: "Testing Narration",
  22: "Final Response Structure",
  23: "Human-Like Tone",
  24: "Do Not Use Empty Service Language",
  25: "Do Not Fake Human Emotions",
  26: "Attachment and File Work",
  27: "Research Work",
  28: "Code and Repository Work",
  29: "Design and Generation Work",
  30: "Decision Summary Standard",
  31: "Next-Step Statements",
  32: "User Interruption and Change of Direction",
  33: "Context Continuity",
  34: "User-Facing Activity Events",
  35: "Activity Event Persistence",
  36: "Collapsing Activity History",
  37: "Truthful Temporal Language",
  38: "No False Completion",
  39: "Default Work-Narration Template",
  40: "Final Governing Rule",
} as const);

export type WorkDomain = "general" | "attachment" | "research" | "repository" | "design" | "generation" | "testing";
export type EvidenceLevel = "none" | "requested" | "source_verified" | "runtime_verified" | "test_verified" | "persistence_verified" | "deployment_verified" | "user_verified";

export type HumanWorkEventInput = {
  eventType?: string;
  status?: string;
  phase?: string;
  goal?: string;
  message?: string | null;
  currentAction?: string;
  nextAction?: string;
  completedItems?: unknown[];
  remainingItems?: unknown[];
  preservedItems?: unknown[];
  risksAvoided?: unknown[];
  findings?: unknown[];
  decision?: string;
  rejectedAlternatives?: unknown[];
  evidenceLevel?: EvidenceLevel | string;
  evidenceSummary?: string;
  verificationState?: string;
  planVersion?: number;
  previousPlanVersion?: number;
  planChanged?: boolean;
  changeReason?: string;
  autosaveConfirmed?: boolean;
  backgroundExecutionConfirmed?: boolean;
  userActionRequired?: boolean;
  retryable?: boolean;
  blockedReason?: string;
  partial?: boolean;
  toolName?: string;
  fileName?: string;
  domain?: WorkDomain;
  elapsedMs?: number;
  now?: number;
  lastVisibleAt?: number;
  forceVisible?: boolean;
};

const TERMINAL = new Set(["completed", "failed", "cancelled", "blocked", "partial"]);
const MATERIAL_EVENTS = new Set([
  "operation_started", "plan_created", "plan_changed", "finding", "decision", "phase_started",
  "tool_started", "tool_completed", "file_read", "file_written", "research_started", "research_completed",
  "generation_started", "generation_completed", "verification_started", "verification_completed",
  "partial_completion", "blocked", "cancelled", "operation_failed", "operation_completed",
  "superseded", "context_restored",
]);
const TRIVIAL_PATTERNS = [
  /^(opening|reading|checking) (a |the )?(single )?(line|property|variable|button)$/i,
  /^(clicked|clicking|scrolling|typing|formatting|loading)$/i,
  /^(working|processing|thinking)\.{0,3}$/i,
  /^(step|task) \d+$/i,
];
const EMPTY_SERVICE_PATTERNS = [
  /\brest assured\b[,:;.!-]?/gi,
  /\bhappy to help\b[,:;.!-]?/gi,
  /\bsit tight\b[,:;.!-]?/gi,
  /\bthanks for your patience\b[,:;.!-]?/gi,
  /\bi(?:'|’)?m excited\b(?:\s+and)?/gi,
  /\bi feel\b/gi,
  /\bi love\b/gi,
  /\bdon(?:'|’)?t worry\b[,:;.!-]?/gi,
];
const FALSE_TEMPORAL_PATTERNS = [
  /\bi(?:'|’)?m working in the background\b/gi,
  /\bi(?:'|’)?ll keep working after(?:\s+you leave)?\b[.!]?/gi,
  /\bi(?:'|’)?ll notify you later\b[.!]?/gi,
  /\bthis will only take a (moment|minute)\b[.!]?/gi,
];
const COMPLETION_WORDS = /\b(complete|completed|done|finished|fully built|deployed|verified)\b/i;

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => sanitizeStreamsAIText(typeof item === "string" ? item : (item as any)?.label || (item as any)?.name || (item as any)?.id || "", 600).trim()).filter(Boolean)
    : [];
}

export function detectWorkDomain(input: { message?: string; attachments?: unknown[]; phase?: string; mode?: string } = {}): WorkDomain {
  const text = `${input.message || ""} ${input.phase || ""} ${input.mode || ""}`.toLowerCase();
  if (Array.isArray(input.attachments) && input.attachments.length) return "attachment";
  if (/research|search|source|citation|web|latest/.test(text)) return "research";
  if (/repo|repository|code|file|branch|commit|pull request|api|database|frontend|backend/.test(text)) return "repository";
  if (/design|layout|ui|ux|color|mobile|responsive/.test(text)) return "design";
  if (/generate|render|image|video|audio|voice|animation/.test(text)) return "generation";
  if (/test|verify|build|typecheck|lint|ci|deployment/.test(text)) return "testing";
  return "general";
}

export function statusLabelFor(input: HumanWorkEventInput): string {
  const type = String(input.eventType || "").toLowerCase();
  const phase = String(input.phase || "").toLowerCase();
  const status = String(input.status || "").toLowerCase();
  if (type.includes("plan_changed")) return "Plan updated";
  if (type.includes("finding")) return "Finding";
  if (type.includes("decision")) return "Decision";
  if (type.includes("research")) return type.includes("completed") ? "Research complete" : "Researching";
  if (type.includes("file_written")) return "File updated";
  if (type.includes("file_read")) return "Inspecting file";
  if (type.includes("tool")) return type.includes("completed") ? "Tool complete" : "Using tool";
  if (type.includes("verification") || phase.includes("verif")) return type.includes("completed") ? "Verified" : "Verifying";
  if (type.includes("partial") || status === "partial") return "Partially complete";
  if (type.includes("blocked") || status === "blocked") return "Blocked";
  if (type.includes("failed") || status === "failed") return "Failed";
  if (type.includes("cancel") || status === "cancelled") return "Stopped";
  if (type.includes("complete") || status === "completed") return "Complete";
  if (phase.includes("implement") || phase.includes("generat") || phase.includes("render")) return "Building";
  if (phase.includes("inspect") || phase.includes("understand") || phase.includes("analy")) return "Inspecting";
  return "Working";
}

export function sanitizeHumanWorkLanguage(value: unknown, limit = 2400): string {
  let text = sanitizeStreamsAIText(value, limit).trim();
  for (const pattern of EMPTY_SERVICE_PATTERNS) text = text.replace(pattern, " ");
  for (const pattern of FALSE_TEMPORAL_PATTERNS) text = text.replace(pattern, " ");
  text = text
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/^[\s,;:.!?-]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return text;
}

export function shouldExposeWorkEvent(input: HumanWorkEventInput): boolean {
  if (input.forceVisible) return true;
  const type = String(input.eventType || "");
  if (MATERIAL_EVENTS.has(type)) return true;
  const message = sanitizeHumanWorkLanguage(input.message || input.currentAction || "", 600);
  if (!message || TRIVIAL_PATTERNS.some((pattern) => pattern.test(message))) return false;
  const now = Number(input.now || Date.now());
  const last = Number(input.lastVisibleAt || 0);
  if (last && now - last < 2500 && !TERMINAL.has(String(input.status || ""))) return false;
  return true;
}

export function validateCompletionEvidence(input: HumanWorkEventInput): { ok: boolean; reason: string } {
  const status = String(input.status || "");
  const type = String(input.eventType || "");
  const completionRequested = status === "completed" || type === "operation_completed" || COMPLETION_WORDS.test(String(input.message || ""));
  if (!completionRequested) return { ok: true, reason: "not_terminal_completion" };
  const evidenceLevel = String(input.evidenceLevel || "none");
  const verificationState = String(input.verificationState || "not_started");
  const remaining = list(input.remainingItems);
  if (remaining.length) return { ok: false, reason: "remaining_work_exists" };
  if (["none", "requested"].includes(evidenceLevel)) return { ok: false, reason: "completion_lacks_evidence" };
  if (!["passed", "complete", "completed", "verified"].includes(verificationState)) return { ok: false, reason: "completion_not_verified" };
  return { ok: true, reason: "completion_verified" };
}

export function buildHumanWorkEvent(input: HumanWorkEventInput = {}) {
  const eventType = sanitizeHumanWorkLanguage(input.eventType || "activity", 120) || "activity";
  const status = sanitizeHumanWorkLanguage(input.status || "running", 80) || "running";
  const phase = sanitizeHumanWorkLanguage(input.phase || "working", 120) || "working";
  const goal = sanitizeHumanWorkLanguage(input.goal || "Complete the requested work.", 1000);
  const currentAction = sanitizeHumanWorkLanguage(input.currentAction || input.message || "Continue the accepted work plan.", 1200);
  const nextAction = sanitizeHumanWorkLanguage(input.nextAction || (TERMINAL.has(status) ? "No additional action is scheduled." : "Continue with the next verified phase."), 1200);
  const findings = list(input.findings);
  const completedItems = list(input.completedItems);
  const remainingItems = list(input.remainingItems);
  const preservedItems = list(input.preservedItems);
  const risksAvoided = list(input.risksAvoided);
  const rejectedAlternatives = list(input.rejectedAlternatives);
  const evidenceLevel = sanitizeHumanWorkLanguage(input.evidenceLevel || "none", 80) || "none";
  const evidenceSummary = sanitizeHumanWorkLanguage(input.evidenceSummary || findings[0] || "No new evidence has been recorded for this update.", 1600);
  const verificationState = sanitizeHumanWorkLanguage(input.verificationState || "not_started", 80) || "not_started";
  const planVersion = Math.max(1, Number(input.planVersion || 1));
  const previousPlanVersion = Math.max(0, Number(input.previousPlanVersion || 0));
  const domain = input.domain || detectWorkDomain({ message: `${goal} ${currentAction}`, phase });
  const completion = validateCompletionEvidence({ ...input, eventType, status, remainingItems, evidenceLevel, verificationState });
  const visible = shouldExposeWorkEvent({ ...input, eventType, status, message: currentAction });

  return sanitizeStreamsAIPayload({
    humanWorkPolicyVersion: 1,
    coveredItems: Object.keys(HUMAN_WORK_ITEMS).map(Number),
    eventType,
    status,
    phase,
    statusLabel: statusLabelFor({ eventType, status, phase }),
    goal,
    completedItems,
    currentAction,
    evidence: { level: evidenceLevel, summary: evidenceSummary, verificationState },
    evidenceLevel,
    evidenceSummary,
    verificationState,
    nextAction,
    remainingItems,
    preservedItems,
    risksAvoided,
    findings,
    decision: sanitizeHumanWorkLanguage(input.decision || "", 1400),
    rejectedAlternatives,
    planChanged: Boolean(input.planChanged || eventType === "plan_changed"),
    changeReason: sanitizeHumanWorkLanguage(input.changeReason || "", 1200),
    planVersion,
    previousPlanVersion,
    autosaveConfirmed: Boolean(input.autosaveConfirmed),
    backgroundExecutionConfirmed: Boolean(input.backgroundExecutionConfirmed),
    userActionRequired: Boolean(input.userActionRequired),
    retryable: Boolean(input.retryable),
    blockedReason: sanitizeHumanWorkLanguage(input.blockedReason || "", 1200),
    partial: Boolean(input.partial || status === "partial"),
    toolName: sanitizeHumanWorkLanguage(input.toolName || "", 300),
    fileName: sanitizeHumanWorkLanguage(input.fileName || "", 600),
    domain,
    visible,
    completionGate: completion,
    elapsedMs: Number.isFinite(Number(input.elapsedMs)) ? Math.max(0, Number(input.elapsedMs)) : null,
  });
}

export function humanWorkNarration(input: HumanWorkEventInput = {}): string {
  const event = buildHumanWorkEvent(input) as any;
  const lines: string[] = [];
  if (event.planChanged) lines.push(`Plan updated: ${event.changeReason || event.currentAction}`);
  if (event.findings?.length) lines.push(`Found: ${event.findings.join(" · ")}`);
  if (event.decision) lines.push(`Decision: ${event.decision}`);
  if (event.preservedItems?.length) lines.push(`Preserving: ${event.preservedItems.join(" · ")}`);
  if (event.risksAvoided?.length) lines.push(`Avoiding: ${event.risksAvoided.join(" · ")}`);
  if (event.completedItems?.length) lines.push(`Completed: ${event.completedItems.join(" · ")}`);
  lines.push(`Now: ${event.currentAction}`);
  lines.push(`Evidence: ${event.evidence.summary}`);
  lines.push(`Next: ${event.nextAction}`);
  return sanitizeHumanWorkLanguage(lines.join("\n"), 4000);
}

export function buildFinalWorkReceipt(input: HumanWorkEventInput = {}) {
  const event = buildHumanWorkEvent({ ...input, eventType: input.eventType || "operation_completed" });
  const completion = validateCompletionEvidence({ ...input, ...(event as any) });
  return sanitizeStreamsAIPayload({
    completed: completion.ok,
    status: completion.ok ? "completed" : input.partial ? "partial" : "blocked",
    goal: (event as any).goal,
    completedItems: (event as any).completedItems,
    remainingItems: (event as any).remainingItems,
    preservedItems: (event as any).preservedItems,
    risksAvoided: (event as any).risksAvoided,
    decision: (event as any).decision,
    evidence: (event as any).evidence,
    nextAction: (event as any).nextAction,
    completionGate: completion,
    planVersion: (event as any).planVersion,
  });
}
