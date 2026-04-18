import { MEDIA_LIGHTING_DEFAULTS } from "../constants";
import type {
  CameraLogic,
  DepthLogic,
  FramingLogic,
  LightingFamily,
  MediaIntent,
  NormalizedMediaPrompt,
} from "../types";

// ── Camera ─────────────────────────────────────────────────────────────────
export function selectCamera(intent: MediaIntent): CameraLogic {
  switch (intent) {
    case "landscape":
      return {
        lens: "24mm wide-angle cinematic lens",
        viewpoint: "environmental distant viewpoint",
        notes: ["broad scene coverage", "stable perspective", "environment dominant"],
      };
    case "portrait":
      return {
        lens: "85mm portrait lens",
        viewpoint: "human eye-level viewpoint",
        notes: ["subject dominant", "facial readability", "natural perspective"],
      };
    case "product":
      return {
        lens: "100mm product lens",
        viewpoint: "catalog or three-quarter product viewpoint",
        notes: ["object clarity", "edge readability", "controlled perspective"],
      };
    case "food":
      return {
        lens: "65mm editorial lens",
        viewpoint: "table-height or three-quarter viewpoint",
        notes: ["dish readability", "plausible scale"],
      };
    case "architecture":
      return {
        lens: "24mm corrected wide lens",
        viewpoint: "level architectural viewpoint",
        notes: ["straight verticals", "spatial clarity"],
      };
    case "macro":
      return {
        lens: "100mm macro lens",
        viewpoint: "close detail viewpoint",
        notes: ["micro subject detail", "precision framing"],
      };
    default:
      return {
        lens: "neutral cinematic lens",
        viewpoint: "balanced viewpoint",
        notes: ["readable scene composition"],
      };
  }
}

// ── Framing ────────────────────────────────────────────────────────────────
export function selectFraming(intent: MediaIntent): FramingLogic {
  switch (intent) {
    case "landscape":
      return {
        compositionRules: [
          "balanced composition",
          "single dominant focal zone",
          "stable horizon if present",
        ],
        subjectRules: [
          "do not invent human subjects",
          "do not insert foreground props by default",
        ],
        environmentRules: [
          "environment occupies majority of frame",
          "avoid clutter",
        ],
      };
    case "portrait":
      return {
        compositionRules: [
          "single subject by default",
          "balanced subject placement",
          "avoid accidental bad crops",
        ],
        subjectRules: [
          "face remains readable",
          "do not add extra people unless requested",
        ],
        environmentRules: [
          "background supports subject",
          "background should not overpower subject",
        ],
      };
    case "product":
      return {
        compositionRules: [
          "single object by default",
          "clean centered composition",
          "full edge readability",
        ],
        subjectRules: [
          "do not duplicate object",
          "keep silhouette readable",
        ],
        environmentRules: [
          "uncluttered background",
          "background supports object clarity",
        ],
      };
    default:
      return {
        compositionRules: [
          "balanced composition",
          "single focal subject or zone",
          "readable framing",
        ],
        subjectRules: ["do not invent extra subjects unless requested"],
        environmentRules: ["avoid clutter"],
      };
  }
}

// ── Depth ──────────────────────────────────────────────────────────────────
export function selectDepth(intent: MediaIntent): DepthLogic {
  switch (intent) {
    case "landscape":
    case "architecture":
      return "deep focus";
    case "portrait":
      return "shallow depth of field";
    case "product":
      return "controlled selective focus";
    case "food":
      return "moderate depth of field";
    case "macro":
      return "narrow focal plane";
    case "graphic":
    case "illustration":
      return "not_applicable";
    default:
      return "moderate depth of field";
  }
}

// ── Lighting ───────────────────────────────────────────────────────────────
export function selectLighting(
  intent: MediaIntent,
  normalized: NormalizedMediaPrompt,
): LightingFamily {
  const prompt = normalized.normalizedPrompt;

  if (prompt.includes("sunset") || prompt.includes("sunrise") || prompt.includes("golden hour")) {
    return "golden hour natural light";
  }
  if (prompt.includes("overcast") || prompt.includes("cloudy")) {
    return "overcast daylight";
  }
  if (prompt.includes("studio") || prompt.includes("softbox")) {
    return "studio soft light";
  }
  if (prompt.includes("night") || prompt.includes("neon")) {
    return "night practical light";
  }

  return MEDIA_LIGHTING_DEFAULTS[intent] ?? "natural daylight";
}
