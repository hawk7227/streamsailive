import { readBuilderSystemEvents, recordBuilderSystemEvent, type BuilderSystemEvent } from "@/lib/streams-builder/system-events";

const SECRET_KEY = /api[_-]?key|secret|token|password|authorization|bearer|credential/i;

export type UniversalRuntimeEvent = BuilderSystemEvent & {
  mode?: string;
  capabilityId?: string;
  toolName?: string;
  toolStatus?: string;
  action?: string;
  attemptedAction?: string;
  riskLevel?: string;
  approvalRequired?: boolean;
  approvalStatus?: string;
  projectId?: string;
  workspaceId?: string;
  moduleId?: string;
  sourceFile?: string;
  startLine?: number;
  endLine?: number;
  selectedLayer?: Record<string, unknown> | null;
  selectedLayerId?: string;
  selectedLayerType?: string;
  parentLayerId?: string;
  childLayerCount?: number;
  recommendations?: string[];
  jobId?: string;
  assetId?: string;
  providerRunId?: string;
  provider?: string;
  model?: string;
  generationType?: string;
  buildId?: string;
  commitSha?: string;
  deploymentId?: string;
  deploymentStatus?: string;
  proof?: Record<string, unknown> | string;
};

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 60).map(sanitize);
  if (!value || typeof value !== "object") return typeof value === "string" ? value.slice(0, 12000) : value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) continue;
    output[key] = sanitize(item);
  }
  return output;
}

function severityOf(value: unknown): "info" | "warning" | "error" {
  if (value === "error") return "error";
  if (value === "warning" || value === "blocked" || value === "approval-required") return "warning";
  return "info";
}

export async function recordUniversalRuntimeEvent(input: UniversalRuntimeEvent) {
  const metadata = sanitize({
    ...(input.metadata || {}),
    mode: input.mode,
    capabilityId: input.capabilityId,
    toolName: input.toolName,
    toolStatus: input.toolStatus,
    action: input.action,
    attemptedAction: input.attemptedAction,
    riskLevel: input.riskLevel,
    approvalRequired: input.approvalRequired,
    approvalStatus: input.approvalStatus,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    moduleId: input.moduleId,
    sourceFile: input.sourceFile,
    startLine: input.startLine,
    endLine: input.endLine,
    selectedLayer: input.selectedLayer,
    selectedLayerId: input.selectedLayerId,
    selectedLayerType: input.selectedLayerType,
    parentLayerId: input.parentLayerId,
    childLayerCount: input.childLayerCount,
    recommendations: input.recommendations || [],
    jobId: input.jobId,
    assetId: input.assetId,
    providerRunId: input.providerRunId,
    provider: input.provider,
    model: input.model,
    generationType: input.generationType,
    buildId: input.buildId,
    commitSha: input.commitSha,
    deploymentId: input.deploymentId,
    deploymentStatus: input.deploymentStatus,
    proof: input.proof,
  }) as Record<string, unknown>;

  return recordBuilderSystemEvent({
    sessionId: input.sessionId || "agent-1",
    phase: input.phase || "runtime.event",
    message: input.message || input.error || "Runtime event",
    source: input.source || "streams-runtime",
    severity: severityOf(input.severity || input.riskLevel),
    repo: input.repo,
    branch: input.branch,
    filePath: input.filePath || input.sourceFile,
    route: input.route,
    status: input.status || input.toolStatus || input.deploymentStatus || input.riskLevel,
    previewId: input.previewId,
    previewUrl: input.previewUrl,
    error: input.error,
    logs: input.logs,
    metadata,
  });
}

export async function readUniversalRuntimeEvents(sessionId = "agent-1") {
  return readBuilderSystemEvents(sessionId);
}

export function summarizeRuntimeEvents(events: Record<string, unknown>[], maxEvents = 30) {
  const tail = events.slice(-maxEvents);
  const latest = tail[tail.length - 1] || null;
  const latestSafety = [...tail].reverse().find((event) => /safety|blocked|intervention/i.test(String(event.phase || event.message || event.status || ""))) || null;
  const latestBuildRepair = [...tail].reverse().find((event) => /build|repair|repository|deploy|vercel/i.test(String(event.phase || event.message || event.status || ""))) || null;
  const latestTool = [...tail].reverse().find((event) => /tool|provider|job|asset/i.test(String(event.phase || event.message || event.status || ""))) || null;

  return {
    count: events.length,
    latest,
    latestSafety,
    latestBuildRepair,
    latestTool,
    recent: tail.map((event) => ({
      phase: event.phase,
      source: event.source,
      severity: event.severity,
      message: event.message,
      status: event.status,
      route: event.route,
      filePath: event.file_path || event.filePath,
      metadata: event.metadata,
    })),
  };
}
