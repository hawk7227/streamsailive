import type { AssistantMode, NormalizedAssistantRequest } from "./contracts";

export function routeRequest(req: NormalizedAssistantRequest): AssistantMode {
  const text = (req.userText || "").toLowerCase().trim();

  if (!text) return "chat";

  if (
    /\b(image|photo|picture|banner|thumbnail|mockup|generate image|create image)\b/i.test(
      text,
    )
  ) {
    return "image";
  }

  if (
    /\b(build|code|repo|patch|fix|typescript|javascript|react|next|debug|compile|error|bug)\b/i.test(
      text,
    )
  ) {
    return "build";
  }

  if (
    /\b(file|read file|write file|edit file|workspace|folder|directory|open file)\b/i.test(
      text,
    )
  ) {
    return "file";
  }

  return "chat";
}

