/**
 * src/lib/video/scene-batch.ts
 *
 * Submits a long-video job as ordered scene clips to fal.ai queue.
 * Each scene becomes an independent DB generation row with parent_id linkage.
 *
 * Constraints:
 * - Only called from executeMediaGeneration when longVideo: true
 * - Uses sentinel user_id (same pattern as image path)
 * - All scenes submitted in parallel via Promise.allSettled
 * - Individual scene failures are logged and skipped — not fatal to the batch
 * - Requires parent_id and scene_index columns (migration: 20260420_video_scene_tracking.sql)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { FAL_VIDEO_MODELS, falQueueSubmit, type FalVideoModelKey } from "@/lib/ai/providers/fal";
import type { LongVideoSubmission, SceneJobRecord, VideoSceneSpec } from "./types";

const SENTINEL_USER_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_MODEL: FalVideoModelKey = "kling-v3";

// ── Per-provider body builders ────────────────────────────────────────────
// Mirrors FalProvider private methods — kept here to avoid coupling to
// a class instance. Logic must stay in sync with fal.ts if models change.

function buildSceneBody(
  scene: VideoSceneSpec,
  modelKey: FalVideoModelKey,
  type: "video" | "i2v",
): Record<string, unknown> {
  const duration = String(Math.min(Math.max(scene.durationSeconds, 3), 15));
  const aspectRatio = "16:9";

  if (modelKey === "kling-v3") {
    const body: Record<string, unknown> = {
      prompt: scene.prompt,
      duration,
      aspect_ratio: aspectRatio,
      generate_audio: true,
      negative_prompt: "blur, distort, and low quality",
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
    prompt: scene.prompt,
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
  const body = buildSceneBody(scene, modelKey, job.type);

  const { responseUrl } = await falQueueSubmit(modelId, body);
  const externalId = `fal_queue:${responseUrl}`;

  const admin = createAdminClient();
  const generationId = crypto.randomUUID();

  const { error } = await admin.from("generations").insert({
    id: generationId,
    user_id: SENTINEL_USER_ID,
    workspace_id: job.workspaceId,
    type: job.type,
    prompt: scene.prompt,
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

  const results = await Promise.allSettled(
    job.scenes.map((scene) =>
      submitOneScene(scene, job, modelKey, modelDef),
    ),
  );

  const records: SceneJobRecord[] = [];

  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") {
      records.push(result.value);
    } else {
      console.error(JSON.stringify({
        level: "error",
        event: "SCENE_SUBMIT_FAILED",
        parentGenerationId: job.parentGenerationId,
        sceneIndex: i,
        reason:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      }));
    }
  }

  return records;
}
