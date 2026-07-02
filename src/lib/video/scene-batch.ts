/**
 * src/lib/video/scene-batch.ts
 *
 * Submits a long-video job as ordered scene clips to fal.ai queue.
 * Each scene becomes an independent DB generation row with parent_id linkage.
 *
 * Constraints:
 * - Only called from executeMediaGeneration when longVideo: true
 * - Uses sentinel user_id (same pattern as image path)
 * - Scenes are submitted in order, not parallel, because every provider call is
 *   independent and must preserve sequence/set continuity.
 * - Individual scene failures are logged and skipped — not fatal to the batch
 * - Requires parent_id and scene_index columns (migration: 20260420_video_scene_tracking.sql)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { FAL_VIDEO_MODELS, falQueueSubmit, type FalVideoModelKey } from "@/lib/ai/providers/fal";
import type { LongVideoSubmission, SceneJobRecord, VideoSceneSpec } from "./types";

const SENTINEL_USER_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_MODEL: FalVideoModelKey = "kling-v3";

function compactJoin(parts: Array<string | undefined | null>): string {
  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function buildContinuityLockedPrompt(scene: VideoSceneSpec, job: LongVideoSubmission): string {
  const sequenceSetup = scene.sequenceSetup || job.sequenceSetup;
  const setContinuity = scene.setId
    ? `SET CONTINUITY ID: ${scene.setId}. If this set ID matches nearby clips, preserve the same environment, layout, props, lighting direction, camera language, wardrobe, and subject identity.`
    : "SET CONTINUITY ID: default. Preserve the established environment unless this clip explicitly changes location.";

  return compactJoin([
    "LONG VIDEO CONTINUITY LOCK. This clip is submitted as a separate provider job, so repeat and obey the shared setup exactly.",
    sequenceSetup ? `GLOBAL SEQUENCE SETUP:\n${sequenceSetup}` : undefined,
    setContinuity,
    scene.sceneSetup ? `CURRENT SCENE SETUP:\n${scene.sceneSetup}` : undefined,
    scene.previousSceneSummary ? `PREVIOUS CLIP HANDOFF:\n${scene.previousSceneSummary}` : undefined,
    `CURRENT CLIP ${scene.sceneIndex + 1} PROMPT:\n${scene.prompt}`,
    scene.nextSceneSummary ? `NEXT CLIP HANDOFF:\n${scene.nextSceneSummary}` : undefined,
    [
      "CONTINUITY RULES:",
      "- Do not redesign the subject, wardrobe, room, car, street, props, time of day, lens feel, or lighting unless CURRENT SCENE SETUP says the set changes.",
      "- If the scene continues in the same set, treat it like the next shot from the same film, not a new unrelated video.",
      "- Keep camera physics, shadows, reflections, scale, and motion believable.",
      "- Avoid identity drift, environment drift, wardrobe drift, prop drift, sudden weather changes, sudden time-of-day changes, and random new background elements.",
    ].join("\n"),
  ]);
}

// ── Per-provider body builders ────────────────────────────────────────────
// Mirrors FalProvider private methods — kept here to avoid coupling to
// a class instance. Logic must stay in sync with fal.ts if models change.

function buildSceneBody(
  scene: VideoSceneSpec,
  job: LongVideoSubmission,
  modelKey: FalVideoModelKey,
  type: "video" | "i2v",
): Record<string, unknown> {
  const duration = String(Math.min(Math.max(scene.durationSeconds, 3), 15));
  const aspectRatio = "16:9";
  const prompt = buildContinuityLockedPrompt(scene, job);
  const negativePrompt = [
    "blur",
    "distort",
    "low quality",
    "identity drift",
    "scene drift",
    "environment drift",
    "wardrobe drift",
    "random new props",
    "different room layout",
    "different car model",
    "lighting mismatch",
    "time of day mismatch",
  ].join(", ");

  if (modelKey === "kling-v3") {
    const body: Record<string, unknown> = {
      prompt,
      duration,
      aspect_ratio: aspectRatio,
      generate_audio: true,
      negative_prompt: negativePrompt,
      cfg_scale: 0.5,
    };
    if (type === "i2v" && scene.imageUrl) {
      body.start_image_url = scene.imageUrl;
    }
    return body;
  }

  // veo-3.1 (verified fal model)
  const veoDuration =
    scene.durationSeconds <= 4 ? "4s"
    : scene.durationSeconds <= 6 ? "6s"
    : "8s";

  const body: Record<string, unknown> = {
    prompt,
    duration: veoDuration,
    aspect_ratio: type === "i2v" ? "auto" : aspectRatio,
    resolution: "720p",
    generate_audio: true,
    safety_tolerance: "4",
    auto_fix: true,
  };

  if (type === "i2v" && scene.imageUrl) {
    body.image_url = scene.imageUrl;
  }

  return body;
}

async function submitOneScene(
  scene: VideoSceneSpec,
  job: LongVideoSubmission,
  modelKey: FalVideoModelKey,
  modelDef: (typeof FAL_VIDEO_MODELS)[FalVideoModelKey],
): Promise<SceneJobRecord> {
  const modelId = job.type === "i2v" ? modelDef.i2v : modelDef.t2v;
  const body = buildSceneBody(scene, job, modelKey, job.type);

  const { responseUrl } = await falQueueSubmit(modelId, body);
  const externalId = `fal_queue:${responseUrl}`;

  const admin = createAdminClient();
  const generationId = crypto.randomUUID();

  const { error } = await admin.from("generations").insert({
    id: generationId,
    user_id: SENTINEL_USER_ID,
    workspace_id: job.workspaceId,
    type: job.type,
    prompt: String(body.prompt || scene.prompt),
    status: "pending",
    external_id: externalId,
    parent_id: job.parentGenerationId,
    scene_index: scene.sceneIndex,
    provider: "fal",
    model: modelKey,
    mode: "assistant",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    // DB write failed — scene is submitted to fal but won't be tracked.
    // Log it so the job can be manually recovered if needed.
    console.error(JSON.stringify({
      level: "error",
      event: "SCENE_DB_INSERT_FAILED",
      parentGenerationId: job.parentGenerationId,
      sceneIndex: scene.sceneIndex,
      externalId,
      reason: error.message,
    }));
  }

  return { generationId, sceneIndex: scene.sceneIndex, externalId };
}

/**
 * Submit all scenes in the batch to fal.ai queue and insert DB rows.
 * Returns successfully submitted scene records.
 * Partial success is acceptable — the cron will skip scenes without DB rows.
 */
export async function submitSceneBatch(
  job: LongVideoSubmission,
): Promise<SceneJobRecord[]> {
  const modelKey = (job.model as FalVideoModelKey | null) ?? DEFAULT_MODEL;
  const modelDef = FAL_VIDEO_MODELS[modelKey] ?? FAL_VIDEO_MODELS[DEFAULT_MODEL];
  const orderedScenes = [...job.scenes].sort((a, b) => a.sceneIndex - b.sceneIndex);
  const records: SceneJobRecord[] = [];

  for (const scene of orderedScenes) {
    try {
      const record = await submitOneScene(scene, job, modelKey, modelDef);
      records.push(record);
    } catch (reason) {
      console.error(JSON.stringify({
        level: "error",
        event: "SCENE_SUBMIT_FAILED",
        parentGenerationId: job.parentGenerationId,
        sceneIndex: scene.sceneIndex,
        reason:
          reason instanceof Error
            ? reason.message
            : String(reason),
      }));
    }
  }

  return records;
}
