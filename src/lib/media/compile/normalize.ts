import { MEDIA_BOILERPLATE_PREFIXES } from "../constants";
import type { NormalizedMediaPrompt, PromptTokens } from "../types";

function stripBoilerplate(input: string): string {
  return MEDIA_BOILERPLATE_PREFIXES.reduce(
    (acc, pattern) => acc.replace(pattern, ""),
    input,
  ).trim();
}

function extractMatches(input: string, terms: string[]): string[] {
  const lower = input.toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase()));
}

function extractExplicitNegatives(input: string): string[] {
  const lower = input.toLowerCase();
  const known = [
    "no people",
    "no text",
    "no watermark",
    "no dialogue",
    "no music",
    "no camera movement",
    "no buildings",
    "no cars",
    "no animals",
  ];
  return known.filter((item) => lower.includes(item));
}

export function normalizeMediaPrompt(rawPrompt: string): NormalizedMediaPrompt {
  const subjectPrompt = stripBoilerplate(rawPrompt.trim());
  const normalizedPrompt = subjectPrompt.toLowerCase();

  const tokens: PromptTokens = {
    subjects: subjectPrompt
      .split(/[,\s]+/)
      .map((v) => v.trim())
      .filter(Boolean),
    peopleTerms: extractMatches(normalizedPrompt, [
      "person", "people", "woman", "man", "girl", "boy", "portrait",
      "face", "human", "couple", "model", "subject",
    ]),
    productTerms: extractMatches(normalizedPrompt, [
      "product", "bottle", "shoe", "watch", "perfume", "phone",
      "packaging", "device", "chair", "object",
    ]),
    foodTerms: extractMatches(normalizedPrompt, [
      "food", "dish", "burger", "pizza", "salad", "cake",
      "dessert", "coffee", "drink", "meal",
    ]),
    architectureTerms: extractMatches(normalizedPrompt, [
      "building", "house", "room", "interior", "kitchen", "bedroom",
      "office", "hallway", "architecture", "exterior",
    ]),
    macroTerms: extractMatches(normalizedPrompt, [
      "macro", "close detail", "microscopic", "tiny", "close-up detail",
    ]),
    graphicTerms: extractMatches(normalizedPrompt, [
      "logo", "poster", "icon", "vector", "graphic", "motion graphic",
    ]),
    illustrationTerms: extractMatches(normalizedPrompt, [
      "illustration", "drawing", "anime", "cartoon", "painting",
    ]),
    conceptTerms: extractMatches(normalizedPrompt, [
      "concept art", "fantasy", "sci-fi", "epic", "cinematic concept",
    ]),
    narrativeTerms: extractMatches(normalizedPrompt, [
      "story", "scene", "dialogue", "conversation", "narrative", "sequence",
    ]),
    styleTerms: extractMatches(normalizedPrompt, [
      "realistic", "cinematic", "photo", "photograph", "animated",
    ]),
    cameraTerms: extractMatches(normalizedPrompt, [
      "wide angle", "close-up", "portrait lens", "macro lens",
      "eye-level", "top-down", "drone",
    ]),
    lightingTerms: extractMatches(normalizedPrompt, [
      "daylight", "sunset", "sunrise", "golden hour", "night",
      "overcast", "studio", "candlelight",
    ]),
    motionTerms: extractMatches(normalizedPrompt, [
      "pan", "tracking", "push in", "pull back", "handheld",
      "dolly", "glide", "static", "tilt",
    ]),
    audioTerms: extractMatches(normalizedPrompt, [
      "voiceover", "dialogue", "music", "sound effects", "sfx", "lip sync",
    ]),
    explicitNegatives: extractExplicitNegatives(normalizedPrompt),
  };

  return { rawPrompt, subjectPrompt, normalizedPrompt, tokens };
}
