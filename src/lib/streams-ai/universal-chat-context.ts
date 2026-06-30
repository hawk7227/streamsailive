import { createStreamsAIServiceClient, streamsAISchema } from "@/lib/streams-ai/server";
import { formatAssetContextForPrompt } from "@/lib/streams-ai/asset-processing";
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

function scoreChunks(rows: Record<string, any>[], query: string) {
  const terms = String(query || "").toLowerCase().split(/\W+/).filter((term) => term.length > 2).slice(0, 24);
  return rows
    .map((row) => {
      const haystack = `${row.content || ""} ${row.summary || ""}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { ...row, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

async function safeAssetContext(sessionId: string, userMessage: string) {
  if (!sessionId) return "";
  try {
    const { data, error } = await streamsAISchema(createStreamsAIServiceClient())
      .from("streams_ai_asset_chunks")
      .select("asset_id, chunk_index, content, summary, metadata, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return formatAssetContextForPrompt(scoreChunks(data || [], userMessage));
  } catch {
    return "";
  }
}

export async function buildUniversalChatContext(input: UniversalChatContextInput) {
  const events = await readUniversalRuntimeEvents(input.sessionId);
  const runtimeSummary = summarizeRuntimeEvents(events as Record<string, unknown>[]);
  const plan = input.includePlan === false ? null : createUniversalAssistantPlan({ sessionId: input.sessionId, userMessage: input.userMessage, runtimeSummary });
  const capabilitySummary = summarizeUniversalCapabilities(plan?.mode);
  const assetContext = await safeAssetContext(input.sessionId, input.userMessage);

  return {
    sessionId: input.sessionId,
    runtimeSummary,
    plan,
    capabilitySummary,
    assetContext,
    contextText: [
      "Current Streams universal runtime context:",
      `sessionId: ${input.sessionId}`,
      `planMode: ${plan?.mode || "not-created"}`,
      `planNeeded: ${plan?.needsPlan ?? false}`,
      `safetyActive: ${plan?.safety.active ?? false}`,
      `capabilities: ${compact(capabilitySummary, 2000)}`,
      assetContext ? compact(assetContext, 14000) : "Uploaded file context: no relevant processed file chunks retrieved for this turn.",
      `latestRuntimeEvents: ${compact(runtimeSummary, 9000)}`,
      "Rules: Use this as live runtime truth. Do not claim actions happened unless events, tool results, jobs, assets, provider runs, commits, build status, deployment status, or stored proof show it. If proof is partial, say partial. If a tool is unavailable, say unavailable. If action is unsafe or low confidence, block and recommend safe options.",
    ].join("\n"),
  };
}
