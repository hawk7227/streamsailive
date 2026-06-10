import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import type { StreamsBuilderTruthState } from "./types";

export type StreamsBuilderApprovalState = "ready" | "blocked" | "changes_requested" | "approved" | "unproven";

export interface StreamsBuilderProjectView {
  projectId: string;
  name: string;
  repo: string | null;
  branch: string | null;
  activeRoute: string | null;
  activePreviewUrl: string | null;
  component: string | null;
  file: string | null;
  githubPath: string | null;
  jobId: string | null;
  checkpointId: string | null;
  proofState: StreamsBuilderTruthState;
  approvalState: StreamsBuilderApprovalState;
  latestJobState: string | null;
  unreadNotificationCount: number;
  updatedAt: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function truth(value: unknown): StreamsBuilderTruthState {
  const normalized = text(value);
  if (["PROVEN", "FAILED", "UNPROVEN", "UNKNOWN", "WAITING_FOR_USER"].includes(normalized || "")) {
    return normalized as StreamsBuilderTruthState;
  }
  return "UNPROVEN";
}

function approvalFromState(value: unknown): StreamsBuilderApprovalState {
  const normalized = text(value);
  if (["ready", "blocked", "changes_requested", "approved", "unproven"].includes(normalized || "")) {
    return normalized as StreamsBuilderApprovalState;
  }
  if (normalized === "PROVEN") return "ready";
  if (normalized === "FAILED") return "blocked";
  return "unproven";
}

function projectFromJob(row: Record<string, unknown>): StreamsBuilderProjectView {
  const input = asRecord(row.input_json);
  const plan = asRecord(input.plan);
  const sourceTruth = asRecord(input.sourceTruth);
  const gate = asRecord(input.gate);
  const result = asRecord(input.result);
  const projectId = text(input.projectId) || text(row.project_id) || "project-pending";
  const truthState = truth(result.truthState || gate.truthState || sourceTruth.truthState || plan.truthState);
  const approvalState = approvalFromState(result.reviewState || gate.reviewState || truthState);

  return {
    projectId,
    name: text(input.projectName) || text(input.name) || projectId,
    repo: text(input.repoFullName) || text(plan.repoFullName) || text(input.repo) || null,
    branch: text(input.branchName) || text(plan.branchName) || text(input.branch) || null,
    activeRoute: text(input.route) || text(sourceTruth.route) || null,
    activePreviewUrl: text(input.previewUrl) || text(input.targetUrl) || text(sourceTruth.previewUrl) || null,
    component: text(input.component) || text(sourceTruth.component) || null,
    file: text(input.file) || text(sourceTruth.file) || null,
    githubPath: text(input.githubPath) || text(sourceTruth.githubPath) || null,
    jobId: text(row.id) || null,
    checkpointId: text(input.checkpointId) || text(sourceTruth.checkpoint) || null,
    proofState: truthState,
    approvalState,
    latestJobState: text(row.status) || null,
    unreadNotificationCount: 0,
    updatedAt: text(row.updated_at) || text(row.created_at) || new Date().toISOString(),
  };
}

export function deriveStreamsBuilderProjects(rows: Array<Record<string, unknown>>): StreamsBuilderProjectView[] {
  const byProject = new Map<string, StreamsBuilderProjectView>();
  for (const row of rows) {
    const project = projectFromJob(row);
    const current = byProject.get(project.projectId);
    if (!current || project.updatedAt >= current.updatedAt) byProject.set(project.projectId, project);
  }
  return [...byProject.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listStreamsBuilderProjects(scope: StreamsAIScope) {
  const jobs = new StreamsAIJobsRepository();
  const rows = await jobs.list(scope, {});
  const relevant = (rows as Array<Record<string, unknown>>).filter((row) => {
    const input = asRecord(row.input_json);
    return Boolean(
      text(input.projectId) ||
      text(row.project_id) ||
      text(input.repoFullName) ||
      text(input.previewUrl) ||
      text(input.source) === "streams_builder_gate" ||
      text(input.source) === "streams_builder_activity"
    );
  });
  return deriveStreamsBuilderProjects(relevant);
}
