import type { AssistantMode } from "./types";

const ACTION_TERMS = [
  "run pipeline",
  "run step",
  "open step config",
  "select concept",
  "approve output",
  "set niche",
  "generate image for",
  "generate video for",
  "apply this prompt",
  "trigger generation",
];

const VERIFICATION_TERMS = ["verify", "proof", "prove", "confirm", "audit", "working correctly", "real proof"];
const EXECUTION_TERMS = ["return json", "give me schema", "generate a json schema", "schema for", "return valid json"];
const BUILDER_TERMS = ["build", "implement", "fix", "write code", "refactor", "route", "production", "system architecture"];

export function detectModeFromText(text: string): AssistantMode {
  const lower = text.toLowerCase();
  if (ACTION_TERMS.some((term) => lower.includes(term))) return "action";
  if (VERIFICATION_TERMS.some((term) => lower.includes(term))) return "verification";
  if (EXECUTION_TERMS.some((term) => lower.includes(term))) return "execution";
  if (BUILDER_TERMS.some((term) => lower.includes(term))) return "builder";
  return "conversation";
}
