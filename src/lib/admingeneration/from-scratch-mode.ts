export type FrontendGenerationMode =
  | "generate-from-scratch"
  | "text-to-image"
  | "image-to-video"
  | "text-to-video"
  | "voice-captions"
  | "snap-pic-click"
  | "motion-graphics"
  | "ai-writers"
  | "idea-to-launch";

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const DEFAULT_PROVIDER_MAX_CLIP_SECONDS = 10;
const DEFAULT_DRAFT_CLIP_SECONDS = 5;

type WorkflowMode = "structured-production" | "freestyle-draft";

function resolveWorkflowMode(input: Record<string, any>): WorkflowMode {
  const mode = clean(input.workflowMode).toLowerCase();
  if (mode.includes("freestyle") || mode.includes("draft")) return "freestyle-draft";
  if (input.freestyle === true || input.draft === true) return "freestyle-draft";
  return "structured-production";
}

function parseDurationSeconds(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  const text = clean(value).toLowerCase();
  if (!text) return 0;
  const minuteMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:m|min|minute|minutes)/);
  if (minuteMatch) return Math.round(Number(minuteMatch[1]) * 60);
  const secondMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|second|seconds)/);
  if (secondMatch) return Math.round(Number(secondMatch[1]));
  if (/^\d+$/.test(text)) return Number(text);
  return 0;
}

function resolveProviderMaxClipSeconds(input: Record<string, any>) {
  const provider = clean(input.provider || input.providerFamily).toLowerCase();
  const model = clean(input.model || input.providerModel).toLowerCase();
  const output = input.outputSettings || input.output || {};
  const explicit = parseDurationSeconds(input.maxClipSeconds || output.maxClipSeconds);
  if (explicit) return explicit;
  if (provider.includes("kling") || model.includes("kling")) return 10;
  if (provider.includes("veo") || model.includes("veo")) return 8;
  if (provider.includes("runway") || model.includes("runway")) return 10;
  return DEFAULT_PROVIDER_MAX_CLIP_SECONDS;
}

function buildDurationPlan(input: Record<string, any>) {
  const workflowMode = resolveWorkflowMode(input);
  const output = input.outputSettings || input.output || {};
  const direct = parseDurationSeconds(input.durationSeconds || input.duration || output.durationSeconds || output.duration);
  const promptText = [input.mainPrompt, input.prompt, input.description].map(clean).join(" ");
  const requestedDurationSeconds = direct || parseDurationSeconds(promptText) || (workflowMode === "freestyle-draft" ? DEFAULT_DRAFT_CLIP_SECONDS : DEFAULT_PROVIDER_MAX_CLIP_SECONDS);
  const providerMaxClipSeconds = resolveProviderMaxClipSeconds(input);
  const clipCount = Math.max(1, Math.ceil(requestedDurationSeconds / providerMaxClipSeconds));
  return {
    workflowMode,
    requestedDurationSeconds,
    providerMaxClipSeconds,
    clipCount,
    requiresStitching: workflowMode === "structured-production" && clipCount > 1,
    clipDurationSeconds: workflowMode === "freestyle-draft" ? Math.min(requestedDurationSeconds, DEFAULT_DRAFT_CLIP_SECONDS) : providerMaxClipSeconds,
  };
}

export function buildFromScratchPrompt(input: Record<string, any>) {
  const durationPlan = buildDurationPlan(input);
  const out: string[] = [];
  const push = (label: string, value: unknown) => {
    const v = clean(value);
    if (v) out.push(`${label}: ${v}`);
  };

  if (durationPlan.workflowMode === "freestyle-draft") {
    push("Draft mode", "Freestyle brainstorming clip. Prioritize fast cheap sample output over final production polish.");
  }

  push("Main concept", input.mainPrompt || input.prompt || input.description);
  push("Scene", input.scene);
  push("Subject", input.subject);
  push("Environment", input.environment);
  push("Emotional intent", input.emotionalIntent || input.intent);

  const camera = input.camera || {};
  push("Shot type", camera.shotType);
  push("Camera position", camera.cameraPosition);
  push("Camera movement", camera.cameraMovement);
  push("Lens", camera.lens);
  push("Depth of field", camera.depthOfField);
  push("Composition", camera.composition);

  const lighting = input.lighting || {};
  push("Primary lighting", lighting.primaryLighting);
  push("Accent lighting", lighting.accentLighting);
  push("Rim light", lighting.rimLight);
  push("Atmosphere", lighting.atmosphere);

  const motion = input.motion || {};
  push("Character motion", motion.characterMotion);
  push("Environment motion", motion.environmentMotion);
  push("Motion quality", motion.motionQuality);

  const style = input.style || {};
  push("Visual style", style.visualStyle);
  push("Film reference", style.filmReferenceStyle || style.filmReference);
  push("Production design", style.productionDesign);
  push("Human realism", style.humanRealism);

  push("Mood", input.mood || style.mood);

  const script = input.scriptPerformance || input.performance || {};
  push("Spoken intent", script.spokenIntent);
  push("Pre-script line", script.preScript || script.spokenLine || script.line);
  push("Performance beat", script.performanceBeat);
  push("Gesture direction", script.gestureDirection);
  push("Facial expression", script.facialExpression);
  push("Lip-sync need", script.lipSyncNeed);
  push("Duration target", script.durationTarget);
  push("Voiceover use later", script.voiceoverUseLater);

  const output = input.outputSettings || input.output || {};
  push("Duration", output.duration);
  push("Aspect ratio", output.aspectRatio);
  push("Frame rate", output.frameRate);
  push("Quality goal", output.qualityGoal);

  if (durationPlan.workflowMode === "structured-production") {
    push("Requested final duration", `${durationPlan.requestedDurationSeconds} seconds`);
    push("Provider max clip duration", `${durationPlan.providerMaxClipSeconds} seconds`);
    push("Long-video plan", durationPlan.requiresStitching ? `${durationPlan.clipCount} clips required; route to stitching/composition pipeline after visual generation.` : "Single clip fits selected provider limit.");
  } else {
    push("Draft duration", `${durationPlan.clipDurationSeconds} seconds`);
    push("Draft behavior", "Bypass required structured fields; generate one low-cost idea sample unless user upgrades to structured production.");
  }

  return out.join("\n");
}

export function resolveFrontendGenerationMode(input: {
  selectedMode?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  analysisId?: string | null;
}) {
  const selectedMode = clean(input.selectedMode);
  const imageUrl = clean(input.imageUrl);
  const videoUrl = clean(input.videoUrl);
  const analysisId = clean(input.analysisId);

  if (videoUrl || analysisId) return "video-edit";
  if (selectedMode === "generate-from-scratch") return "text-to-video";
  if (selectedMode === "image-to-video" && imageUrl) return "image-to-video";
  if (selectedMode === "image-to-video" && !imageUrl) return "text-to-video";
  if (selectedMode === "text-to-video") return "text-to-video";
  if (imageUrl) return "image-to-video";
  return "text-to-video";
}
