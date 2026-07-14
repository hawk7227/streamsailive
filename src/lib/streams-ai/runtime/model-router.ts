import type { StreamsIntentDecision } from "./intent-engine";

export type StreamsModelRole = "primary" | "fallback" | "judge" | "repair";

export type StreamsModelCapability = {
  id: string;
  role: StreamsModelRole;
  reasoningTier: number;
  writingTier: number;
  codingTier: number;
  visionTier: number;
  longContextTier: number;
  toolCallingTier: number;
  researchTier: number;
  contextWindow: number;
  supportsImages: boolean;
  supportsTools: boolean;
  supportsStructuredOutput: boolean;
  supportsStreaming: boolean;
  latencyClass: "fast" | "standard" | "slow";
  reliabilityScore: number;
  health: "healthy" | "degraded" | "offline";
};

export type StreamsModelRoute = {
  routeVersion: string;
  primary: StreamsModelCapability;
  fallbacks: StreamsModelCapability[];
  judge: StreamsModelCapability;
  repair: StreamsModelCapability;
  reason: string[];
};

export const STREAMS_MODEL_ROUTE_VERSION = "streams-model-router-v1";

function unique(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && String(value).trim()))));
}

function capability(input: Partial<StreamsModelCapability> & Pick<StreamsModelCapability, "id" | "role">): StreamsModelCapability {
  return {
    reasoningTier: 3,
    writingTier: 3,
    codingTier: 3,
    visionTier: 3,
    longContextTier: 3,
    toolCallingTier: 3,
    researchTier: 3,
    contextWindow: 128000,
    supportsImages: true,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsStreaming: true,
    latencyClass: "standard",
    reliabilityScore: 0.95,
    health: "healthy",
    ...input,
  };
}

export function buildStreamsModelRegistry(): StreamsModelCapability[] {
  const fast = process.env.OPENAI_RESPONSES_MODEL_FAST || process.env.OPENAI_FAST_MODEL || "gpt-4.1-mini";
  const advanced = process.env.OPENAI_RESPONSES_MODEL_NEXT || process.env.OPENAI_PRO_MODEL || process.env.OPENAI_RESPONSES_MODEL || "gpt-4.1";
  const longContext = process.env.OPENAI_LONG_CONTEXT_MODEL || advanced;
  const coding = process.env.OPENAI_CODING_MODEL || advanced;
  const vision = process.env.OPENAI_VISION_MODEL || advanced;
  const research = process.env.OPENAI_SEARCH_MODEL || advanced;
  const judge = process.env.OPENAI_JUDGE_MODEL || advanced;
  const repair = process.env.OPENAI_REPAIR_MODEL || advanced;

  const entries = [
    capability({ id: fast, role: "primary", reasoningTier: 2, writingTier: 3, codingTier: 2, visionTier: 2, longContextTier: 2, researchTier: 2, latencyClass: "fast", reliabilityScore: 0.96 }),
    capability({ id: advanced, role: "primary", reasoningTier: 5, writingTier: 5, codingTier: 5, visionTier: 5, longContextTier: 4, researchTier: 4, latencyClass: "standard", reliabilityScore: 0.97 }),
    capability({ id: longContext, role: "primary", reasoningTier: 4, writingTier: 4, codingTier: 4, visionTier: 4, longContextTier: 5, contextWindow: 200000, latencyClass: "slow" }),
    capability({ id: coding, role: "primary", reasoningTier: 5, codingTier: 5, writingTier: 4, visionTier: 3, researchTier: 3 }),
    capability({ id: vision, role: "primary", reasoningTier: 4, writingTier: 4, codingTier: 3, visionTier: 5, researchTier: 3 }),
    capability({ id: research, role: "primary", reasoningTier: 5, writingTier: 4, codingTier: 3, visionTier: 4, researchTier: 5, toolCallingTier: 5 }),
    capability({ id: judge, role: "judge", reasoningTier: 5, writingTier: 4, codingTier: 4, visionTier: 4, researchTier: 4, supportsStreaming: false, latencyClass: "standard" }),
    capability({ id: repair, role: "repair", reasoningTier: 5, writingTier: 5, codingTier: 5, visionTier: 4, researchTier: 4, supportsStreaming: false, latencyClass: "standard" }),
  ];

  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.role}:${entry.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scoreModel(model: StreamsModelCapability, intent: StreamsIntentDecision, input: { hasImages: boolean; contextChars: number }) {
  if (model.health === "offline") return Number.NEGATIVE_INFINITY;
  let score = model.reliabilityScore * 10;
  if (intent.complexity === "simple") score += model.latencyClass === "fast" ? 8 : 0;
  if (intent.complexity === "complex" || intent.complexity === "critical") score += model.reasoningTier * 3;
  if (intent.primaryIntent === "coding" || intent.primaryIntent === "repository_action" || intent.primaryIntent === "troubleshooting") score += model.codingTier * 4;
  if (intent.primaryIntent === "writing" || intent.primaryIntent === "rewriting") score += model.writingTier * 3;
  if (intent.primaryIntent === "research" || intent.needsCurrentInformation) score += model.researchTier * 4 + model.toolCallingTier * 2;
  if (input.hasImages || intent.needsImages) score += model.supportsImages ? model.visionTier * 5 : -100;
  if (input.contextChars > 80000) score += model.longContextTier * 5;
  if (intent.needsTools) score += model.supportsTools ? model.toolCallingTier * 3 : -100;
  if (intent.requestedFormat.exact) score += model.supportsStructuredOutput ? 6 : -20;
  if (model.health === "degraded") score -= 20;
  return score;
}

export function routeStreamsModels(input: {
  intent: StreamsIntentDecision;
  hasImages: boolean;
  contextChars: number;
}): StreamsModelRoute {
  const registry = buildStreamsModelRegistry();
  const primaryCandidates = registry
    .filter((model) => model.role === "primary")
    .map((model) => ({ model, score: scoreModel(model, input.intent, input) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score);

  const judge = registry.find((model) => model.role === "judge") || primaryCandidates[0]?.model;
  const repair = registry.find((model) => model.role === "repair") || primaryCandidates[0]?.model;
  const primary = primaryCandidates[0]?.model;
  if (!primary || !judge || !repair) throw new Error("No healthy Streams model route is available");

  const fallbackIds = unique([
    ...primaryCandidates.slice(1).map((item) => item.model.id),
    process.env.OPENAI_RESPONSES_MODEL,
    process.env.OPENAI_SEARCH_MODEL,
    "gpt-4.1-mini",
  ]).filter((id) => id !== primary.id);

  const fallbacks = fallbackIds.map((id) => capability({ id, role: "fallback", latencyClass: "standard" }));
  const reason = [
    `intent:${input.intent.primaryIntent}`,
    `complexity:${input.intent.complexity}`,
    input.hasImages ? "vision-required" : "text-only",
    input.intent.needsCurrentInformation ? "research-required" : "stable-knowledge",
    input.contextChars > 80000 ? "long-context" : "standard-context",
  ];

  return { routeVersion: STREAMS_MODEL_ROUTE_VERSION, primary, fallbacks, judge, repair, reason };
}
