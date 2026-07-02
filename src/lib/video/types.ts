/**
 * src/lib/video/types.ts
 *
 * Shared type contracts for the video runtime layer.
 * All video execution paths (assistant, API, pipeline) use these types.
 * No provider-specific types leak into this layer.
 */

// ── Scene spec ────────────────────────────────────────────────────────────

/**
 * A single planned scene within a long-video job.
 *
 * Important: each provider submission is independent. Continuity information
 * must travel with every scene prompt, not only with the parent prompt.
 */
export type VideoSceneSpec = {
  sceneIndex: number;
  prompt: string;
  durationSeconds: number;
  imageUrl?: string; // for i2v scenes only
  /** Stable world/character/camera/lighting rules repeated on every provider submission. */
  sequenceSetup?: string;
  /** Scene-specific location/set rules. Changes only when the story intentionally changes set. */
  sceneSetup?: string;
  /** Short continuity handoff from the previous clip to reduce drift in independent submissions. */
  previousSceneSummary?: string;
  /** Intended continuity handoff into the next clip. */
  nextSceneSummary?: string;
  /** Group key for clips that share the same screen/set/environment. */
  setId?: string;
};

// ── Scene batch job ───────────────────────────────────────────────────────

/** Input to submitSceneBatch — all scenes for one long-video run. */
export type LongVideoSubmission = {
  parentGenerationId: string;
  workspaceId: string;
  scenes: VideoSceneSpec[];
  provider: string;
  model: string | null;
  type: "video" | "i2v";
  /** Parent-level continuity lock repeated into every child clip prompt. */
  sequenceSetup?: string;
};

/** Record created in DB for each submitted scene clip. */
export type SceneJobRecord = {
  generationId: string;
  sceneIndex: number;
  externalId: string;
};

// ── Stitch result ─────────────────────────────────────────────────────────

export type StitchResult =
  | { status: "completed"; outputUrl: string }
  | { status: "failed"; reason: string };

// ── Scene sibling check ───────────────────────────────────────────────────

/** Shape of a sibling scene row when checking parent completion. */
export type SceneSiblingRow = {
  id: string;
  status: string;
  output_url: string | null;
  scene_index: number | null;
};
