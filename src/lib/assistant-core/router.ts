import type { AssistantMode, NormalizedAssistantRequest } from "./contracts";

export function routeRequest(req: NormalizedAssistantRequest): AssistantMode {
  const text = (req.userText || "").toLowerCase().trim();

  if (!text) return "chat";

  if (
    /\b(generate image|create image|make image|image|photo|picture|banner|thumbnail|mockup)\b/i.test(text)
  ) {
    return "image";
  }

  if (
    /\b(video|clip|scene|shot|storyboard|story video|image to video|i2v|animate)\b/i.test(text)
  ) {
    return "video";
  }

  if (
    /\b(build|code|repo|patch|fix|typescript|javascript|react|next|debug|compile|bug)\b/i.test(text)
  ) {
    return "build";
  }

  if (
    /\b(read file|write file|edit file|workspace|folder|directory|open file)\b/i.test(text)
  ) {
    return "file";
  }

  return "chat";
}
