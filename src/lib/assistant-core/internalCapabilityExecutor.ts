import "server-only";

import {
  INTERNAL_CAPABILITY_ENGINES,
  type InternalCapabilityEngine,
} from "./internalCapabilityEngines";
import { getEnvReadinessReport } from "@/lib/streams-builder/env-readiness";

type ExecuteInternalCapabilityInput = {
  request: string;
  engineId?: string;
  intent?: string;
  context?: Record<string, unknown>;
};

export type InternalCapabilityExecutionPlan = {
  ok: boolean;
  engineId: string;
  engineLabel: string;
  executionLevel: InternalCapabilityEngine["executionLevel"];
  primaryRoute: string;
  request: string;
  selectedReason: string;
  ready: boolean;
  blockers: string[];
  steps: Array<{
    id: string;
    action: string;
    tools: string[];
    proof: string[];
    failureChecks: string[];
  }>;
  requiredProof: string[];
  nextToolActions: Array<{
    tool: string;
    purpose: string;
    requiredBeforeClaimingDone: boolean;
  }>;
  mustNotDo: string[];
};

const ENGINE_KEYWORDS: Record<string, string[]> = {
  "creation-engine": ["create", "concept", "idea", "asset", "creative", "prompt", "image", "page", "brief"],
  "movie-engine": ["movie", "film", "video", "scene", "shot", "clip", "trailer", "long video", "image to video"],
  "song-audio-engine": ["song", "music", "audio", "voice", "narration", "lyrics", "instrumental", "dub", "tts"],
  "builder-engine": ["build", "repo", "code", "component", "frontend", "backend", "app", "route", "deploy"],
  "repair-engine": ["fix", "error", "bug", "failed", "failing", "broken", "troubleshoot", "repair", "log"],
  "system-orchestration-engine": ["workflow", "automation", "orchestrate", "queue", "worker", "cron", "trigger", "approval"],
  "industry-execution-engine": ["healthcare", "ecommerce", "finance", "legal", "education", "logistics", "hr", "sales", "support", "cybersecurity", "operations"],
};

function selectEngine(input: ExecuteInternalCapabilityInput): { engine: InternalCapabilityEngine; reason: string } {
  if (input.engineId) {
    const explicit = INTERNAL_CAPABILITY_ENGINES.find((engine) => engine.id === input.engineId);
    if (explicit) return { engine: explicit, reason: `explicit engineId=${input.engineId}` };
  }

  const haystack = `${input.intent ?? ""} ${input.request}`.toLowerCase();
  let best: { engine: InternalCapabilityEngine; score: number; matched: string[] } | null = null;

  for (const engine of INTERNAL_CAPABILITY_ENGINES) {
    const keywords = ENGINE_KEYWORDS[engine.id] ?? [];
    const matched = keywords.filter((keyword) => haystack.includes(keyword));
    const score = matched.length;
    if (!best || score > best.score) best = { engine, score, matched };
  }

  if (best && best.score > 0) {
    return { engine: best.engine, reason: `matched keywords: ${best.matched.join(", ")}` };
  }

  const fallback = INTERNAL_CAPABILITY_ENGINES.find((engine) => engine.id === "creation-engine") ?? INTERNAL_CAPABILITY_ENGINES[0];
  return { engine: fallback, reason: "default creation engine" };
}

function deriveReadinessBlockers(engine: InternalCapabilityEngine): string[] {
  const report = getEnvReadinessReport();
  if (report.ok) return [];

  const missing = report.capabilities
    .filter((capability) => capability.state === "missing")
    .flatMap((capability) => capability.missing);

  if (engine.executionLevel === "blocked") return Array.from(new Set(missing));
  return [];
}

function flattenProof(engine: InternalCapabilityEngine): string[] {
  return Array.from(new Set(engine.steps.flatMap((step) => step.proof)));
}

function nextToolActions(engine: InternalCapabilityEngine) {
  const orderedTools = Array.from(new Set(engine.steps.flatMap((step) => step.tools)));
  return orderedTools.map((tool) => ({
    tool,
    purpose: `Required by ${engine.label}`,
    requiredBeforeClaimingDone: [
      "generate_media",
      "generate_song",
      "generate_voice",
      "write_workspace_file",
      "apply_workspace_patch",
      "run_workspace_command",
      "build_workspace",
      "run_verification",
    ].includes(tool),
  }));
}

export function executeInternalCapabilityEngine(
  input: ExecuteInternalCapabilityInput,
): InternalCapabilityExecutionPlan {
  const trimmed = input.request.trim();
  if (!trimmed) {
    return {
      ok: false,
      engineId: "none",
      engineLabel: "No engine selected",
      executionLevel: "blocked",
      primaryRoute: "none",
      request: "",
      selectedReason: "empty request",
      ready: false,
      blockers: ["request is required"],
      steps: [],
      requiredProof: [],
      nextToolActions: [],
      mustNotDo: ["do not claim execution"],
    };
  }

  const { engine, reason } = selectEngine(input);
  const blockers = deriveReadinessBlockers(engine);
  const ready = blockers.length === 0 && engine.executionLevel !== "blocked";

  return {
    ok: true,
    engineId: engine.id,
    engineLabel: engine.label,
    executionLevel: engine.executionLevel,
    primaryRoute: engine.primaryRoute,
    request: trimmed,
    selectedReason: reason,
    ready,
    blockers,
    steps: engine.steps.map((step) => ({
      id: step.id,
      action: step.action,
      tools: step.tools,
      proof: step.proof,
      failureChecks: step.failureChecks,
    })),
    requiredProof: flattenProof(engine),
    nextToolActions: nextToolActions(engine),
    mustNotDo: engine.mustNotDo,
  };
}
