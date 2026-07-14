import type { StreamsIntentDecision } from "../runtime/intent-engine";

export const STREAMS_RESEARCH_AGENT_VERSION = "streams-research-agent-v1";

export type StreamsResearchPlan = {
  version: string;
  required: boolean;
  question: string;
  queries: string[];
  sourcePolicy: string[];
  minimumSources: number;
  requirePrimarySources: boolean;
  requireClaimCitationMapping: boolean;
  requireConflictDisclosure: boolean;
};

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function buildStreamsResearchPlan(input: { instruction: string; intent: StreamsIntentDecision }): StreamsResearchPlan {
  const instruction = String(input.instruction || "").trim();
  const required = input.intent.needsCurrentInformation || input.intent.primaryIntent === "research";
  const quoted = Array.from(instruction.matchAll(/[“"]([^”"]{3,100})[”"]/g)).map((match) => match[1]);
  const entities = Array.from(instruction.matchAll(/\b(?:OpenAI|Anthropic|Claude|ChatGPT|Google|Microsoft|Apple|Amazon|Meta|NVIDIA|[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g)).map((match) => match[0]);
  const timeWindow = instruction.match(/\b(?:last\s+\d+\s+days?|today|this\s+week|this\s+month|latest|current|recent)\b/i)?.[0] || "current";
  const queries = required ? unique([
    instruction,
    `${entities.slice(0, 4).join(" ")} ${timeWindow} official sources`,
    `${quoted.join(" ")} ${timeWindow}`,
  ]).slice(0, 5) : [];
  const requestedCount = Number(instruction.match(/\b(?:top|latest|give me|list)\s+(\d+)\b/i)?.[1] || 0);
  return {
    version: STREAMS_RESEARCH_AGENT_VERSION,
    required,
    question: instruction,
    queries,
    sourcePolicy: ["official documentation", "primary sources", "government or standards bodies", "recognized authoritative reporting"],
    minimumSources: required ? Math.max(2, requestedCount || 3) : 0,
    requirePrimarySources: /\b(api|law|regulation|standard|policy|release|documentation|specification)\b/i.test(instruction),
    requireClaimCitationMapping: required,
    requireConflictDisclosure: required,
  };
}

export function renderStreamsResearchPlan(plan: StreamsResearchPlan) {
  if (!plan.required) return "";
  return [
    `<streams_research_plan version="${plan.version}">`,
    `question: ${plan.question}`,
    `queries:\n${plan.queries.map((query, index) => `${index + 1}. ${query}`).join("\n")}`,
    `minimumSources: ${plan.minimumSources}`,
    `requirePrimarySources: ${plan.requirePrimarySources}`,
    `requireClaimCitationMapping: ${plan.requireClaimCitationMapping}`,
    `requireConflictDisclosure: ${plan.requireConflictDisclosure}`,
    `sourcePolicy: ${plan.sourcePolicy.join(" | ")}`,
    `Do not answer current claims from memory alone. Search, compare, and cite the claims that depend on current information.`,
    `</streams_research_plan>`,
  ].join("\n");
}
