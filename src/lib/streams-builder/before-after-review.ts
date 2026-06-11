import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import type { ReviewTruthState } from "./review-types";

export type BeforeAfterReviewStage =
  | "issue_confirmation"
  | "repair_preview"
  | "approved"
  | "changes_requested"
  | "rejected";

export type BeforeAfterApprovalDecision = "approve" | "request_changes" | "reject" | "comment";

export type BeforeAfterVisualArtifact = {
  previewUrl: string;
  screenshotUrl?: string | null;
  codePreviewUrl?: string | null;
  viewport: string;
  capturedAt: string;
  status: ReviewTruthState;
  notes: string[];
};

export type BeforeAfterSourceTruth = {
  route: string;
  previewUrl: string;
  component: string;
  file: string;
  githubPath: string;
  projectId: string;
  workspaceId: string;
  buildJobId?: string | null;
  checkpointId?: string | null;
  proofStatus: ReviewTruthState;
};

export type BeforeAfterPatchSummary = {
  changedFiles: string[];
  patchDiff?: string | null;
  visualDiffUrl?: string | null;
  summary: string;
};

export type BeforeAfterReviewRecord = {
  id: string;
  jobId?: string | null;
  projectId: string;
  sessionId: string;
  stage: BeforeAfterReviewStage;
  issueTitle: string;
  issueSummary: string;
  requestedChange: string;
  sourceTruth: BeforeAfterSourceTruth;
  before: BeforeAfterVisualArtifact;
  after?: BeforeAfterVisualArtifact | null;
  patch?: BeforeAfterPatchSummary | null;
  approval: {
    state: "waiting_for_issue_confirmation" | "waiting_for_fix_approval" | "approved" | "changes_requested" | "rejected";
    decision?: BeforeAfterApprovalDecision | null;
    comment?: string | null;
    decidedAt?: string | null;
  };
  blockers: string[];
  proof: string[];
  unproven: string[];
  createdAt: string;
  updatedAt: string;
};

export type BeforeAfterCreateInput = {
  projectId?: string | null;
  sessionId?: string | null;
  issueTitle?: string | null;
  issueSummary?: string | null;
  requestedChange?: string | null;
  route?: string | null;
  previewUrl?: string | null;
  component?: string | null;
  file?: string | null;
  githubPath?: string | null;
  workspaceId?: string | null;
  buildJobId?: string | null;
  checkpointId?: string | null;
  proofStatus?: ReviewTruthState | null;
  beforeScreenshotUrl?: string | null;
  beforeCodePreviewUrl?: string | null;
  beforeViewport?: string | null;
};

export type BeforeAfterAfterInput = {
  reviewId?: string | null;
  jobId?: string | null;
  afterPreviewUrl?: string | null;
  afterScreenshotUrl?: string | null;
  afterCodePreviewUrl?: string | null;
  afterViewport?: string | null;
  changedFiles?: string[] | null;
  patchDiff?: string | null;
  visualDiffUrl?: string | null;
  patchSummary?: string | null;
};

export type BeforeAfterDecisionInput = {
  reviewId?: string | null;
  jobId?: string | null;
  decision?: BeforeAfterApprovalDecision | null;
  comment?: string | null;
};

const jobs = new StreamsAIJobsRepository();

function nowIso() {
  return new Date().toISOString();
}

function id(prefix = "ba") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function truth(value: unknown): ReviewTruthState {
  const normalized = text(value);
  if (normalized === "PROVEN" || normalized === "FAILED" || normalized === "WAITING_FOR_USER" || normalized === "UNPROVEN") return normalized;
  return "UNPROVEN";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function validateBeforeAfterSourceTruth(sourceTruth: Partial<BeforeAfterSourceTruth>) {
  const missing: string[] = [];
  if (!text(sourceTruth.route)) missing.push("route");
  if (!text(sourceTruth.previewUrl)) missing.push("previewUrl");
  if (!text(sourceTruth.component)) missing.push("component");
  if (!text(sourceTruth.file)) missing.push("file");
  if (!text(sourceTruth.githubPath)) missing.push("githubPath");
  if (!text(sourceTruth.projectId)) missing.push("projectId");
  if (!text(sourceTruth.workspaceId)) missing.push("workspaceId");
  if (!text(sourceTruth.buildJobId)) missing.push("buildJobId");
  if (!text(sourceTruth.checkpointId)) missing.push("checkpointId");
  if (sourceTruth.proofStatus !== "PROVEN") missing.push("proofStatus");

  return {
    ok: missing.length === 0,
    missing,
    status: missing.length === 0 ? "PROVEN" as const : "UNPROVEN" as const,
  };
}

function createSourceTruth(scope: StreamsAIScope, input: BeforeAfterCreateInput): BeforeAfterSourceTruth {
  const route = text(input.route) || "/streams-builder";
  const previewUrl = text(input.previewUrl) || route;
  const file = text(input.file) || "UNPROVEN";
  return {
    route,
    previewUrl,
    component: text(input.component) || "UNPROVEN",
    file,
    githubPath: text(input.githubPath) || file,
    projectId: text(input.projectId) || scope.defaultProjectId || "project-pending",
    workspaceId: text(input.workspaceId) || "visual-editing",
    buildJobId: text(input.buildJobId),
    checkpointId: text(input.checkpointId),
    proofStatus: truth(input.proofStatus),
  };
}

function createBeforeVisual(sourceTruth: BeforeAfterSourceTruth, input: BeforeAfterCreateInput): BeforeAfterVisualArtifact {
  return {
    previewUrl: sourceTruth.previewUrl,
    screenshotUrl: text(input.beforeScreenshotUrl),
    codePreviewUrl: text(input.beforeCodePreviewUrl),
    viewport: text(input.beforeViewport) || "desktop",
    capturedAt: nowIso(),
    status: sourceTruth.previewUrl && sourceTruth.route ? "UNPROVEN" : "FAILED",
    notes: [
      "BEFORE confirmation required before repair execution.",
      "User and AI must confirm this is the same frontend issue before patching.",
    ],
  };
}

export function createBeforeAfterReviewDraft(scope: StreamsAIScope, input: BeforeAfterCreateInput): BeforeAfterReviewRecord {
  const createdAt = nowIso();
  const sourceTruth = createSourceTruth(scope, input);
  const validation = validateBeforeAfterSourceTruth(sourceTruth);
  const projectId = sourceTruth.projectId;
  const sessionId = text(input.sessionId) || `before-after-${projectId}`;
  const blockers = validation.missing.map((item) => `Missing or unproven source truth: ${item}`);

  return {
    id: id("before_after"),
    projectId,
    sessionId,
    stage: "issue_confirmation",
    issueTitle: text(input.issueTitle) || "Frontend issue confirmation",
    issueSummary: text(input.issueSummary) || "Confirm the affected frontend state before AI repairs it.",
    requestedChange: text(input.requestedChange) || "Pending requested change details.",
    sourceTruth,
    before: createBeforeVisual(sourceTruth, input),
    after: null,
    patch: null,
    approval: {
      state: "waiting_for_issue_confirmation",
      decision: null,
      comment: null,
      decidedAt: null,
    },
    blockers,
    proof: [
      "Before preview record created.",
      "Route/component/file/GitHub ownership recorded when available.",
    ],
    unproven: [
      "User has not confirmed the issue target yet.",
      "After preview has not been generated.",
      "Approval has not been granted.",
      ...blockers,
    ],
    createdAt,
    updatedAt: createdAt,
  };
}

function recordFromJob(row: Record<string, unknown>): BeforeAfterReviewRecord | null {
  const input = asRecord(row.input_json);
  const review = asRecord(input.beforeAfterReview);
  if (!Object.keys(review).length) return null;
  return {
    ...(review as unknown as BeforeAfterReviewRecord),
    jobId: text(row.id),
  };
}

export async function createBeforeAfterReview(scope: StreamsAIScope, input: BeforeAfterCreateInput) {
  const review = createBeforeAfterReviewDraft(scope, input);
  const job = await jobs.create(scope, {
    projectId: review.projectId,
    sessionId: review.sessionId,
    kind: "preview_action",
    status: "in_review",
    inputJson: {
      source: "streams_builder_before_after_review",
      beforeAfterReview: review,
    },
  });
  const withJob = { ...review, jobId: String(job.id) };
  await jobs.update(scope, String(job.id), {
    inputJson: {
      source: "streams_builder_before_after_review",
      beforeAfterReview: withJob,
    },
  });
  await jobs.createEvent(scope, {
    jobId: String(job.id),
    eventType: "before_after.before_confirmation.created",
    message: "Before visual confirmation created",
    data: { reviewId: withJob.id, stage: withJob.stage, sourceTruth: withJob.sourceTruth },
  });
  return withJob;
}

export async function listBeforeAfterReviews(scope: StreamsAIScope, projectId?: string | null) {
  const rows = await jobs.list(scope, {});
  return (rows as Array<Record<string, unknown>>)
    .map(recordFromJob)
    .filter((review): review is BeforeAfterReviewRecord => Boolean(review))
    .filter((review) => !projectId || review.projectId === projectId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

async function getReviewByIdentifier(scope: StreamsAIScope, input: { reviewId?: string | null; jobId?: string | null }) {
  if (input.jobId) {
    const row = await jobs.get(scope, input.jobId);
    if (row) {
      const review = recordFromJob(row as Record<string, unknown>);
      if (review) return review;
    }
  }
  const reviews = await listBeforeAfterReviews(scope);
  return reviews.find((review) => review.id === input.reviewId || review.jobId === input.jobId) || null;
}

async function persistReview(scope: StreamsAIScope, review: BeforeAfterReviewRecord) {
  if (!review.jobId) throw new Error("Before/After review is missing its job id.");
  await jobs.update(scope, review.jobId, {
    status: review.approval.state === "approved" ? "completed" : review.approval.state === "rejected" ? "failed" : "in_review",
    inputJson: {
      source: "streams_builder_before_after_review",
      beforeAfterReview: review,
    },
    metadata: {
      truthState: review.approval.state === "approved" ? "PROVEN" : "UNPROVEN",
      stage: review.stage,
    },
  });
  return review;
}

export async function attachAfterPreview(scope: StreamsAIScope, input: BeforeAfterAfterInput) {
  const existing = await getReviewByIdentifier(scope, input);
  if (!existing) throw new Error("Before/After review was not found.");
  const updatedAt = nowIso();
  const afterPreviewUrl = text(input.afterPreviewUrl) || existing.sourceTruth.previewUrl;
  const changedFiles = stringArray(input.changedFiles);
  const patchSummary = text(input.patchSummary) || "Patch prepared for user approval.";
  const review: BeforeAfterReviewRecord = {
    ...existing,
    stage: "repair_preview",
    after: {
      previewUrl: afterPreviewUrl,
      screenshotUrl: text(input.afterScreenshotUrl),
      codePreviewUrl: text(input.afterCodePreviewUrl),
      viewport: text(input.afterViewport) || existing.before.viewport,
      capturedAt: updatedAt,
      status: afterPreviewUrl ? "UNPROVEN" : "FAILED",
      notes: [
        "AFTER preview generated for user approval.",
        "Push, merge, and deploy remain blocked until the user approves this repaired preview.",
      ],
    },
    patch: {
      changedFiles,
      patchDiff: text(input.patchDiff),
      visualDiffUrl: text(input.visualDiffUrl),
      summary: patchSummary,
    },
    approval: {
      ...existing.approval,
      state: "waiting_for_fix_approval",
      decision: null,
      decidedAt: null,
    },
    proof: [...new Set([...existing.proof, "After preview attached.", "Patch summary attached."])],
    unproven: [
      "User has not approved the repaired preview yet.",
      ...(changedFiles.length ? [] : ["Changed files list missing."]),
      ...(text(input.patchDiff) ? [] : ["Patch diff missing."]),
    ],
    updatedAt,
  };
  const saved = await persistReview(scope, review);
  await jobs.createEvent(scope, {
    jobId: String(saved.jobId),
    eventType: "before_after.after_preview.attached",
    message: "After repair preview attached",
    data: { reviewId: saved.id, changedFiles, stage: saved.stage },
  });
  return saved;
}

export async function decideBeforeAfterReview(scope: StreamsAIScope, input: BeforeAfterDecisionInput) {
  const existing = await getReviewByIdentifier(scope, input);
  if (!existing) throw new Error("Before/After review was not found.");
  const decision = input.decision || "comment";
  const updatedAt = nowIso();
  const nextStage: BeforeAfterReviewStage =
    decision === "approve" ? "approved" : decision === "request_changes" ? "changes_requested" : decision === "reject" ? "rejected" : existing.stage;
  const nextApprovalState =
    decision === "approve" ? "approved" as const : decision === "request_changes" ? "changes_requested" as const : decision === "reject" ? "rejected" as const : existing.approval.state;

  const approvedWithoutAfter = decision === "approve" && !existing.after;
  const review: BeforeAfterReviewRecord = {
    ...existing,
    stage: approvedWithoutAfter ? existing.stage : nextStage,
    approval: {
      state: approvedWithoutAfter ? existing.approval.state : nextApprovalState,
      decision,
      comment: text(input.comment),
      decidedAt: updatedAt,
    },
    blockers: approvedWithoutAfter ? [...existing.blockers, "Cannot approve before an AFTER preview exists."] : existing.blockers,
    proof: decision === "approve" && !approvedWithoutAfter ? [...new Set([...existing.proof, "User approved the AFTER preview."])] : existing.proof,
    unproven: approvedWithoutAfter ? [...new Set([...existing.unproven, "Approval blocked because after preview is missing."])] : decision === "approve" ? [] : existing.unproven,
    updatedAt,
  };
  const saved = await persistReview(scope, review);
  await jobs.createEvent(scope, {
    jobId: String(saved.jobId),
    eventType: "before_after.decision.recorded",
    message: `Before/After decision recorded: ${decision}`,
    data: { reviewId: saved.id, decision, approvalState: saved.approval.state },
  });
  return saved;
}
