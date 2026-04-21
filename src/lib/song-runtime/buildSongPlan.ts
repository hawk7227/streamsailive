/**
 * src/lib/song-runtime/buildSongPlan.ts
 *
 * Builds a complete, structured SongPlan from a NormalizedSongRequest.
 * Pure function — no side effects, no DB, no provider calls.
 *
 * Decisions made here:
 * - Mode: instrumental or vocal
 * - Song structure: which sections, in what order
 * - Per-section prompt guidance
 * - Per-section duration target
 * - Style summary string for the provider
 * - Whether stems are required
 * - Output format
 *
 * Does NOT:
 * - Submit to provider
 * - Write DB state
 * - Upload artifacts
 */

import type { NormalizedSongRequest, SongPlan, SongSection } from "./types";

// ── Section duration budget ───────────────────────────────────────────────
// Distributes total duration across sections by weight.
// Chorus and verse get more time than intro/bridge/outro.

const SECTION_WEIGHTS: Record<string, number> = {
  intro: 0.10,
  verse: 0.25,
  chorus: 0.30,
  bridge: 0.10,
  outro: 0.10,
};

function allocateSectionDuration(
  sectionName: string,
  totalSeconds: number,
  sectionCount: number,
): number {
  const weight = SECTION_WEIGHTS[sectionName] ?? (1 / sectionCount);
  return Math.max(5, Math.round(totalSeconds * weight));
}

// ── Style summary builder ─────────────────────────────────────────────────

function buildStyleSummary(req: NormalizedSongRequest): string {
  const parts: string[] = [];
  if (req.genre) parts.push(req.genre);
  if (req.mood) parts.push(req.mood);
  if (req.tempo) parts.push(req.tempo + " tempo");
  if (req.voiceStyle && !req.instrumental) parts.push(req.voiceStyle + " vocals");
  if (req.instrumental) parts.push("instrumental");
  return parts.length > 0 ? parts.join(", ") : "contemporary";
}

// ── Section prompt builder ────────────────────────────────────────────────

function buildSectionPrompt(
  sectionName: string,
  styleSummary: string,
  basePrompt: string,
  mode: "instrumental" | "vocal",
): string {
  const modeHint = mode === "instrumental"
    ? "No lyrics. Focus on musical texture and instrumentation."
    : "Lyrical and melodic.";

  switch (sectionName) {
    case "intro":
      return `${styleSummary} intro — establish the mood and sonic identity. ${modeHint} Based on: ${basePrompt}`;
    case "verse":
      return `${styleSummary} verse — develop the narrative or melodic theme. ${modeHint} Based on: ${basePrompt}`;
    case "chorus":
      return `${styleSummary} chorus — high energy, memorable hook, peak emotional moment. ${modeHint} Based on: ${basePrompt}`;
    case "bridge":
      return `${styleSummary} bridge — contrast and emotional shift before the final chorus. ${modeHint} Based on: ${basePrompt}`;
    case "outro":
      return `${styleSummary} outro — bring the song to a satisfying close. ${modeHint} Based on: ${basePrompt}`;
    default:
      return `${styleSummary} — ${basePrompt}. ${modeHint}`;
  }
}

// ── Section structure decisions ───────────────────────────────────────────

function decideSections(instrumental: boolean, durationSeconds: number): string[] {
  if (durationSeconds <= 30) {
    // Short: simplified structure
    return instrumental
      ? ["intro", "verse", "outro"]
      : ["intro", "verse", "chorus", "outro"];
  }

  if (durationSeconds <= 120) {
    // Standard structure
    return instrumental
      ? ["intro", "verse", "chorus", "bridge", "outro"]
      : ["intro", "verse", "chorus", "verse", "chorus", "outro"];
  }

  // Extended: full structure with bridge
  return instrumental
    ? ["intro", "verse", "chorus", "verse", "bridge", "chorus", "outro"]
    : ["intro", "verse", "chorus", "verse", "chorus", "bridge", "chorus", "outro"];
}

// ── Public builder ────────────────────────────────────────────────────────

export function buildSongPlan(req: NormalizedSongRequest): SongPlan {
  const mode: "instrumental" | "vocal" = req.instrumental ? "instrumental" : "vocal";
  const styleSummary = buildStyleSummary(req);
  const sectionNames = decideSections(req.instrumental, req.durationSeconds);

  const sections: SongSection[] = sectionNames.map((sectionName) => ({
    section: sectionName as SongSection["section"],
    prompt: buildSectionPrompt(sectionName, styleSummary, req.prompt, mode),
    durationSeconds: allocateSectionDuration(sectionName, req.durationSeconds, sectionNames.length),
  }));

  return {
    mode,
    provider: req.provider,
    model: req.model,
    durationSeconds: req.durationSeconds,
    outputFormat: req.outputFormat,
    requireStems: req.requireStems,
    styleSummary,
    lyrics: req.lyrics,
    sections,
  };
}
