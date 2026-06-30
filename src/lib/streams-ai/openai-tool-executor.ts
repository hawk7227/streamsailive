import { getUniversalCapabilityRegistry, summarizeUniversalCapabilities } from "@/lib/streams-ai/universal-capability-registry";
import { createUniversalAssistantPlan } from "@/lib/streams-ai/universal-orchestrator";
import { readUniversalRuntimeEvents, recordUniversalRuntimeEvent, summarizeRuntimeEvents } from "@/lib/streams-ai/runtime-events";
import { resolveAndRecordUniversalActionTarget } from "@/lib/streams-ai/action-resolver";
import { isApprovedOpenAIToolName, type ApprovedOpenAIToolName } from "@/lib/streams-ai/openai-tool-definitions";

type RepositoryListProvider = {
  list: (scope: any, args?: any) => Promise<any[]>;
};

export type ToolExecutorDeps = {
  sessionId: string;
  jobs?: RepositoryListProvider;
  assets?: RepositoryListProvider;
  providerRuns?: RepositoryListProvider;
  scope?: any;
};

function limit(value: unknown, fallback = 12) {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(1, Math.min(50, n));
}

export async function executeApprovedOpenAITool(name: string, args: Record<string, unknown>, deps: ToolExecutorDeps) {
  if (!isApprovedOpenAIToolName(name)) {
    return { ok: false, status: "blocked", error: `Tool is not approved: ${name}` };
  }
  const toolName = name as ApprovedOpenAIToolName;
  const sessionId = String(args.sessionId || deps.sessionId || "agent-1");

  await recordUniversalRuntimeEvent({ sessionId, phase: "tool.started", source: "openai-tool-executor", severity: "info", message: `Tool started: ${toolName}`, toolName, toolStatus: "started" });

  try {
    let result: Record<string, unknown>;
    if (toolName === "capabilities_list") {
      result = { capabilities: getUniversalCapabilityRegistry(), summary: summarizeUniversalCapabilities() };
    } else if (toolName === "runtime_events_read") {
      const events = await readUniversalRuntimeEvents(sessionId);
      result = { events, summary: summarizeRuntimeEvents(events as Record<string, unknown>[]) };
    } else if (toolName === "orchestrator_plan") {
      const events = await readUniversalRuntimeEvents(sessionId);
      const summary = summarizeRuntimeEvents(events as Record<string, unknown>[]);
      result = { plan: createUniversalAssistantPlan({ sessionId, userMessage: String(args.userMessage || ""), runtimeSummary: summary }) };
    } else if (toolName === "jobs_list") {
      const rows = deps.jobs && deps.scope ? await deps.jobs.list(deps.scope, { sessionId }) : [];
      result = { count: rows.length, jobs: rows.slice(0, limit(args.limit)) };
    } else if (toolName === "assets_list") {
      const rows = deps.assets && deps.scope ? await deps.assets.list(deps.scope, { sessionId }) : [];
      result = { count: rows.length, assets: rows.slice(0, limit(args.limit)) };
    } else if (toolName === "provider_runs_lookup") {
      const rows = deps.providerRuns && deps.scope ? await deps.providerRuns.list(deps.scope, { jobId: args.jobId }) : [];
      result = { count: rows.length, providerRuns: rows.slice(0, limit(args.limit)), interpretation: rows.length ? "provider_runs rows exist; inspect status/outputAssetId for proof." : "No provider_runs rows found for the supplied context." };
    } else {
      result = { result: await resolveAndRecordUniversalActionTarget({ ...args, sessionId }) };
    }

    await recordUniversalRuntimeEvent({ sessionId, phase: "tool.finished", source: "openai-tool-executor", severity: "info", message: `Tool finished: ${toolName}`, toolName, toolStatus: "finished", proof: { ok: true } });
    return { ok: true, name: toolName, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "Tool failed");
    await recordUniversalRuntimeEvent({ sessionId, phase: "tool.failed", source: "openai-tool-executor", severity: "error", message: `Tool failed: ${toolName}: ${message}`, toolName, toolStatus: "failed", error: message });
    return { ok: false, name: toolName, error: message };
  }
}
