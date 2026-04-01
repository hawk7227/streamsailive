import { GENERATOR_REGISTRY } from "../registry";
import type { CompiledGenerationRequest, GeneratorProfile, MotionPlan, RealismPolicy, ReferenceAnalysis } from "../types";

function joinLines(lines: Array<string | null | undefined>): string {
  return lines.filter(Boolean).join("\n");
}

function formatNotes(compiled: Omit<CompiledGenerationRequest, "prompt" | "notes" | "providerGuidance">): string[] {
  return [
    ...compiled.referenceAnalysis.guidance,
    ...compiled.referenceAnalysis.warnings,
    ...(compiled.motionPlan?.notes ?? []),
    ...(compiled.structuralScore?.recommendedFixes ?? []),
    ...(compiled.repairPlan?.instructions ?? []),
    ...(compiled.continuityPlan?.continuityNotes ?? []),
    ...(compiled.identityLockPlan?.rules ?? []),
  ];
}

function buildProviderGuidance(profile: GeneratorProfile): string[] {
  return [
    `Provider strengths: ${profile.strengths.join(", ")}`,
    `Provider weaknesses: ${profile.weaknesses.join(", ")}`,
    `Watch for: ${profile.commonFailureModes.join(", ")}`,
  ];
}

function buildImagePrompt(input: {
  profile: GeneratorProfile;
  prompt: string;
  storyBible?: string | null;
  referenceSummary?: string | null;
  realismPolicy: RealismPolicy;
  compiled: Omit<CompiledGenerationRequest, "prompt" | "notes" | "providerGuidance">;
}): string {
  // Semantic locks must be declared FIRST — before realism rules — so the model
  // commits to subject/device/environment before any stylistic guidance is applied.
  const subjectLock = input.compiled.semanticIntent?.requestedGender !== "unknown"
    ? `SUBJECT LOCK (hard): The primary visible subject must be a ${input.compiled.semanticIntent?.requestedGender}. Gender substitution is a critical failure. Do not render any other gender as the primary subject.`
    : null;
  const deviceLock = input.compiled.semanticIntent?.requestedDevice !== "unknown"
    ? `OBJECT LOCK (hard): The image must clearly show a ${input.compiled.semanticIntent?.requestedDevice} held or used by the subject. Do not substitute a different object or omit the device.`
    : null;
  const envLock = input.compiled.semanticIntent?.requestedEnvironment.length
    ? `ENVIRONMENT LOCK: Scene must be set in: ${input.compiled.semanticIntent.requestedEnvironment.join(", ")}.`
    : null;
  const hardReject = [subjectLock, deviceLock, envLock].filter(Boolean).length > 0
    ? `HARD REJECT: Any output that violates the above locks must be discarded and regenerated.`
    : null;

  return joinLines([
    subjectLock,
    deviceLock,
    envLock,
    hardReject,
    `Task: Produce one ordinary candid still photograph that looks like a real camera capture, not an ad image or beauty render.`,
    `Scene: ${input.prompt}`,
    input.storyBible ? `Locked story bible: ${input.storyBible}` : null,
    input.referenceSummary ? `Reference pack: ${input.referenceSummary}` : null,
    `Realism target: ${input.realismPolicy.headline}.`,
    `Must include: ${input.realismPolicy.mustInclude.join("; ")}; visible skin texture; slight facial asymmetry; everyday non-model appearance; ordinary lived-in background detail.`,
    `Must avoid: ${input.realismPolicy.mustAvoid.join("; ")}; stock-photo polish; beauty editorial look; soft studio lighting; centered glamour portrait; fashion pose; over-smoothed skin; perfect symmetry; annotation boxes; callouts; text labels.`,
    input.compiled.identityLockPlan?.needsCharacterPack ? `Identity lock: preserve ${input.compiled.identityLockPlan.fields.join(", ")}.` : null,
    input.compiled.continuityPlan?.continuityRequired ? `Continuity lock: ${input.compiled.continuityPlan.environmentLock.join(", ")}.` : null,
    input.compiled.structuralScore ? `Structural target: face ${input.compiled.structuralScore.faceIntegrity}/100, body ${input.compiled.structuralScore.bodyIntegrity}/100, background ${input.compiled.structuralScore.backgroundIntegrity}/100.` : null,
    `Provider tuning for ${input.profile.label}: grounded, direct, plain, and documentary-like. No ad-polished framing. No default lifestyle aesthetic.`,
    `Human appearance rule: if a person is shown, they must look like a normal everyday person, not a beautified influencer, not a fashion model, and not a polished AI portrait.`,
    `Composition rule: prefer off-center or casually framed composition, phone-camera realism, and ordinary room detail over a hero shot or symmetrical portrait crop.`,
    `Anatomy rule: preserve facial structure, hands, and body proportions with no hallucinated props or fake text.`,
  ]);
}

function buildVideoPrompt(input: {
  profile: GeneratorProfile;
  prompt: string;
  storyBible?: string | null;
  referenceSummary?: string | null;
  realismPolicy: RealismPolicy;
  motionPlan: MotionPlan;
  referenceAnalysis: ReferenceAnalysis;
  compiled: Omit<CompiledGenerationRequest, "prompt" | "notes" | "providerGuidance">;
}): string {
  return joinLines([
    `Task: Produce one realistic video clip.`,
    `Primary scene: ${input.prompt}`,
    input.storyBible ? `Locked story bible: ${input.storyBible}` : `No locked story bible supplied. Clamp the scene to one grounded action.`,
    input.referenceSummary ? `Reference pack: ${input.referenceSummary}` : `No reference pack supplied. Do not overfit identity; keep subject generic and motion minimal.`,
    `Camera: ${input.motionPlan.cameraStyle}.`,
    `Allowed movement: ${input.motionPlan.allowedMoves.join(", ")}.`,
    `Blocked movement: ${input.motionPlan.blockedMoves.join(", ")}.`,
    `Reference risk: strength=${input.referenceAnalysis.referenceStrength}; anatomy risk=${input.referenceAnalysis.anatomyRisk}.`,
    input.compiled.structuralScore ? `Structural gate: realism ${input.compiled.structuralScore.realismScore}/100; face ${input.compiled.structuralScore.faceIntegrity}/100; body ${input.compiled.structuralScore.bodyIntegrity}/100; pose ${input.compiled.structuralScore.poseStability}/100.` : null,
    input.compiled.repairPlan ? `Repair strategy before motion: ${input.compiled.repairPlan.strategy}.` : null,
    input.compiled.continuityPlan?.continuityRequired ? `Continuity requirements: ${input.compiled.continuityPlan.environmentLock.join(", ")}.` : null,
    input.compiled.identityLockPlan?.needsCharacterPack ? `Identity lock fields: ${input.compiled.identityLockPlan.fields.join(", ")}.` : null,
    `Realism target: ${input.realismPolicy.headline}.`,
    `Must include: ${input.realismPolicy.mustInclude.join("; ")}.`,
    `Must avoid: ${input.realismPolicy.mustAvoid.join("; ")}.`,
    `Provider tuning for ${input.profile.label}: keep motion controlled, coherent, and physically plausible.`,
    input.compiled.semanticIntent?.requestedGender !== "unknown" ? `Semantic lock: preserve the requested subject as ${input.compiled.semanticIntent?.requestedGender}.` : null,
    `Hard reject: blob faces, missing fingers, extra limbs, rubber motion, identity drift, floating props, background warping, or subject substitution.`,
    input.compiled.qaOrchestration?.shouldAutoReview ? `Automatic review required after render.` : null,
  ]);
}

function buildSongPrompt(input: {
  profile: GeneratorProfile;
  prompt: string;
  storyBible?: string | null;
  referenceSummary?: string | null;
  realismPolicy: RealismPolicy;
  compiled: Omit<CompiledGenerationRequest, "prompt" | "notes" | "providerGuidance">;
}): string {
  return joinLines([
    `Task: Write and generate a complete song.`,
    `Song direction: ${input.prompt}`,
    input.storyBible ? `Locked story bible for lyrical continuity: ${input.storyBible}` : null,
    input.referenceSummary ? `Voice reference pack: ${input.referenceSummary}` : `No voice pack supplied. Keep the vocal direction broad and believable.`,
    input.compiled.identityLockPlan?.sourceType ? `Voice source type: ${input.compiled.identityLockPlan.sourceType}.` : null,
    `Must include: ${input.realismPolicy.mustInclude.join("; ")}.`,
    `Must avoid: ${input.realismPolicy.mustAvoid.join("; ")}.`,
    `Provider tuning for ${input.profile.label}: use compact genre framing, strong hook clarity, and specific vocal delivery notes.`,
  ]);
}

function buildScriptPrompt(input: {
  profile: GeneratorProfile;
  prompt: string;
  storyBible?: string | null;
  referenceSummary?: string | null;
  realismPolicy: RealismPolicy;
  compiled: Omit<CompiledGenerationRequest, "prompt" | "notes" | "providerGuidance">;
}): string {
  return joinLines([
    `Task: Write a production-ready script.`,
    `Direction: ${input.prompt}`,
    input.storyBible ? `Locked story bible: ${input.storyBible}` : null,
    input.referenceSummary ? `Reference context: ${input.referenceSummary}` : null,
    `Format target: ${input.realismPolicy.headline}.`,
    `Must include: ${input.realismPolicy.mustInclude.join("; ")}.`,
    `Must avoid: ${input.realismPolicy.mustAvoid.join("; ")}.`,
    input.compiled.continuityPlan?.continuityRequired ? `Scene continuity: ${input.compiled.continuityPlan.continuityNotes.join("; ")}.` : null,
    `Provider tuning for ${input.profile.label}: structure for downstream generation — every scene beat must be visually actionable.`,
  ]);
}

function buildVoicePrompt(input: {
  profile: GeneratorProfile;
  prompt: string;
  storyBible?: string | null;
  referenceSummary?: string | null;
  realismPolicy: RealismPolicy;
  compiled: Omit<CompiledGenerationRequest, "prompt" | "notes" | "providerGuidance">;
}): string {
  return joinLines([
    `Task: Generate voice audio.`,
    `Direction: ${input.prompt}`,
    input.storyBible ? `Story context: ${input.storyBible}` : null,
    input.referenceSummary ? `Voice reference pack: ${input.referenceSummary}` : `No voice reference supplied. Use a neutral, believable delivery.`,
    input.compiled.identityLockPlan?.sourceType ? `Voice source type: ${input.compiled.identityLockPlan.sourceType}. Consent and rights must be confirmed before cloning.` : null,
    `Performance target: ${input.realismPolicy.headline}.`,
    `Must include: ${input.realismPolicy.mustInclude.join("; ")}.`,
    `Must avoid: ${input.realismPolicy.mustAvoid.join("; ")}.`,
    `Provider tuning for ${input.profile.label}: deliver specific tone, pace, and emotional register cues — not abstract descriptors.`,
  ]);
}

export function formatCompiledPrompt(input: {
  compiled: Omit<CompiledGenerationRequest, "prompt" | "notes" | "providerGuidance">;
  rawPrompt: string;
  storyBible?: string | null;
  referenceSummary?: string | null;
}): Pick<CompiledGenerationRequest, "prompt" | "notes" | "providerGuidance"> {
  const profile = GENERATOR_REGISTRY[input.compiled.target];
  const providerGuidance = buildProviderGuidance(profile);

  const prompt = input.compiled.medium === "image"
    ? buildImagePrompt({
        profile,
        prompt: input.rawPrompt,
        storyBible: input.storyBible,
        referenceSummary: input.referenceSummary,
        realismPolicy: input.compiled.realismPolicy,
        compiled: input.compiled,
      })
    : input.compiled.medium === "video"
      ? buildVideoPrompt({
          profile,
          prompt: input.rawPrompt,
          storyBible: input.storyBible,
          referenceSummary: input.referenceSummary,
          realismPolicy: input.compiled.realismPolicy,
          motionPlan: input.compiled.motionPlan!,
          referenceAnalysis: input.compiled.referenceAnalysis,
          compiled: input.compiled,
        })
      : input.compiled.medium === "script"
        ? buildScriptPrompt({
            profile,
            prompt: input.rawPrompt,
            storyBible: input.storyBible,
            referenceSummary: input.referenceSummary,
            realismPolicy: input.compiled.realismPolicy,
            compiled: input.compiled,
          })
        : input.compiled.medium === "voice"
          ? buildVoicePrompt({
              profile,
              prompt: input.rawPrompt,
              storyBible: input.storyBible,
              referenceSummary: input.referenceSummary,
              realismPolicy: input.compiled.realismPolicy,
              compiled: input.compiled,
            })
          : buildSongPrompt({
              profile,
              prompt: input.rawPrompt,
              storyBible: input.storyBible,
              referenceSummary: input.referenceSummary,
              realismPolicy: input.compiled.realismPolicy,
              compiled: input.compiled,
            });

  return {
    prompt,
    notes: formatNotes(input.compiled),
    providerGuidance,
  };
}
