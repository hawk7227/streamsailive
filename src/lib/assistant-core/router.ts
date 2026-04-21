import type { AssistantMode, NormalizedAssistantRequest } from "./contracts";
import { isMetaCapabilityQuery } from "./metaQuerySignals";

export function routeRequest(req: NormalizedAssistantRequest): AssistantMode {
  const text = (req.userText || "").toLowerCase().trim();

  if (!text) return "chat";

  // Explicit client-side mode override — when the user has selected a mode chip
  // (image/video/build), honour it directly without text pattern matching.
  // This makes the input mode chips functional end-to-end.
  const clientMode = typeof req.context?.inputMode === "string" ? req.context.inputMode : null;
  if (clientMode === "image") return "image";
  if (clientMode === "video") return "video";
  if (clientMode === "build") return "build";

  // Meta/capability queries ("what can you do", "who are you", etc.) always
  // resolve to chat route. Model selection (full model) and system prompt
  // override (buildCapabilityMetaPrompt) are handled downstream.
  if (isMetaCapabilityQuery(text)) return "chat";

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
