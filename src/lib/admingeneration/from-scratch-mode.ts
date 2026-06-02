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

export function buildFromScratchPrompt(input: Record<string, any>) {
  const out: string[] = [];
  const push = (label: string, value: unknown) => {
    const v = clean(value);
    if (v) out.push(`${label}: ${v}`);
  };

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

  const output = input.outputSettings || input.output || {};
  push("Duration", output.duration);
  push("Aspect ratio", output.aspectRatio);
  push("Frame rate", output.frameRate);
  push("Quality goal", output.qualityGoal);

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
