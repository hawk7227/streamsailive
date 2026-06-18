export function cleanGenerationValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const DEFAULT_PROVIDER_MAX_CLIP_SECONDS = 10;
const DEFAULT_DRAFT_CLIP_SECONDS = 5;

export type GenerationWorkflowMode = "structured-production" | "freestyle-draft";

export function resolveWorkflowMode(input: { workflowMode?: unknown; freestyle?: unknown; draft?: unknown }) {
  const workflowMode = cleanGenerationValue(input.workflowMode).toLowerCase();
  if (workflowMode.includes("freestyle") || workflowMode.includes("draft")) return "freestyle-draft" as const;
  if (input.freestyle === true || input.draft === true) return "freestyle-draft" as const;
  return "structured-production" as const;
}

function parseDurationSeconds(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  const text = cleanGenerationValue(value).toLowerCase();
  if (!text) return 0;
  const minuteMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:m|min|minute|minutes)/);
  if (minuteMatch) return Math.round(Number(minuteMatch[1]) * 60);
  const secondMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|second|seconds)/);
  if (secondMatch) return Math.round(Number(secondMatch[1]));
  const plainNumber = text.match(/^\d+$/);
  if (plainNumber) return Number(text);
  return 0;
}

export function resolveRequestedDurationSeconds(body: Record<string, any>, workflowMode: GenerationWorkflowMode = "structured-production") {
  const output = body.outputSettings || body.output || {};
  const direct = parseDurationSeconds(body.durationSeconds || body.duration || output.durationSeconds || output.duration);
  if (direct) return direct;

  const promptText = [body.mainPrompt, body.prompt, body.description].map(cleanGenerationValue).join(" ");
  const fromPrompt = parseDurationSeconds(promptText);
  if (fromPrompt) return fromPrompt;

  return workflowMode === "freestyle-draft" ? DEFAULT_DRAFT_CLIP_SECONDS : DEFAULT_PROVIDER_MAX_CLIP_SECONDS;
}

export function resolveProviderMaxClipSeconds(body: Record<string, any>) {
  const provider = cleanGenerationValue(body.provider || body.providerFamily).toLowerCase();
  const model = cleanGenerationValue(body.model || body.providerModel).toLowerCase();
  const output = body.outputSettings || body.output || {};
  const explicit = parseDurationSeconds(body.maxClipSeconds || output.maxClipSeconds);
  if (explicit) return explicit;
  if (provider.includes("kling") || model.includes("kling")) return 10;
  if (provider.includes("veo") || model.includes("veo")) return 8;
  if (provider.includes("runway") || model.includes("runway")) return 10;
  return DEFAULT_PROVIDER_MAX_CLIP_SECONDS;
}

export function buildDurationPlan(body: Record<string, any>) {
  const workflowMode = resolveWorkflowMode(body);
  const requestedDurationSeconds = resolveRequestedDurationSeconds(body, workflowMode);
  const providerMaxClipSeconds = resolveProviderMaxClipSeconds(body);
  const clipCount = Math.max(1, Math.ceil(requestedDurationSeconds / providerMaxClipSeconds));
  const requiresStitching = workflowMode === "structured-production" && clipCount > 1;
  return {
    workflowMode,
    requestedDurationSeconds,
    providerMaxClipSeconds,
    clipCount,
    requiresStitching,
    clipDurationSeconds: workflowMode === "freestyle-draft" ? Math.min(requestedDurationSeconds, DEFAULT_DRAFT_CLIP_SECONDS) : providerMaxClipSeconds,
  };
}

export function resolveGenerationMode(input: {
  requestedMode?: unknown;
  imageUrl?: unknown;
  videoUrl?: unknown;
  analysisId?: unknown;
}) {
  const requestedMode = cleanGenerationValue(input.requestedMode).toLowerCase();
  const imageUrl = cleanGenerationValue(input.imageUrl);
  const videoUrl = cleanGenerationValue(input.videoUrl);
  const analysisId = cleanGenerationValue(input.analysisId);

  if (videoUrl || analysisId) return "video-edit";
  if (imageUrl) return "image-to-video";
  if (requestedMode.includes("image-to-video") && !imageUrl) return "text-to-video";
  if (requestedMode.includes("generate-from-scratch")) return "text-to-video";
  return "text-to-video";
}

export function buildCompiledGenerationPrompt(body: Record<string, any>) {
  const durationPlan = buildDurationPlan(body);
  const lines: string[] = [];
  const push = (label: string, value: unknown) => {
    const text = cleanGenerationValue(value);
    if (text) lines.push(`${label}: ${text}`);
  };

  if (durationPlan.workflowMode === "freestyle-draft") {
    push("Draft mode", "Freestyle brainstorming clip. Prioritize fast cheap sample output over final production polish.");
  }

  push("Main concept", body.mainPrompt || body.prompt || body.description);
  push("Scene", body.scene);
  push("Subject", body.subject);
  push("Environment", body.environment);
  push("Emotional intent", body.emotionalIntent || body.intent);
  push("Mood", body.mood);

  const camera = body.camera || {};
  push("Shot type", camera.shotType);
  push("Camera position", camera.cameraPosition);
  push("Camera movement", camera.cameraMovement);
  push("Lens", camera.lens);
  push("Depth of field", camera.depthOfField);
  push("Composition", camera.composition);

  const lighting = body.lighting || {};
  push("Primary lighting", lighting.primaryLighting);
  push("Accent lighting", lighting.accentLighting);
  push("Rim light", lighting.rimLight);
  push("Atmosphere", lighting.atmosphere);

  const motion = body.motion || {};
  push("Character motion", motion.characterMotion);
  push("Environment motion", motion.environmentMotion);
  push("Motion quality", motion.motionQuality);

  const style = body.style || {};
  push("Visual style", style.visualStyle);
  push("Film reference", style.filmReference || style.filmReferenceStyle);
  push("Production design", style.productionDesign);
  push("Human realism", style.humanRealism);

  const script = body.scriptPerformance || body.performance || {};
  push("Spoken intent", script.spokenIntent);
  push("Pre-script line", script.preScript || script.spokenLine || script.line);
  push("Performance beat", script.performanceBeat);
  push("Gesture direction", script.gestureDirection);
  push("Facial expression", script.facialExpression);
  push("Lip-sync need", script.lipSyncNeed);
  push("Duration target", script.durationTarget);
  push("Voiceover use later", script.voiceoverUseLater);

  if (durationPlan.workflowMode === "structured-production") {
    push("Requested final duration", `${durationPlan.requestedDurationSeconds} seconds`);
    push("Provider max clip duration", `${durationPlan.providerMaxClipSeconds} seconds`);
    push("Long-video plan", durationPlan.requiresStitching ? `${durationPlan.clipCount} clips required; route to stitching/composition pipeline after visual generation.` : "Single clip fits selected provider limit.");
  } else {
    push("Draft duration", `${durationPlan.clipDurationSeconds} seconds`);
    push("Draft behavior", "Bypass required structured fields; generate one low-cost idea sample unless user upgrades to structured production.");
  }

  return lines.join("\n");
}
export const buildCompiledPrompt = buildCompiledGenerationPrompt;
export const normalizeGenerationMode = resolveGenerationMode;
