import type { ToolType } from "./types";

export function getToolLabel(tool: ToolType): string {
  switch (tool) {
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
      return "Processing…";
  }
}
