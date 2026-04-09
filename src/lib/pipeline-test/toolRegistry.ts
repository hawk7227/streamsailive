import { ToolSelection, ToolMode } from "./types";

export function selectTools(mode: ToolMode): ToolSelection[] {
  if (mode === "cheapest") {
    return [
      { tool: "flux", purpose: "image" },
      { tool: "runway", purpose: "video" },
      { tool: "speech-to-text", purpose: "transcript" },
      { tool: "demucs", purpose: "audio" },
    ];
  }

  if (mode === "quality") {
    return [
      { tool: "seedream", purpose: "image" },
      { tool: "runway", purpose: "video" },
      { tool: "speech-to-text", purpose: "transcript" },
      { tool: "demucs", purpose: "audio" },
    ];
  }

  return [
    { tool: "flux", purpose: "image" },
    { tool: "runway", purpose: "video" },
    { tool: "speech-to-text", purpose: "transcript" },
    { tool: "demucs", purpose: "audio" },
  ];
}
