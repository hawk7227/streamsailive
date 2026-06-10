import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";

export type StreamsBuilderActivityTruthState = "PROVEN" | "FAILED" | "UNPROVEN" | "WAITING_FOR_USER" | "UNKNOWN";

export interface StreamsBuilderActivityLogRecord {
  id: string;
  projectId: string;
  sessionId: string | null;
  actorUserId: string;
  actionType: string;
  previousState: string | null;
  nextState: string | null;
  truthState: StreamsBuilderActivityTruthState;
  message: string;
  createdAt: string;
  sourceJobId: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function eventToActivityLog(event: Record<string, unknown>, fallbackProjectId = "project-pending"): StreamsBuilderActivityLogRecord {
  const data = asRecord(event.data);
  return {
    id: text(event.id, `${event.job_id || "job"}-${event.event_type || "event"}-${event.created_at || Date.now()}`),
    projectId: text(data.projectId, fallbackProjectId),
    sessionId: text(data.sessionId, "") || null,
    actorUserId: text(data.actorUserId, text(event.user_id, "system")),
    actionType: text(data.actionType, text(event.event_type, "unknown")),
    previousState: text(data.previousState, "") || null,
    nextState: text(data.nextState, "") || null,
    truthState: (text(data.truthState, "UNKNOWN") as StreamsBuilderActivityTruthState),
    message: text(event.message, text(data.message, "Activity recorded")),
    createdAt: text(event.created_at, new Date().toISOString()),
    sourceJobId: text(event.job_id, "") || null,
  };
}

export async function listStreamsBuilderActivity(scope: StreamsAIScope, input: { projectId?: string | null; sessionId?: string | null }) {
  if (!input.projectId?.trim()) return [];
  const jobs = new StreamsAIJobsRepository();
  const rows = await jobs.list(scope, { sessionId: input.sessionId ?? null });
  const records: StreamsBuilderActivityLogRecord[] = [];
  for (const row of rows as Array<Record<string, unknown>>) {
    if (row.project_id !== input.projectId) continue;
    const events = await jobs.events(scope, String(row.id));
    for (const event of events as Array<Record<string, unknown>>) {
      records.push(eventToActivityLog(event, input.projectId));
    }
  }
  return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createStreamsBuilderActivity(scope: StreamsAIScope, input: {
  projectId: string;
  sessionId?: string | null;
  actionType: string;
  previousState?: string | null;
  nextState?: string | null;
  truthState?: StreamsBuilderActivityTruthState;
  message: string;
}) {
  const jobs = new StreamsAIJobsRepository();
  const job = await jobs.create(scope, {
    projectId: input.projectId,
    sessionId: input.sessionId,
    kind: "preview_action",
    status: input.truthState === "FAILED" ? "failed" : "in_review",
    inputJson: { source: "streams_builder_activity", ...input },
  });
  const event = await jobs.createEvent(scope, {
    jobId: String(job.id),
    eventType: input.actionType,
    message: input.message,
    data: {
      projectId: input.projectId,
      sessionId: input.sessionId ?? null,
      actorUserId: scope.userId,
      actionType: input.actionType,
      previousState: input.previousState ?? null,
      nextState: input.nextState ?? null,
      truthState: input.truthState ?? "UNPROVEN",
    },
  });
  return { job, event, record: eventToActivityLog(event as Record<string, unknown>, input.projectId) };
}
