import type { RuntimeMode } from "./types";

export function getModeFallbackLabel(mode?: RuntimeMode): string | null {
  switch (mode) {
    case "build":
      return "Building…";
    case "image":
      return "Creating image…";
    case "video":
      return "Generating video…";
    case "audio":
      return "Creating audio…";
    case "files":
      return "Looking through your files…";
    case "document":
      return "Creating file…";
    case "search":
      return "Searching…";
    case "conversation":
    default:
      return "Thinking…";
  }
}
