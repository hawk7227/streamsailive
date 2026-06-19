import { buildSetupDurationPlan, type WorkflowMode } from "./generation-setup-options";

export type AcceptedReference = {
  type: string;
  role: string;
  url?: string;
  assetId?: string | null;
  analysisId?: string | null;
  accepted?: boolean;
};

export type FinalDirectorSetupInput = {
  fields: Record<string, any>;
  generationTypeId?: string;
  visualCardId?: string;
  visualCardTitle?: string;
  provider?: string;
  workflowMode?: WorkflowMode;
  acceptedReferences?: AcceptedReference[];
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function line(label: string, value: unknown) {
  const text = clean(value);
  return text ? `${label}: ${text}` : "";
}

export function compileFinalDirectorSetup(input: FinalDirectorSetupInput) {
  const fields = input.fields || {};
  const workflowMode = input.workflowMode || "structured-production";
  const durationPlan = buildSetupDurationPlan({ duration: fields.duration, provider: input.provider, workflowMode });
  const acceptedReferences = (input.acceptedReferences || []).filter((item) => item.accepted !== false && (item.url || item.assetId || item.analysisId));

  const visualDirectorSetup = [
    clean(fields.mainPrompt),
    line("Selected generation type", input.generationTypeId),
    line("Selected visual direction", input.visualCardTitle || input.visualCardId),
    line("Scene", fields.scene),
    line("Subject", fields.subject),
    line("Environment", fields.environment),
    line("Emotional intent", fields.emotionalIntent),
    line("Mood", fields.mood),
    line("Camera", [fields.shotType, fields.cameraPosition, fields.cameraMovement, fields.lens, fields.depthOfField, fields.composition].filter(Boolean).join(", ")),
    line("Lighting", [fields.primaryLighting, fields.accentLighting, fields.rimLight, fields.atmosphere].filter(Boolean).join(", ")),
    line("Motion", [fields.characterMotion, fields.environmentMotion, fields.motionQuality].filter(Boolean).join(". ")),
    line("Style", [fields.visualStyle, fields.filmReference, fields.productionDesign, fields.humanRealism].filter(Boolean).join(", ")),
  ].filter(Boolean).join("\n");

  const scriptPerformanceGuide = [
    line("Spoken intent", fields.spokenIntent),
    line("Pre-script line", fields.preScriptLine),
    line("Performance beat", fields.performanceBeat),
    line("Gesture direction", fields.gestureDirection),
    line("Facial expression", fields.facialExpression),
    line("Lip-sync need", fields.lipSyncNeed),
    line("Duration target", fields.durationTarget || fields.duration),
    line("Voiceover use later", fields.voiceoverUseLater),
  ].filter(Boolean).join("\n");

  const referenceSummary = acceptedReferences.length
    ? acceptedReferences.map((ref) => `${ref.role || ref.type}: ${ref.url || ref.assetId || ref.analysisId}`).join("\n")
    : "No accepted reference assets supplied.";

  const providerReadyPrompt = [
    visualDirectorSetup,
    scriptPerformanceGuide ? `\nScript / Performance Guide:\n${scriptPerformanceGuide}` : "",
    `\nAccepted references:\n${referenceSummary}`,
    `\nDuration plan: ${durationPlan.userMessage}`,
    "Preserve subject identity, face, body proportions, clothing, lighting continuity, camera language, and scene style across every clip.",
    "Use provider-safe cinematic language with clear subject, context, action, style, camera motion, composition, and ambiance.",
  ].filter(Boolean).join("\n");

  const storyBible = [
    fields.mainPrompt ? `Concept: ${fields.mainPrompt}` : "",
    scriptPerformanceGuide ? `Performance beats: ${scriptPerformanceGuide}` : "",
    `Target duration: ${durationPlan.requestedDurationSeconds} seconds`,
    durationPlan.requiresStitching ? `Split into ${durationPlan.requiredClipCount} coherent clips and preserve continuity between clips.` : "Single coherent clip.",
  ].filter(Boolean).join("\n");

  const missingRequiredItems: string[] = [];
  if (workflowMode === "structured-production" && input.generationTypeId?.includes("talking") && acceptedReferences.length === 0) {
    missingRequiredItems.push("A talking-head/founder setup should include at least one accepted face or mid-shot reference, or switch to text-to-video/draft mode.");
  }
  if (workflowMode === "structured-production" && !clean(fields.mainPrompt) && !clean(fields.scene)) {
    missingRequiredItems.push("Describe the main concept or scene before structured generation.");
  }

  return {
    visualDirectorSetup,
    scriptPerformanceGuide,
    providerReadyPrompt,
    storyBible,
    negativePrompt: clean(fields.negativePrompt),
    durationPlan,
    missingRequiredItems,
    acceptedReferences,
  };
}
