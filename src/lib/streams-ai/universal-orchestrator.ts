import { getUniversalCapabilitiesForMode, summarizeUniversalCapabilities, type UniversalAssistantMode } from "@/lib/streams-ai/universal-capability-registry";
import { recordUniversalRuntimeEvent } from "@/lib/streams-ai/runtime-events";

export type UniversalOrchestratorInput = {
  sessionId?: string;
  userMessage: string;
  runtimeSummary?: Record<string, unknown> | null;
  selectedContext?: Record<string, unknown> | null;
  approvalGranted?: boolean;
};

function lower(value?: string) {
  return String(value || "").toLowerCase();
}

export function resolveUniversalAssistantMode(input: UniversalOrchestratorInput): UniversalAssistantMode {
  const text = lower(input.userMessage);
  const context = JSON.stringify(input.runtimeSummary || {}).toLowerCase();
  if (/safety|unsafe|blocked|approval required|low confidence/.test(text + context)) return "safety-intervention";
  if (/generate|create image|create video|image to video|text to video|voice|audio|song|music/.test(text)) return "generation";
  if (/failed|error|broken|repair|troubleshoot|build failed|still not/.test(text + context)) return "repair";
  if (/build|fix|update|change|remove|delete|add|wire|implement|patch/.test(text)) return "build";
  if (/visual|frontend|selected layer|replace image|delete image|parent|child|section/.test(text + context)) return "visual-edit";
  if (/file|uploaded|document|pdf|spreadsheet|attachment/.test(text)) return "file-analysis";
  if (/image|screenshot|attached picture|see attached|design/.test(text)) return "image-analysis";
  if (/code|function|component|typescript|javascript|debug|explain this code/.test(text)) return "coding-help";
  if (/summarize|summary|condense/.test(text)) return "summarization";
  if (/rewrite|reword|polish/.test(text)) return "rewriting";
  if (/write|draft|create copy|email|prompt/.test(text)) return "writing";
  if (/translate/.test(text)) return "translation";
  if (/find|look|locate|inspect|review|analyze|where|show me|what happened|status|capabilities|tools/.test(text)) return "inspect";
  if (/why|how|compare|should|plan|strategy|architecture|thoughts/.test(text)) return "reasoning";
  return "conversation";
}

export function shouldCreateOrchestratorPlan(input: UniversalOrchestratorInput) {
  const text = lower(input.userMessage);
  const summary = input.runtimeSummary || {};
  const hasRuntimeSignal = Boolean(summary.latestSafety || summary.latestBuildRepair || summary.latestTool || summary.latest);
  if (hasRuntimeSignal && /what happened|status|continue|fix|repair|build|unsafe|blocked|selected|tool|job|asset|provider/.test(text)) return true;
  return /tool|tools|capabilit|workspace|repo|file|image|screenshot|generate|build|fix|repair|status|what happened|visual|selected|unsafe|blocked|job|asset|provider|database|storage|automation/.test(text);
}

export function createUniversalAssistantPlan(input: UniversalOrchestratorInput) {
  const mode = resolveUniversalAssistantMode(input);
  const needsPlan = shouldCreateOrchestratorPlan(input);
  const capabilities = getUniversalCapabilitiesForMode(mode);
  const capabilitySummary = summarizeUniversalCapabilities(mode);
  const runtime = input.runtimeSummary || {};
  const safetyActive = mode === "safety-intervention" || Boolean(runtime.latestSafety);
  const writesLikely = ["build", "repair", "visual-edit", "generation", "workflow-automation"].includes(mode);

  return {
    ok: !safetyActive || mode === "safety-intervention",
    needsPlan,
    mode,
    oneBrainRule: "OpenAI is the single orchestrator brain. Tools report and execute only after validation; tools do not decide independently.",
    freeFlowRule: "Normal questions should be answered naturally without heavy tool planning when no runtime/tool context is needed.",
    capabilities,
    capabilitySummary,
    safety: {
      active: safetyActive,
      requiresApproval: safetyActive || writesLikely,
      reason: safetyActive ? "A safety/intervention signal is active or implied by the request." : "No active safety block detected.",
      recommendations: safetyActive ? ["Pause action", "Explain risk", "Recommend safe choices", "Wait for approved scope"] : ["Use available capabilities", "Do not claim unproven action", "Record proof when tools run"],
    },
    proofRules: [
      "Do not claim generated output without asset/provider/job proof.",
      "Do not claim source edit without patch/change proof.",
      "Do not claim build/deploy success without status proof.",
      "If proof is partial, say partial.",
    ],
    nextSteps: needsPlan
      ? ["Read relevant runtime context", "Select safe capabilities", "Use controlled tools if needed", "Return result to same orchestrator context"]
      : ["Answer directly", "Do not use tools unless user asks or context requires it"],
  };
}

export async function traceUniversalAssistantPlan(input: UniversalOrchestratorInput) {
  const plan = createUniversalAssistantPlan(input);
  await recordUniversalRuntimeEvent({
    sessionId: input.sessionId || "agent-1",
    phase: "universal-orchestrator.plan",
    source: "streams-ai-universal-orchestrator",
    severity: plan.safety.active ? "warning" : "info",
    message: `Universal assistant mode: ${plan.mode}`,
    mode: plan.mode,
    riskLevel: plan.safety.active ? "approval-required" : "safe",
    recommendations: plan.safety.recommendations,
    metadata: { needsPlan: plan.needsPlan, capabilitySummary: plan.capabilitySummary },
  });
  return plan;
}
