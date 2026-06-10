import type { ReviewWorkflowRequest, ReviewWorkflowResult, ReviewTruthState } from "./review-types";

function safePath(value?: string) {
  if (!value) return true;
  return value.length > 0 && !value.startsWith("/") && !value.includes("..") && !value.includes("\\");
}

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function recordGate(label: string, state: ReviewTruthState, proof: string[], unproven: string[]) {
  if (state === "PROVEN") proof.push(`${label} is PROVEN.`);
  else unproven.push(`${label}: ${state}`);
}

export function evaluateReviewWorkflow(request: ReviewWorkflowRequest): ReviewWorkflowResult {
  const blockedReasons: string[] = [];
  const proof: string[] = [];
  const unproven: string[] = [];

  if (!request.projectId?.trim()) blockedReasons.push("projectId is required.");
  if (!request.sessionId?.trim()) blockedReasons.push("sessionId is required.");
  if (!request.previewUrl?.trim() || !safeUrl(request.previewUrl)) blockedReasons.push("A safe live preview URL is required.");
  if (!safePath(request.file)) blockedReasons.push("file path is unsafe.");
  if (!safePath(request.githubPath)) blockedReasons.push("githubPath is unsafe.");
  if ((request.decision === "comment" || request.decision === "request_changes") && !request.comment?.trim()) {
    blockedReasons.push("comment is required for this review decision.");
  }

  recordGate("Build", request.buildStatus, proof, unproven);
  recordGate("Proof", request.proofStatus, proof, unproven);
  recordGate("Browser verification", request.browserVerificationStatus, proof, unproven);
  recordGate("Workflow verification", request.workflowVerificationStatus, proof, unproven);

  if (request.route) proof.push(`Route truth present: ${request.route}`);
  else unproven.push("Route truth missing.");
  if (request.component) proof.push(`Component truth present: ${request.component}`);
  else unproven.push("Component truth missing.");
  if (request.file || request.githubPath) proof.push("Source file truth present.");
  else unproven.push("Source file truth missing.");

  if (request.decision === "approve") {
    for (const [label, state] of [
      ["Build", request.buildStatus],
      ["Proof", request.proofStatus],
      ["Browser verification", request.browserVerificationStatus],
      ["Workflow verification", request.workflowVerificationStatus],
    ] as Array<[string, ReviewTruthState]>) {
      if (state !== "PROVEN") blockedReasons.push(`${label} must be PROVEN before live review approval.`);
    }
  }

  if (blockedReasons.length > 0) {
    return { ok: false, truthState: "FAILED", reviewState: "blocked", blockedReasons, proof, unproven };
  }

  if (request.decision === "request_changes") {
    return { ok: true, truthState: "WAITING_FOR_USER", reviewState: "changes_requested", blockedReasons, proof, unproven };
  }

  if (request.decision === "comment") {
    return { ok: true, truthState: "WAITING_FOR_USER", reviewState: "commented", blockedReasons, proof, unproven };
  }

  return { ok: true, truthState: "PROVEN", reviewState: "approved", blockedReasons, proof: [...proof, "User approved the live frontend."], unproven };
}
