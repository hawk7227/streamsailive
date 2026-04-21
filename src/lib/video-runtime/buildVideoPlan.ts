/**
 * src/lib/video-runtime/buildVideoPlan.ts
 *
 * Builds a typed VideoPlan from a NormalizedVideoRequest.
 * For longform: splits into scene clips based on Story Bible timeline.
 * For single clip: one clip with the full prompt.
 * Pure function — no side effects.
 */

import { buildStoryBible } from "@/lib/story/storyBible";
import type { NormalizedVideoRequest, VideoPlan, ClipSpec } from "./types";

const VIDEO_NEGATIVE =
  "uncanny motion, identity drift, face drift, background warping, melting shapes, " +
  "floating props, stylized cinematic glow, oversmoothed textures, AI smear, rubber motion";

const CLIP_MAX_SECONDS = 8;
const CLIP_MIN_SECONDS = 3;
const LONGFORM_MAX_CLIPS = 8;

function buildSingleClip(req: NormalizedVideoRequest): ClipSpec {
  return {
    clipIndex: 0,
    prompt: req.prompt,
    durationSeconds: Math.min(req.durationSeconds, CLIP_MAX_SECONDS),
    referenceImageUrl: req.imageUrl,
  };
}

function buildLongformClips(req: NormalizedVideoRequest): ClipSpec[] {
  const storyBible = req.storyBible
    ? buildStoryBible({
        title: "Video Story Bible",
        storyText: req.storyBible,
        sourceKind: "synthetic",
      })
    : null;

  const beats: string[] =
    storyBible?.timeline?.length
      ? storyBible.timeline
      : [
          req.prompt,
          `${req.prompt}. Continue with stable environment and natural movement.`,
        ];

  const targetClipCount = Math.min(
    Math.ceil(req.durationSeconds / CLIP_MAX_SECONDS),
    Math.min(beats.length, LONGFORM_MAX_CLIPS),
  );

  const selectedBeats = beats.slice(0, targetClipCount);
  const perClipSeconds = Math.min(
    Math.max(
      Math.round(req.durationSeconds / selectedBeats.length),
      CLIP_MIN_SECONDS,
    ),
    CLIP_MAX_SECONDS,
  );

  return selectedBeats.map((beat, index) => ({
    clipIndex: index,
    prompt: [
      beat,
      "Real-world captured footage. Natural handheld movement.",
      "Physically plausible motion and stable identity.",
    ].join(" "),
    durationSeconds: perClipSeconds,
    // Only first clip gets the reference image for i2v longform
    referenceImageUrl: index === 0 ? req.imageUrl : undefined,
  }));
}

export function buildVideoPlan(req: NormalizedVideoRequest): VideoPlan {
  const useMultiClip =
    req.longVideo && req.durationSeconds > CLIP_MAX_SECONDS;

  const clips: ClipSpec[] = useMultiClip
    ? buildLongformClips(req)
    : [buildSingleClip(req)];

  return {
    mode: req.mode,
    provider: req.provider,
    model: req.model,
    durationSeconds: req.durationSeconds,
    aspectRatio: req.aspectRatio,
    clips,
    negativePrompt: VIDEO_NEGATIVE,
    requiresStitching: clips.length > 1,
  };
}
