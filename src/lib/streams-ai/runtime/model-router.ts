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
  capabilitySource: "explicit-env" | "verified-default" | "conservative-fallback";
};

export type StreamsModelRoute = {
  routeVersion: string;
  primary: StreamsModelCapability;
  fallbacks: StreamsModelCapability[];
  judge: StreamsModelCapability;
  repair: StreamsModelCapability;
  reason: string[];
};

export const STREAMS_MODEL_ROUTE_VERSION = "streams-model-router-v2";

function readBoolean(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

function readNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function modelHealth(id: string) {
  const normalized = id.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const value = String(process.env[`STREAMS_MODEL_HEALTH_${normalized}`] || "healthy").toLowerCase();
  return value === "offline" ? "offline" : value === "degraded" ? "degraded" : "healthy";
}

function explicitCapability(id: string, role: StreamsModelRole, profile: Partial<StreamsModelCapability>): StreamsModelCapability {
  const normalized = id.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return {
    id,
    role,
    reasoningTier: readNumber(`STREAMS_MODEL_REASONING_${normalized}`, profile.reasoningTier || 3),
    writingTier: readNumber(`STREAMS_MODEL_WRITING_${normalized}`, profile.writingTier || 3),
    codingTier: readNumber(`STREAMS_MODEL_CODING_${normalized}`, profile.codingTier || 3),
    visionTier: readNumber(`STREAMS_MODEL_VISION_${normalized}`, profile.visionTier || 0),
    longContextTier: readNumber(`STREAMS_MODEL_LONG_CONTEXT_${normalized}`, profile.longContextTier || 2),
    toolCallingTier: readNumber(`STREAMS_MODEL_TOOLS_${normalized}`, profile.toolCallingTier || 0),
    researchTier: readNumber(`STREAMS_MODEL_RESEARCH_${normalized}`, profile.researchTier || 0),
    contextWindow: readNumber(`STREAMS_MODEL_CONTEXT_WINDOW_${normalized}`, profile.contextWindow || 32000),
    supportsImages: readBoolean(`STREAMS_MODEL_SUPPORTS_IMAGES_${normalized}`, Boolean(profile.supportsImages)),
    supportsTools: readBoolean(`STREAMS_MODEL_SUPPORTS_TOOLS_${normalized}`, Boolean(profile.supportsTools)),
    supportsStructuredOutput: readBoolean(`STREAMS_MODEL_SUPPORTS_STRUCTURED_${normalized}`, profile.supportsStructuredOutput !== false),
    supportsStreaming: readBoolean(`STREAMS_MODEL_SUPPORTS_STREAMING_${normalized}`, profile.supportsStreaming !== false),
    latencyClass: profile.latencyClass || "standard",
    reliabilityScore: Math.max(0.5, Math.min(1, Number(profile.reliabilityScore || 0.9))),
    health: modelHealth(id),
    capabilitySource: process.env[`STREAMS_MODEL_CONTEXT_WINDOW_${normalized}`] ? "explicit-env" : profile.capabilitySource || "verified-default",
  };
}

function openAIKnownProfile(id: string, role: StreamsModelRole): StreamsModelCapability {
  const lower = id.toLowerCase();
  const fast = /mini|nano/.test(lower);
  const strong = /gpt-5|gpt-4\.1|gpt-4o|o3|o4/.test(lower);
  const supportsVision = /gpt-5|gpt-4\.1|gpt-4o|o3|o4/.test(lower) && !/text-only/.test(lower);
  const supportsTools = strong;
  return explicitCapability(id, role, {
    reasoningTier: fast ? 3 : strong ? 5 : 2,
    writingTier: fast ? 3 : strong ? 5 : 2,
    codingTier: fast ? 3 : strong ? 5 : 2,
    visionTier: supportsVision ? (fast ? 3 : 5) : 0,
    longContextTier: strong ? 5 : 2,
    toolCallingTier: supportsTools ? (fast ? 3 : 5) : 0,
    researchTier: supportsTools ? (fast ? 3 : 5) : 0,
    contextWindow: strong ? 128000 : 32000,
    supportsImages: supportsVision,
    supportsTools,
    supportsStructuredOutput: true,
    supportsStreaming: true,
    latencyClass: fast ? "fast" : "standard",
    reliabilityScore: fast ? 0.95 : strong ? 0.97 : 0.88,
    capabilitySource: strong ? "verified-default" : "conservative-fallback",
  });
}

function uniqueModels(models: StreamsModelCapability[]) {
  const seen = new Set<string>();
  return models.filter((model) => {
    const key = `${model.role}:${model.id}`;
    if (!model.id || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  return uniqueModels([
    openAIKnownProfile(fast, "primary"),
    openAIKnownProfile(advanced, "primary"),
    openAIKnownProfile(longContext, "primary"),
    openAIKnownProfile(coding, "primary"),
    openAIKnownProfile(vision, "primary"),
    openAIKnownProfile(research, "primary"),
    { ...openAIKnownProfile(judge, "judge"), supportsStreaming: false },
    { ...openAIKnownProfile(repair, "repair"), supportsStreaming: false },
  ]);
}

function scoreModel(model: StreamsModelCapability, intent: StreamsIntentDecision, input: { hasImages: boolean; contextTokens: number }) {
  if (model.health === "offline") return Number.NEGATIVE_INFINITY;
  if ((input.hasImages || intent.needsImages) && !model.supportsImages) return Number.NEGATIVE_INFINITY;
  if (intent.needsTools && !model.supportsTools) return Number.NEGATIVE_INFINITY;
  if (input.contextTokens > model.contextWindow * 0.9) return Number.NEGATIVE_INFINITY;

  let score = model.reliabilityScore * 10;
  if (intent.complexity === "simple") score += model.latencyClass === "fast" ? 8 : 0;
  if (intent.complexity === "complex" || intent.complexity === "critical") score += model.reasoningTier * 3;
  if (["coding", "repository_action", "troubleshooting"].includes(intent.primaryIntent)) score += model.codingTier * 4;
  if (["writing", "rewriting"].includes(intent.primaryIntent)) score += model.writingTier * 3;
  if (intent.primaryIntent === "research" || intent.needsCurrentInformation) score += model.researchTier * 4 + model.toolCallingTier * 2;
  if (input.hasImages || intent.needsImages) score += model.visionTier * 5;
  if (input.contextTokens > 64000) score += model.longContextTier * 5;
  if (intent.needsTools) score += model.toolCallingTier * 3;
  if (intent.requestedFormat.exact) score += model.supportsStructuredOutput ? 6 : -20;
  if (model.health === "degraded") score -= 20;
  return score;
}

export function routeStreamsModels(input: {
  intent: StreamsIntentDecision;
  hasImages: boolean;
  contextTokens: number;
}): StreamsModelRoute {
  const registry = buildStreamsModelRegistry();
  const primaryCandidates = registry
    .filter((model) => model.role === "primary")
    .map((model) => ({ model, score: scoreModel(model, input.intent, input) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score);

  const primary = primaryCandidates[0]?.model;
  const judge = registry.find((model) => model.role === "judge" && model.health !== "offline");
  const repair = registry.find((model) => model.role === "repair" && model.health !== "offline");
  if (!primary || !judge || !repair) throw new Error("No verified healthy Streams model route is available");

  const fallbacks = primaryCandidates.slice(1).map(({ model }) => ({ ...model, role: "fallback" as const }));
  const reason = [
    `intent:${input.intent.primaryIntent}`,
    `complexity:${input.intent.complexity}`,
    input.hasImages ? "vision-required" : "text-only",
    input.intent.needsCurrentInformation ? "research-required" : "stable-knowledge",
    input.contextTokens > 64000 ? "long-context" : "standard-context",
    `capability-source:${primary.capabilitySource}`,
  ];

  return { routeVersion: STREAMS_MODEL_ROUTE_VERSION, primary, fallbacks, judge, repair, reason };
}
