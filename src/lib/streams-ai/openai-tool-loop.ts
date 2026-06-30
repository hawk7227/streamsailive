import { APPROVED_OPENAI_TOOL_DEFINITIONS } from "@/lib/streams-ai/openai-tool-definitions";
import { executeApprovedOpenAITool, type ToolExecutorDeps } from "@/lib/streams-ai/openai-tool-executor";

export type ControlledToolLoopResult = {
  toolDefinitions: typeof APPROVED_OPENAI_TOOL_DEFINITIONS;
  toolResults: Array<{ name: string; ok: boolean; result?: Record<string, unknown>; error?: string }>;
  maxRounds: number;
  note: string;
};

export async function runControlledOpenAIToolLoopScaffold({
  requestedTools,
  deps,
  maxRounds = 3,
}: {
  requestedTools: Array<{ name: string; args: Record<string, unknown> }>;
  deps: ToolExecutorDeps;
  maxRounds?: number;
}): Promise<ControlledToolLoopResult> {
  const toolResults: ControlledToolLoopResult["toolResults"] = [];
  for (const request of requestedTools.slice(0, maxRounds)) {
    const executed = await executeApprovedOpenAITool(request.name, request.args || {}, deps);
    toolResults.push({ name: request.name, ok: Boolean(executed.ok), result: executed.result as Record<string, unknown> | undefined, error: typeof executed.error === "string" ? executed.error : undefined });
  }
  return {
    toolDefinitions: APPROVED_OPENAI_TOOL_DEFINITIONS,
    toolResults,
    maxRounds,
    note: "Controlled tool loop scaffold is ready for Responses API tool-call continuation. Regex deterministic tools can remain fallback until full SDK tool event plumbing is wired.",
  };
}
