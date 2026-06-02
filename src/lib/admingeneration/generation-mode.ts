export function cleanGenerationValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
  const lines: string[] = [];
  const push = (label: string, value: unknown) => {
    const text = cleanGenerationValue(value);
    if (text) lines.push(`${label}: ${text}`);
  };

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

  return lines.join("\n");
}
