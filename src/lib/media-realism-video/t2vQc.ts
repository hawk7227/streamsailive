/**
 * t2vQc.ts
 *
 * Per spec: QC scoring for T2V (scratch video) candidates.
 * Dimensions: face stability, flicker, warp, temporal consistency, anti-cinematic.
 * Reject if totalScore < T2V_QC_PASS_THRESHOLD (0.9).
 *
 * Detection functions are hooks — currently return baseline scores.
 * Real CV (frame extraction, landmark detection) can be plugged in
 * without changing the scoring contract.
 */

import type { FrameAnalysis, T2VQcScore } from "./types";
import { T2V_QC_PASS_THRESHOLD } from "./types";

// ── Score weights ──────────────────────────────────────────────────────────

const WEIGHTS = {
  faceStability: 0.28,        // most important — identity preservation
  motionNaturalness: 0.22,    // no jitter or stuttering
  artifactScore: 0.20,        // no warp or distortion
  temporalConsistency: 0.18,  // no lighting flicker
  antiCinematicScore: 0.12,   // reject stylized/polished output
} as const;

// ── Detection hooks ────────────────────────────────────────────────────────
// These are the integration points for real CV.
// Each takes frame data and returns a 0-1 score (1 = clean, 0 = fail).

function detectFaceDrift(frames: FrameAnalysis): number {
  // Hook: landmark tracking across frames
  // Returns 1.0 until real CV is wired
  if (!frames.facesDetected) return 1.0; // no face = not applicable
  return 1.0;
}

function detectFlicker(frames: FrameAnalysis): number {
  // Hook: per-frame luminance variance detection
  if (frames.consistencyScores.length === 0) return 1.0;
  const avgConsistency = frames.consistencyScores.reduce((a, b) => a + b, 0) / frames.consistencyScores.length;
  return Math.max(0, Math.min(1, avgConsistency));
}

function detectWarp(frames: FrameAnalysis): number {
  // Hook: optical flow / background distortion detection
  return 1.0;
}

function detectTemporalConsistency(frames: FrameAnalysis): number {
  // Hook: scene-level consistency (lighting, color space, background)
  if (frames.consistencyScores.length < 2) return 1.0;
  const min = Math.min(...frames.consistencyScores);
  return Math.max(0, min);
}

function detectCinematicLook(_frames: FrameAnalysis): number {
  // Hook: style classifier (contrast, saturation, color grading detection)
  // Returns 1.0 (ordinary) until real classifier is wired
  return 1.0;
}

// ── extractFrameAnalysis ───────────────────────────────────────────────────

/**
 * Placeholder frame extraction.
 * In production: extract frames from videoUrl, run CV, return analysis.
 * Currently returns a neutral analysis for the scoring hook to consume.
 */
export function extractFrameAnalysis(_videoUrl: string): FrameAnalysis {
  return {
    frameCount: 0,
    facesDetected: false,
    faceFrames: 0,
    consistencyScores: [],
  };
}

// ── scoreT2VCandidate ──────────────────────────────────────────────────────

export function scoreT2VCandidate(
  videoUrl: string,
  frameAnalysis?: FrameAnalysis,
): T2VQcScore {
  const frames = frameAnalysis ?? extractFrameAnalysis(videoUrl);
  const rejectionReasons: string[] = [];

  const faceStability = detectFaceDrift(frames);
  const motionNaturalness = detectFlicker(frames);
  const artifactScore = detectWarp(frames);
  const temporalConsistency = detectTemporalConsistency(frames);
  const antiCinematicScore = detectCinematicLook(frames);

  // Collect individual failures
  if (faceStability < 0.85) rejectionReasons.push("face_drift");
  if (motionNaturalness < 0.85) rejectionReasons.push("motion_jitter");
  if (artifactScore < 0.85) rejectionReasons.push("background_warp");
  if (temporalConsistency < 0.85) rejectionReasons.push("lighting_flicker");
  if (antiCinematicScore < 0.85) rejectionReasons.push("looks_cinematic_or_stylized");

  const totalScore =
    Math.round(
      (faceStability * WEIGHTS.faceStability +
        motionNaturalness * WEIGHTS.motionNaturalness +
        artifactScore * WEIGHTS.artifactScore +
        temporalConsistency * WEIGHTS.temporalConsistency +
        antiCinematicScore * WEIGHTS.antiCinematicScore) *
        100,
    ) / 100;

  const passed = rejectionReasons.length === 0 && totalScore >= T2V_QC_PASS_THRESHOLD;

  return {
    faceStability,
    motionNaturalness,
    artifactScore,
    temporalConsistency,
    antiCinematicScore,
    totalScore,
    rejectionReasons,
    passed,
  };
}

export function shouldRejectT2VCandidate(score: T2VQcScore): boolean {
  return !score.passed;
}
