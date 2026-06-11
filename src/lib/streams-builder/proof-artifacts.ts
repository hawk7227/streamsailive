import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import type { StreamsBuilderTruthState } from "./types";

export type StreamsBuilderProofArtifactType = "screenshot" | "html_snapshot" | "console_log" | "network_log" | "proof_json";

export interface StreamsBuilderProofArtifact {
  id: string;
  projectId: string;
  sessionId: string;
  jobId: string | null;
  type: StreamsBuilderProofArtifactType;
  title: string;
  mimeType: string;
  storage: "job_event" | "inline_metadata" | "pending_storage";
  sizeBytes: number;
  preview: string | null;
  dataUrl: string | null;
  createdAt: string;
  truthState: StreamsBuilderTruthState;
}

export interface BrowserVerificationArtifactInput {
  projectId: string;
  sessionId: string;
  jobId?: string | null;
  targetUrl: string;
  finalUrl?: string | null;
  screenshotDataUrl?: string | null;
  htmlSnapshot?: string | null;
  consoleMessages?: string[];
  networkFailures?: string[];
  proof?: string[];
  unproven?: string[];
  errors?: string[];
  truthState: StreamsBuilderTruthState;
}

function byteSize(value: string | null | undefined) {
  return value ? new TextEncoder().encode(value).length : 0;
}

function clip(value: string | null | undefined, length = 500) {
  if (!value) return null;
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

function artifact(input: BrowserVerificationArtifactInput, type: StreamsBuilderProofArtifactType, title: string, mimeType: string, value: string | null | undefined): StreamsBuilderProofArtifact {
  return {
    id: `${input.projectId}:${input.jobId || "job-pending"}:${type}`,
    projectId: input.projectId,
    sessionId: input.sessionId,
    jobId: input.jobId || null,
    type,
    title,
    mimeType,
    storage: value ? "job_event" : "pending_storage",
    sizeBytes: byteSize(value),
    preview: type === "screenshot" ? null : clip(value),
    dataUrl: type === "screenshot" ? value || null : null,
    createdAt: new Date().toISOString(),
    truthState: value ? input.truthState : "UNPROVEN",
  };
}

export function createBrowserVerificationArtifacts(input: BrowserVerificationArtifactInput): StreamsBuilderProofArtifact[] {
  const proofJson = JSON.stringify({
    projectId: input.projectId,
    sessionId: input.sessionId,
    jobId: input.jobId || null,
    targetUrl: input.targetUrl,
    finalUrl: input.finalUrl || null,
    truthState: input.truthState,
    proof: input.proof || [],
    unproven: input.unproven || [],
    errors: input.errors || [],
    consoleMessages: input.consoleMessages || [],
    networkFailures: input.networkFailures || [],
  }, null, 2);

  return [
    artifact(input, "screenshot", "Browser screenshot", "image/png", input.screenshotDataUrl),
    artifact(input, "html_snapshot", "HTML snapshot", "text/html", input.htmlSnapshot),
    artifact(input, "console_log", "Console warnings/errors", "application/json", JSON.stringify(input.consoleMessages || [], null, 2)),
    artifact(input, "network_log", "Network failures", "application/json", JSON.stringify(input.networkFailures || [], null, 2)),
    artifact(input, "proof_json", "Browser proof JSON", "application/json", proofJson),
  ];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function truth(value: unknown): StreamsBuilderTruthState {
  const normalized = text(value);
  if (["PROVEN", "FAILED", "UNPROVEN", "UNKNOWN", "WAITING_FOR_USER"].includes(normalized || "")) return normalized as StreamsBuilderTruthState;
  return "UNPROVEN";
}

export function deriveProofArtifactsFromEvents(events: Array<Record<string, unknown>>, projectId?: string | null): StreamsBuilderProofArtifact[] {
  const artifacts: StreamsBuilderProofArtifact[] = [];
  for (const event of events) {
    const data = asRecord(event.data);
    const rawArtifacts = Array.isArray(data.artifacts) ? data.artifacts : [];
    for (const raw of rawArtifacts) {
      const item = asRecord(raw);
      const artifactProjectId = text(item.projectId) || text(data.projectId) || projectId || "project-pending";
      if (projectId && artifactProjectId !== projectId) continue;
      artifacts.push({
        id: text(item.id) || `${artifactProjectId}:${text(event.job_id) || "job"}:${text(item.type) || "artifact"}`,
        projectId: artifactProjectId,
        sessionId: text(item.sessionId) || text(data.sessionId) || "builder-session-pending",
        jobId: text(item.jobId) || text(event.job_id) || null,
        type: (text(item.type) || "proof_json") as StreamsBuilderProofArtifactType,
        title: text(item.title) || "Proof artifact",
        mimeType: text(item.mimeType) || "application/json",
        storage: (text(item.storage) || "job_event") as StreamsBuilderProofArtifact["storage"],
        sizeBytes: typeof item.sizeBytes === "number" ? item.sizeBytes : 0,
        preview: text(item.preview),
        dataUrl: text(item.dataUrl),
        createdAt: text(item.createdAt) || text(event.created_at) || new Date().toISOString(),
        truthState: truth(item.truthState || data.truthState),
      });
    }
  }
  return artifacts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listStreamsBuilderProofArtifacts(scope: StreamsAIScope, input: { projectId?: string | null; sessionId?: string | null; jobId?: string | null }) {
  if (!input.projectId?.trim() && !input.jobId?.trim()) return [];
  const jobs = new StreamsAIJobsRepository();
  const rows = await jobs.list(scope, { sessionId: input.sessionId ?? null });
  const artifacts: StreamsBuilderProofArtifact[] = [];
  for (const row of rows as Array<Record<string, unknown>>) {
    const rowProjectId = text(row.project_id) || input.projectId || null;
    if (input.projectId && rowProjectId !== input.projectId) continue;
    if (input.jobId && String(row.id) !== input.jobId) continue;
    const events = await jobs.events(scope, String(row.id));
    artifacts.push(...deriveProofArtifactsFromEvents(events as Array<Record<string, unknown>>, input.projectId));
  }
  return artifacts;
}
