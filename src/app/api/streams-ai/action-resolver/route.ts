import { resolveAndRecordUniversalActionTarget } from "@/lib/streams-ai/action-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await resolveAndRecordUniversalActionTarget({
    sessionId: String(body.sessionId || "agent-1"),
    projectId: body.projectId ? String(body.projectId) : undefined,
    workspaceId: body.workspaceId ? String(body.workspaceId) : undefined,
    mode: body.mode ? String(body.mode) : undefined,
    capabilityId: body.capabilityId ? String(body.capabilityId) : undefined,
    attemptedAction: body.attemptedAction || body.action ? String(body.attemptedAction || body.action) : undefined,
    currentContext: body.currentContext && typeof body.currentContext === "object" ? body.currentContext : undefined,
    selectedLayer: body.selectedLayer && typeof body.selectedLayer === "object" ? body.selectedLayer : undefined,
    selectedFile: body.selectedFile && typeof body.selectedFile === "object" ? body.selectedFile : undefined,
    selectedAsset: body.selectedAsset && typeof body.selectedAsset === "object" ? body.selectedAsset : undefined,
    selectedJob: body.selectedJob && typeof body.selectedJob === "object" ? body.selectedJob : undefined,
    selectedProviderRun: body.selectedProviderRun && typeof body.selectedProviderRun === "object" ? body.selectedProviderRun : undefined,
    repo: body.repo || body.repository ? String(body.repo || body.repository) : undefined,
    branch: body.branch ? String(body.branch) : undefined,
    route: body.route ? String(body.route) : undefined,
    filePath: body.filePath || body.path ? String(body.filePath || body.path) : undefined,
    sourceText: body.sourceText ? String(body.sourceText) : undefined,
    src: body.src ? String(body.src) : undefined,
    selector: body.selector ? String(body.selector) : undefined,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : undefined,
  });

  return Response.json({ ok: result.ok, result });
}
