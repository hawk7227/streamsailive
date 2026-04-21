import { generateEnforcedImage } from "@/lib/media-realism/enforcedImage";
import { compileImagePrompt } from "@/lib/image";
import { buildStoryBible, type StoryBible } from "@/lib/story/storyBible";
import { generateContent } from "@/lib/ai";
import type { GenerationOptions, GenerationResult, GenerationType } from "@/lib/ai/types";
import { uploadImageToSupabaseWithMeta, deleteStorageFile } from "@/lib/supabase/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { OPENAI_API_KEY } from "@/lib/env";
import { compileGenerationRequest } from "@/lib/generator-intelligence/compiler";
import { submitSceneBatch } from "@/lib/video/scene-batch";
import type { VideoSceneSpec } from "@/lib/video/types";
import { generateVideo, VideoRuntimeError } from "@/lib/video-runtime/generateVideo";
import { finalizeImageArtifact } from "@/lib/media-realism/finalizeImageArtifact";

export type MediaKind = "image" | "video" | "i2v";

export type MediaGenerationArgs = {
  type: MediaKind;
  prompt: string;
  provider?: string;
  model?: string;
  duration?: string;
  aspectRatio?: string;
  quality?: string;
  imageUrl?: string;
  workspaceId?: string;
  /** Passed through to finalizeImageArtifact for conversation-scoped artifact browse. */
  conversationId?: string;
  storyBible?: string;
  sourceKind?: "self" | "family_or_friend" | "synthetic" | "mixed";
  longVideo?: boolean;
  realismMode?: "strict" | "balanced" | "strict_everyday" | "premium_commercial";
};

export type PlannedScene = {
  id: string;
  title: string;
  beat: string;
  shotPrompt: string;
  targetSeconds: number;
  camera: string;
  motion: string;
  continuity: string[];
};

export type KeyframePlan = {
  id: string;
  sceneId: string;
  prompt: string;
};

export type MediaGenerationPlan = {
  type: MediaKind;
  sourceMode: "prompt_to_image" | "prompt_to_video" | "story_to_video" | "image_to_video";
  finalPrompt: string;
  negativePrompt: string;
  continuityProfile: {
    subjectIdentity: string;
    environment: string;
    lighting: string;
    cameraStyle: string;
    motionBehavior: string;
  };
  storyBible?: StoryBible;
  scenes: PlannedScene[];
  keyframes: KeyframePlan[];
  validationChecklist: string[];
};

export type MediaGenerationExecution = {
  ok: boolean;
  type: MediaKind;
  provider: string;
  model: string | null;
  status: GenerationResult["status"];
  outputUrl: string | null;
  externalId: string | null;
  costEstimate: number | null;
  plan: MediaGenerationPlan;
};

const VIDEO_NEGATIVE = [
  "uncanny motion",
  "identity drift",
  "face drift",
  "background warping",
  "melting shapes",
  "floating props",
  "stylized cinematic glow",
  "oversmoothed textures",
  "AI smear",
].join(", ");

const IMAGE_NEGATIVE = [
  "plastic skin",
  "cgi look",
  "stock photo staging",
  "oversharpening",
  "text overlays",
  "logo",
  "artificial reflections",
].join(", ");

function parseDurationSeconds(value?: string): number {
  if (!value) return 5;
  const match = value.match(/\d+/);
  if (!match) return 5;
  const seconds = Number(match[0]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 5;
}

function buildContinuityProfile(prompt: string, storyBible?: StoryBible) {
  const summary = storyBible?.summary ?? prompt;
  const visual = storyBible?.visualBible;
  return {
    subjectIdentity:
      storyBible?.identityPack.anchors.join(", ") ||
      "consistent face shape, eye spacing, body proportions, wardrobe continuity",
    environment: visual?.setting || "ordinary believable real-world environment",
    lighting: visual?.realismRules?.[0] || "natural available light, physically plausible shadows",
    cameraStyle: "handheld real-camera capture, natural focus, natural motion blur",
    motionBehavior: "subtle believable body movement, correct inertia, no rubber motion",
  };
}

function buildScenes(prompt: string, seconds: number, storyBible?: StoryBible, longVideo?: boolean): PlannedScene[] {
  const beats = storyBible?.timeline?.length
    ? storyBible.timeline
    : [prompt, `${prompt}. Keep the environment stable and the movement ordinary.`];

  const desiredCount = longVideo ? Math.min(Math.max(beats.length, 3), 8) : Math.min(Math.max(beats.length, 1), 4);
  const selectedBeats = beats.slice(0, desiredCount);
  const perScene = Math.max(3, Math.round(seconds / Math.max(selectedBeats.length, 1)));
  const continuity = storyBible?.identityPack.notes ?? [
    "keep the same subject identity",
    "preserve environment continuity",
    "preserve lighting continuity",
  ];

  return selectedBeats.map((beat, index) => ({
    id: `scene-${index + 1}`,
    title: `Scene ${index + 1}`,
    beat,
    targetSeconds: perScene,
    camera: "real handheld framing with natural lens behavior",
    motion: "subtle human motion and physically believable movement",
    continuity,
    shotPrompt: [
      beat,
      "Real-world captured footage.",
      "Natural handheld movement.",
      "Physically plausible motion and stable identity.",
      `Keep continuity with: ${continuity.join("; ")}.`,
    ].join(" "),
  }));
}

function buildKeyframes(scenes: PlannedScene[], continuityProfile: MediaGenerationPlan["continuityProfile"]): KeyframePlan[] {
  return scenes.map((scene, index) => ({
    id: `keyframe-${index + 1}`,
    sceneId: scene.id,
    prompt: [
      scene.beat,
      "Photorealistic still frame from real-world footage.",
      `Subject identity: ${continuityProfile.subjectIdentity}.`,
      `Environment: ${continuityProfile.environment}.`,
      `Lighting: ${continuityProfile.lighting}.`,
      `Camera: ${continuityProfile.cameraStyle}.`,
      "No text, no logo, no stylization.",
    ].join(" "),
  }));
}

export function planMediaGeneration(args: MediaGenerationArgs): MediaGenerationPlan {
  const trimmedPrompt = args.prompt.trim();
  const storyBible =
    args.type === "video" || args.type === "i2v"
      ? buildStoryBible({
          title: args.type === "i2v" ? "Image to Video Story Bible" : "Video Story Bible",
          storyText: args.storyBible?.trim() || trimmedPrompt,
          sourceKind: args.sourceKind ?? "synthetic",
        })
      : undefined;

  const continuityProfile = buildContinuityProfile(trimmedPrompt, storyBible);
  const seconds = parseDurationSeconds(args.duration);
  const scenes = args.type === "image"
    ? []
    : buildScenes(trimmedPrompt, seconds, storyBible, args.longVideo);
  const keyframes = args.type === "image" ? [] : buildKeyframes(scenes, continuityProfile);
  const finalPrompt = args.type === "image"
    ? [
        trimmedPrompt,
        "Near-photorealistic real photography.",
        "Natural lighting, accurate texture, ordinary environment.",
        `Camera: ${continuityProfile.cameraStyle}.`,
        "No stock-photo polish. No visible AI artifacts.",
      ].join(" ")
    : [
        trimmedPrompt,
        `Continuity lock: ${continuityProfile.subjectIdentity}.`,
        `Environment lock: ${continuityProfile.environment}.`,
        `Lighting lock: ${continuityProfile.lighting}.`,
        `Motion lock: ${continuityProfile.motionBehavior}.`,
        "Near-photorealistic, physically consistent, real-world captured footage.",
      ].join(" ");

  return {
    type: args.type,
    sourceMode:
      args.type === "image"
        ? "prompt_to_image"
        : args.type === "i2v"
          ? "image_to_video"
          : args.longVideo || scenes.length > 1
            ? "story_to_video"
            : "prompt_to_video",
    finalPrompt,
    negativePrompt: args.type === "image" ? IMAGE_NEGATIVE : VIDEO_NEGATIVE,
    continuityProfile,
    storyBible,
    scenes,
    keyframes,
    validationChecklist:
      args.type === "image"
        ? [
            "reject cgi look",
            "reject oversmoothed skin",
            "reject stock-photo staging",
            "require real texture and natural lighting",
          ]
        : [
            "reject face drift",
            "reject warped background",
            "reject rubber motion",
            "require stable identity across clip",
          ],
  };
}

function normalizeProvider(args: MediaGenerationArgs): { provider: string; model: string | null } {
  const requested = (args.model || args.provider || "").trim();

  if (args.type === "image") {
    if (requested === "openai-image" || requested === "openai") {
      return { provider: "openai", model: "openai-image" };
    }
    if (requested === "seedream-lite-v5" || requested === "nano-banana-2") {
      return { provider: "fal", model: requested };
    }
    return { provider: args.provider?.trim() || "openai", model: args.model?.trim() || null };
  }

  if (requested === "kling-v3" || requested === "veo-3.1") {
    return { provider: "fal", model: requested };
  }

  return {
    provider: args.provider?.trim() || "fal",
    model: args.model?.trim() || null,
  };
}

// ── Structured error codes per doc spec ──────────────────────────────────────
export type MediaGenerationErrorCode =
  | "MISSING_PROVIDER_CREDENTIALS"
  | "EMPTY_PROVIDER_OUTPUT"
  | "PROVIDER_REQUEST_FAILED"
  | "STORAGE_FAILED"
  | "DB_WRITE_FAILED"
  | "STORY_BIBLE_REQUIRED"
  | "STRUCTURAL_SCORE_BLOCKED";

export class VideoGovernanceError extends Error {
  constructor(
    public readonly code: "STORY_BIBLE_REQUIRED" | "STRUCTURAL_SCORE_BLOCKED",
    message: string,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "VideoGovernanceError";
  }
}

export type MediaGenerationAsset = {
  assetId: string;
  storagePath: string;
  url: string;
  mimeType: string;
};

async function persistGenerationRecord(args: {
  type: MediaKind;
  prompt: string;
  provider: string;
  model: string | null;
  outputUrl: string;
  storagePath: string;
  workspaceId: string;
}): Promise<string> {
  const admin = createAdminClient();
  const id = crypto.randomUUID();
  const { error } = await admin.from("generations").insert({
    id,
    // Service-role insert — user_id uses a sentinel for assistant-generated records
    // Real user linkage requires passing userId through context (future slice)
    user_id: "00000000-0000-0000-0000-000000000000",
    workspace_id: args.workspaceId,
    type: args.type,
    prompt: args.prompt,
    status: "completed",
    output_url: args.outputUrl,
    provider: args.provider,
    model: args.model,
    mode: "assistant",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`DB_WRITE_FAILED: ${error.message}`);
  return id;
}

async function insertPendingVideoGeneration(args: {
  type: "video" | "i2v";
  prompt: string;
  provider: string;
  model: string | null;
  workspaceId: string;
  externalId: string;
}): Promise<string> {
  const admin = createAdminClient();
  const id = crypto.randomUUID();
  const { error } = await admin.from("generations").insert({
    id,
    user_id: "00000000-0000-0000-0000-000000000000",
    workspace_id: args.workspaceId,
    type: args.type,
    prompt: args.prompt,
    status: "pending",
    external_id: args.externalId,
    provider: args.provider,
    model: args.model,
    mode: "assistant",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    // Log and continue — DB failure must not break the user response
    console.error(JSON.stringify({
      level: "error",
      event: "PENDING_VIDEO_INSERT_FAILED",
      reason: error.message,
      externalId: args.externalId,
    }));
  }
  return id;
}

async function insertParentGenerationRow(args: {
  id: string;
  type: "video" | "i2v";
  prompt: string;
  provider: string;
  model: string | null;
  workspaceId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("generations").insert({
    id: args.id,
    user_id: "00000000-0000-0000-0000-000000000000",
    workspace_id: args.workspaceId,
    type: args.type,
    prompt: args.prompt,
    // Prefix identifies this as a long-video parent row.
    // The cron poller skips rows with this prefix — they are
    // resolved only when all child scenes complete and stitch fires.
    external_id: `long_video_parent:${args.id}`,
    status: "pending",
    provider: args.provider,
    model: args.model,
    mode: "assistant",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "PARENT_ROW_INSERT_FAILED",
      parentId: args.id,
      reason: error.message,
    }));
  }
}

export async function executeMediaGeneration(args: MediaGenerationArgs): Promise<MediaGenerationExecution> {
  if (!args.prompt?.trim()) {
    throw new Error("MISSING_PROVIDER_CREDENTIALS: A non-empty media prompt is required.");
  }

  if (args.type === "i2v" && !args.imageUrl?.trim()) {
    throw new Error("PROVIDER_REQUEST_FAILED: imageUrl is required for image-to-video generation.");
  }

  // ── Governance gates ──────────────────────────────────────────────────────
  // i2v requires a source image — everything else proceeds directly.
  if (args.type === "i2v" && args.imageUrl?.trim()) {
    const compiled = compileGenerationRequest({
      medium: "video",
      prompt: args.prompt,
      provider: args.provider ?? "fal",
      storyBible: args.storyBible,
      sourceKind: args.sourceKind,
    });

    if (compiled.structuralScore && !compiled.structuralScore.isSafeForVideo) {
      throw new VideoGovernanceError(
        "STRUCTURAL_SCORE_BLOCKED",
        "Source image is not safe for video yet. Structural integrity score is too low.",
        {
          structuralScore: compiled.structuralScore,
          repairPlan: compiled.repairPlan,
        },
      );
    }
  }

  // ── Long-video: scene-batch path ──────────────────────────────────────────
  // When longVideo is true, planning generates multiple scenes.
  // Each scene is submitted as an independent fal.ai async job.
  // A parent row tracks completion; the cron stitches clips when all done.
  const plan = planMediaGeneration(args);
  const { provider, model } = normalizeProvider(args);
  const workspaceId = args.workspaceId?.trim() || "assistant-core";

  if (
    args.longVideo === true &&
    (args.type === "video" || args.type === "i2v") &&
    plan.scenes.length > 1 &&
    args.workspaceId
  ) {
    const parentId = crypto.randomUUID();

    // Insert parent row first — scenes reference it via parent_id
    await insertParentGenerationRow({
      id: parentId,
      type: args.type,
      prompt: plan.finalPrompt,
      provider,
      model: model ?? null,
      workspaceId: args.workspaceId,
    });

    // Map PlannedScene[] → VideoSceneSpec[]
    const sceneSpecs: VideoSceneSpec[] = plan.scenes.map((scene, i) => ({
      sceneIndex: i,
      prompt: scene.shotPrompt,
      durationSeconds: scene.targetSeconds,
      // i2v: all scenes share the same source image
      imageUrl: args.type === "i2v" ? args.imageUrl : undefined,
    }));

    const sceneRecords = await submitSceneBatch({
      parentGenerationId: parentId,
      workspaceId: args.workspaceId,
      scenes: sceneSpecs,
      provider,
      model: model ?? null,
      type: args.type,
    });

    console.log(JSON.stringify({
      level: "info",
      event: "LONG_VIDEO_BATCH_SUBMITTED",
      parentId,
      sceneCount: plan.scenes.length,
      submittedCount: sceneRecords.length,
    }));

    return {
      ok: true,
      type: args.type,
      provider,
      model,
      status: "pending",
      outputUrl: null,
      externalId: `long_video_parent:${parentId}`,
      costEstimate: null,
      plan,
    };
  }

  if (args.type === "image" && provider === "openai") {
    const apiKey = OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("MISSING_PROVIDER_CREDENTIALS: OPENAI_API_KEY is not configured.");
    }

    // Compile prompt through structured compiler (replaces planMediaGeneration prompt for images)
    const compiled = compileImagePrompt(args.prompt);

    // Step 1: Generate image via OpenAI Image API
    const image = await generateEnforcedImage({
      prompt: compiled.compiledPrompt,
      apiKey,
      workspaceId,
      mode: "images",
      realismMode: args.realismMode === "premium_commercial" ? "premium_commercial" : "strict_everyday",
      aspectRatio: (args.aspectRatio as "1:1" | "4:5" | "9:16" | "16:9" | undefined) ?? "16:9",
    });

    if (!image.outputUrl) {
      throw new Error("EMPTY_PROVIDER_OUTPUT: Image generation returned no usable output URL.");
    }

    // Step 2: Re-upload to get storagePath for cleanup capability
    // enforcedImage already uploaded — re-fetch storagePath from the URL
    // Extract storagePath from the public URL
    const urlParts = image.outputUrl.split("/generations/");
    const storagePath = urlParts[1] ?? `${workspaceId}/unknown`;

    // Step 3: DB insert (AFTER storage write is confirmed).
    // Uses SENTINEL_USER_ID — same pattern as video, song, and voice runtimes.
    // The artifacts table requires only workspace_id, not user_id.
    const artifactId = await finalizeImageArtifact({
      workspaceId,
      storageUrl: image.outputUrl,
      mimeType: "image/png",
      title: args.prompt.slice(0, 200),
      conversationId: args.conversationId,
    }).catch((err: unknown) => {
      // Non-fatal — image is already in storage. Log and continue.
      console.error(JSON.stringify({
        level: "error",
        event: "IMAGE_ARTIFACT_FINALIZE_FAILED",
        reason: err instanceof Error ? err.message : String(err),
        storagePath,
      }));
      return crypto.randomUUID();
    });

    return {
      ok: true,
      type: args.type,
      provider,
      model,
      status: "completed",
      outputUrl: image.outputUrl,
      externalId: artifactId,
      costEstimate: null,
      plan,
    };
  }

  // Delegate to the single authoritative video runtime gate.
  // generateVideo() owns: normalize, validate, plan, persist, submit.
  // Polling and finalization happen in the cron via processVideoPendingJobs().
  const videoResult = await generateVideo({
    type: args.type as "video" | "i2v",
    prompt: args.prompt,
    provider: args.provider,
    model: args.model,
    duration: args.duration,
    aspectRatio: args.aspectRatio,
    quality: args.quality,
    imageUrl: args.imageUrl,
    workspaceId: args.workspaceId,
    storyBible: args.storyBible,
    sourceKind: args.sourceKind,
    longVideo: args.longVideo,
    realismMode: args.realismMode,
  });

  return {
    ok: videoResult.ok,
    type: args.type,
    provider: videoResult.provider,
    model: videoResult.model,
    status: videoResult.status,
    outputUrl: videoResult.outputUrl,
    externalId: videoResult.generationId,
    costEstimate: null,
    plan,
  };
}



