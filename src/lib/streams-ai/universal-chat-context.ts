import { readUniversalRuntimeEvents, summarizeRuntimeEvents } from "@/lib/streams-ai/runtime-events";
import { summarizeUniversalCapabilities } from "@/lib/streams-ai/universal-capability-registry";
import { createUniversalAssistantPlan } from "@/lib/streams-ai/universal-orchestrator";

export type UniversalChatContextInput = {
  sessionId: string;
  userMessage: string;
  includePlan?: boolean;
};

function compact(value: unknown, max = 6000) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export async function buildUniversalChatContext(input: UniversalChatContextInput) {
  const events = await readUniversalRuntimeEvents(input.sessionId);
  const runtimeSummary = summarizeRuntimeEvents(events as Record<string, unknown>[]);
  const plan = input.includePlan === false ? null : createUniversalAssistantPlan({ sessionId: input.sessionId, userMessage: input.userMessage, runtimeSummary });
  const capabilitySummary = summarizeUniversalCapabilities(plan?.mode);

  return {
    sessionId: input.sessionId,
    runtimeSummary,
    plan,
    capabilitySummary,
    contextText: [
      "Current Streams universal runtime context:",
      `sessionId: ${input.sessionId}`,
      `planMode: ${plan?.mode || "not-created"}`,
      `planNeeded: ${plan?.needsPlan ?? false}`,
      `safetyActive: ${plan?.safety.active ?? false}`,
      `capabilities: ${compact(capabilitySummary, 2000)}`,
      `latestRuntimeEvents: ${compact(runtimeSummary, 9000)}`,
      "Rules: Use this as live runtime truth. Do not claim actions happened unless events, tool results, jobs, assets, provider runs, commits, build status, deployment status, or stored proof show it. If proof is partial, say partial. If a tool is unavailable, say unavailable. If action is unsafe or low confidence, block and recommend safe options.",
    ].join("\n"),
  };
}
