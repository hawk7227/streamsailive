import { readBuilderSystemEvents, recordBuilderSystemEvent } from "@/lib/streams-builder/system-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET_KEY = /api[_-]?key|secret|token|password|authorization|bearer|credential/i;

function severityOf(value: unknown): "info" | "warning" | "error" {
  if (value === "error") return "error";
  if (value === "warning" || value === "blocked" || value === "approval-required") return "warning";
  return "info";
}

function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 80).map(clean);
  if (!value || typeof value !== "object") return typeof value === "string" ? value.slice(0, 12000) : value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) continue;
    output[key] = clean(item);
  }
  return output;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") || "agent-1";
  const events = await readBuilderSystemEvents(sessionId);
  return Response.json({ ok: true, sessionId, events });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sessionId = String(body.sessionId || "agent-1");
  const incoming = Array.isArray(body.events) ? body.events : body.event ? [body.event] : [];
  let stored = 0;
  for (const raw of incoming) {
    const item = raw || {};
    const metadata = clean({
      ...(typeof item.metadata === "object" && item.metadata ? item.metadata : {}),
      mode: item.mode,
      capabilityId: item.capabilityId,
      toolName: item.toolName,
      toolStatus: item.toolStatus,
      action: item.action,
      attemptedAction: item.attemptedAction,
      riskLevel: item.riskLevel,
      approvalRequired: item.approvalRequired,
      approvalStatus: item.approvalStatus,
      projectId: item.projectId,
      workspaceId: item.workspaceId,
      moduleId: item.moduleId,
      sourceFile: item.sourceFile,
      startLine: item.startLine,
      endLine: item.endLine,
      selectedLayer: item.selectedLayer || item.layer || null,
      selectedLayerId: item.selectedLayerId,
      selectedLayerType: item.selectedLayerType,
      parentLayerId: item.parentLayerId,
      childLayerCount: item.childLayerCount,
      recommendations: Array.isArray(item.recommendations) ? item.recommendations : [],
      jobId: item.jobId,
      assetId: item.assetId,
      providerRunId: item.providerRunId,
      provider: item.provider,
      model: item.model,
      generationType: item.generationType,
      buildId: item.buildId,
      commitSha: item.commitSha,
      deploymentId: item.deploymentId,
      deploymentStatus: item.deploymentStatus,
      proof: item.proof,
    }) as Record<string, unknown>;

    await recordBuilderSystemEvent({
      sessionId,
      phase: String(item.phase || item.type || "builder-event"),
      message: String(item.message || item.reason || item.error || "Builder event"),
      source: String(item.source || "streams-builder-ui"),
      severity: severityOf(item.severity || item.riskLevel),
      repo: String(item.repo || item.repository || ""),
      branch: String(item.branch || ""),
      filePath: String(item.filePath || item.path || item.sourceFile || ""),
      route: String(item.route || ""),
      status: String(item.status || item.patchState || item.mode || item.toolStatus || item.deploymentStatus || item.riskLevel || ""),
      previewId: String(item.previewId || ""),
      previewUrl: String(item.previewUrl || ""),
      error: typeof item.error === "string" ? item.error : undefined,
      logs: Array.isArray(item.logs) ? item.logs.map(String) : [],
      metadata,
    });
    stored += 1;
  }
  const events = await readBuilderSystemEvents(sessionId);
  return Response.json({ ok: true, sessionId, stored, events });
}
