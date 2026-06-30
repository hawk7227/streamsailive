import { createStreamsBuilderPlan, getStreamsBuilderToolRegistry, traceStreamsBuilderPlan, type StreamsBuilderOrchestratorInput } from "@/lib/streams-builder/orchestrator-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const modeProbe: StreamsBuilderOrchestratorInput = {
    sessionId: url.searchParams.get("sessionId") || "agent-1",
    userPrompt: url.searchParams.get("prompt") || "",
    requestedAction: url.searchParams.get("action") || "",
    repo: url.searchParams.get("repo") || "",
    branch: url.searchParams.get("branch") || "",
    route: url.searchParams.get("route") || "",
    filePath: url.searchParams.get("filePath") || "",
  };

  const plan = createStreamsBuilderPlan(modeProbe);
  return Response.json({
    ok: true,
    message: "Streams builder unified orchestrator is available.",
    oneBrainRule: plan.oneBrainRule,
    registry: getStreamsBuilderToolRegistry(),
    plan,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const input: StreamsBuilderOrchestratorInput = {
    sessionId: String(body.sessionId || "agent-1"),
    userPrompt: String(body.userPrompt || body.prompt || ""),
    requestedAction: String(body.requestedAction || body.action || ""),
    repo: String(body.repo || body.repository || body.repoFullName || ""),
    branch: String(body.branch || body.branchName || ""),
    route: String(body.route || ""),
    filePath: String(body.filePath || body.path || ""),
    selectedLayer: body.selectedLayer && typeof body.selectedLayer === "object" ? body.selectedLayer : undefined,
    safetyAlert: body.safetyAlert && typeof body.safetyAlert === "object" ? body.safetyAlert : null,
    buildError: typeof body.buildError === "string" ? body.buildError : undefined,
    approvalGranted: body.approvalGranted === true,
  };

  const plan = body.trace === false ? createStreamsBuilderPlan(input) : await traceStreamsBuilderPlan(input);
  return Response.json({
    ok: plan.ok,
    mode: plan.mode,
    message: plan.chatIntervention.shouldIntervene ? plan.chatIntervention.message : "Streams builder orchestrator plan created.",
    plan,
  });
}
