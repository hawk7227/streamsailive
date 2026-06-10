import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { listStreamsBuilderActivity, type StreamsBuilderActivityLogRecord } from "./activity-log";

export type StreamsBuilderNotificationType =
  | "project_ready_for_review"
  | "browser_verification_completed"
  | "approval_blocked"
  | "approval_approved"
  | "changes_requested"
  | "job_failed";

export type StreamsBuilderNotificationSeverity = "info" | "success" | "warning" | "error";

export interface StreamsBuilderNotification {
  id: string;
  projectId: string;
  type: StreamsBuilderNotificationType;
  title: string;
  message: string;
  severity: StreamsBuilderNotificationSeverity;
  read: boolean;
  createdAt: string;
  sourceJobId: string | null;
  sourceRoute: string | null;
  persistence: "derived_from_events" | "unproven_read_state";
}

const readState = new Map<string, boolean>();

function notificationType(record: StreamsBuilderActivityLogRecord): StreamsBuilderNotificationType | null {
  const action = record.actionType.toLowerCase();
  if (action.includes("browser") && action.includes("completed")) return "browser_verification_completed";
  if (action.includes("blocked")) return "approval_blocked";
  if (action.includes("approved")) return "approval_approved";
  if (action.includes("changes") || action.includes("request")) return "changes_requested";
  if (record.truthState === "FAILED" || action.includes("failed")) return "job_failed";
  if (record.truthState === "PROVEN" && action.includes("gate")) return "project_ready_for_review";
  return null;
}

function notificationSeverity(type: StreamsBuilderNotificationType): StreamsBuilderNotificationSeverity {
  if (type === "approval_approved" || type === "browser_verification_completed") return "success";
  if (type === "approval_blocked" || type === "job_failed") return "error";
  if (type === "changes_requested") return "warning";
  return "info";
}

function notificationTitle(type: StreamsBuilderNotificationType) {
  switch (type) {
    case "project_ready_for_review": return "Project ready for review";
    case "browser_verification_completed": return "Browser verification completed";
    case "approval_blocked": return "Approval blocked";
    case "approval_approved": return "Approval approved";
    case "changes_requested": return "Changes requested";
    case "job_failed": return "Job failed";
  }
}

export function deriveStreamsBuilderNotifications(records: StreamsBuilderActivityLogRecord[]): StreamsBuilderNotification[] {
  return records.flatMap((record) => {
    const type = notificationType(record);
    if (!type) return [];
    const id = `${record.projectId}:${record.sourceJobId || record.id}:${type}`;
    return [{
      id,
      projectId: record.projectId,
      type,
      title: notificationTitle(type),
      message: record.message,
      severity: notificationSeverity(type),
      read: readState.get(id) ?? false,
      createdAt: record.createdAt,
      sourceJobId: record.sourceJobId,
      sourceRoute: null,
      persistence: readState.has(id) ? "unproven_read_state" : "derived_from_events",
    } satisfies StreamsBuilderNotification];
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listStreamsBuilderNotifications(scope: StreamsAIScope, input: { projectId?: string | null; sessionId?: string | null }) {
  if (!input.projectId?.trim()) return [];
  const records = await listStreamsBuilderActivity(scope, input);
  return deriveStreamsBuilderNotifications(records);
}

export function setStreamsBuilderNotificationRead(input: { notificationId: string; read: boolean }) {
  readState.set(input.notificationId, input.read);
  return {
    notificationId: input.notificationId,
    read: input.read,
    persistence: "unproven_read_state" as const,
    truthState: "UNPROVEN" as const,
  };
}
