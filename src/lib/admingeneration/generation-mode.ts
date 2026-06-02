export type GenerationMode =
  | "text-to-video"
  | "image-to-video"
  | "video-edit";

export function cleanValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeRequestedModeLabel(value: unknown): string {
  const raw = cleanValue(value).toLowerCase();
  if (!raw) return "";
  if (raw.includes("image")) return "image-to-video";
  if (raw.includes("text")) return "text-to-video";
  if (raw.includes("video-edit")) return "video-edit";
  if (raw.includes("edit")) return "video-edit";
  return raw;
}

export function normalizeGenerationMode(input: {
  requestedMode?: unknown;
  imageUrl?: unknown;
  videoUrl?: unknown;
  analysisId?: unknown;
}): GenerationMode {
  const requestedMode = normalizeRequestedModeLabel(input.requestedMode);
  const imageUrl = cleanValue(input.imageUrl);
  const videoUrl = cleanValue(input.videoUrl);
  const analysisId = cleanValue(input.analysisId);

  if (videoUrl || analysisId) return "video-edit";
  if (imageUrl) return "image-to-video";
  if (requestedMode === "video-edit") return "video-edit";
  return "text-to-video";
}

export function buildCompiledPrompt(body: Record<string, any>): string {
  const lines: string[] = [];

  const push = (label: string, value: unknown) => {
    const text = cleanValue(value);
    if (text) lines.push(`${label}: ${text}`);
  };

  const mainPrompt =
    cleanValue(body.mainPrompt) ||
    cleanValue(body.prompt) ||
    cleanValue(body.description);

  push("Main concept", mainPrompt);
  push("Scene", body.scene);
  push("Subject", body.subject);
  push("Environment", body.environment);
  push("Emotional intent", body.emotionalIntent || body.intent);

  const camera = body.camera || {};
  const lighting = body.lighting || {};
  const motion = body.motion || {};
  const style = body.style || {};
  const output = body.outputSettings || body.output || {};

  push("Shot type", camera.shotType);
  push("Camera position", camera.cameraPosition);
  push("Camera movement", camera.cameraMovement);
  push("Lens", camera.lens);
  push("Depth of field", camera.depthOfField);
  push("Composition", camera.composition);

  push("Primary lighting", lighting.primaryLighting);
  push("Accent lighting", lighting.accentLighting);
  push("Rim light", lighting.rimLight);
  push("Atmosphere", lighting.atmosphere);

  push("Character motion", motion.characterMotion);
  push("Environment motion", motion.environmentMotion);
  push("Motion quality", motion.motionQuality);

  push("Visual style", style.visualStyle);
  push("Film reference", style.filmReferenceStyle || style.filmReference);
  push("Production design", style.productionDesign);
  push("Human realism", style.humanRealism);
  push("Mood", body.mood || style.mood);

  push("Duration", output.duration);
  push("Aspect ratio", output.aspectRatio);
  push("Frame rate", output.frameRate);
  push("Quality goal", output.qualityGoal);

  return lines.join("\n");
}
