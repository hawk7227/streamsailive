import { resolveGeneratorTarget } from "./registry";
import type { CompiledGenerationRequest, CompilerInput } from "./types";
import { buildMotionPlan } from "./services/motionPlanner";
import { formatCompiledPrompt } from "./services/providerFormatter";
import { analyzeReferenceSummary } from "./services/referenceAnalyzer";
import { buildRealismPolicy } from "./services/realismPolicy";
import { scoreStructuralIntegrity } from "./services/structuralScoring";
import { buildRepairPlan } from "./services/repairLoop";
import { buildContinuityPlan } from "./services/continuityEngine";
import { buildIdentityLockPlan } from "./services/identityLock";
import { buildQaOrchestration } from "./services/qaOrchestrator";
import { analyzeSemanticIntent, buildSemanticQaChecks } from "./services/semanticIntent";

const GLOBAL_REALISM_RULES = [
  "ordinary believable people, not models",
  "natural or motivated practical lighting only",
  "lived-in environments with imperfect details",
  "no fake text, logos, UI, labels, or signage baked into media",
  "avoid cinematic, glossy, editorial, or ad-polished language",
  "protect anatomy, face integrity, and full limb continuity",
  "prefer subtle motion over aggressive motion when references are weak",
  "auto-review every image and video before approval",
  "build anchor stills before high-risk image-to-video runs",
];

function compact(text?: string | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

export function compileGenerationRequest(input: CompilerInput): CompiledGenerationRequest {
  const target = resolveGeneratorTarget(input);
  const medium = input.medium;
  const provider = input.provider ?? (medium === "song" ? "suno" : medium === "video" ? "kling" : medium === "voice" ? "openai" : "openai");
  const rawPrompt = compact(input.prompt);
  const storyBible = compact(input.storyBible);
  const referenceSummary = compact(input.referenceSummary);
  const semanticIntent = analyzeSemanticIntent(rawPrompt);
  const semanticQaChecks = buildSemanticQaChecks(semanticIntent);

  const referenceAnalysis = analyzeReferenceSummary({
    referenceSummary,
    sourceKind: input.sourceKind,
  });

  const realismPolicy = buildRealismPolicy(medium);

  const motionPlan = medium === "video"
    ? buildMotionPlan({
        provider,
        mode: input.mode,
        hasStoryBible: Boolean(storyBible),
        referenceAnalysis,
      })
    : undefined;

  // Structural scoring only applies to visual media (image, video)
  const structuralScore = (medium === "image" || medium === "video")
    ? scoreStructuralIntegrity({
        referenceSummary,
        storyBible,
        referenceAnalysis,
        medium,
      })
    : undefined;

  const repairPlan = structuralScore ? buildRepairPlan(structuralScore, medium) : undefined;
  const continuityPlan = buildContinuityPlan({ storyBible, rawPrompt, referenceSummary });
  const identityLockPlan = buildIdentityLockPlan({ sourceKind: input.sourceKind, rawPrompt, storyBible });
  const qaOrchestration = buildQaOrchestration({
    medium,
    structuralScore,
    motionPlan,
    hasStoryBible: Boolean(storyBible),
    semanticQaChecks,
  });

  const warnings = [
    ...referenceAnalysis.warnings,
    ...(structuralScore?.blockedReasons ?? []),
    ...(qaOrchestration.reasons ?? []),
  ];

  // Story bible required for video and i2v; optional for script (enriches output)
  const storyBibleRequired = medium === "video";

  const baseCompiled: Omit<CompiledGenerationRequest, "prompt" | "notes" | "providerGuidance"> = {
    provider,
    target,
    medium,
    realismRules: GLOBAL_REALISM_RULES,
    qaChecklist: realismPolicy.qaChecklist,
    storyBibleRequired,
    sourceKind: input.sourceKind,
    warnings,
    referenceAnalysis,
    motionPlan,
    realismPolicy,
    structuralScore,
    repairPlan,
    continuityPlan,
    identityLockPlan,
    qaOrchestration,
    semanticIntent,
    semanticQaChecks,
  };

  const formatted = formatCompiledPrompt({
    compiled: baseCompiled,
    rawPrompt,
    storyBible,
    referenceSummary,
  });

  return {
    ...baseCompiled,
    ...formatted,
    notes: [
      ...formatted.notes,
      ...(structuralScore ? [`Structural realism score: ${structuralScore.realismScore}/100`] : []),
      ...(repairPlan ? [`Repair strategy: ${repairPlan.strategy}`] : []),
      ...(continuityPlan.continuityRequired ? [`Continuity lock: ${continuityPlan.identityLockStrength}`] : []),
      ...(qaOrchestration.shouldAutoReview ? ["Automatic QA review is required after generation."] : []),
      ...(semanticQaChecks.length ? ["Semantic QA checks: " + semanticQaChecks.map((c) => `${c.label}=${c.expected}`).join(", ")] : []),
    ],
    warnings: [...new Set(warnings)],
  };
}
