import { generateEnforcedImage } from "@/lib/media-realism/enforcedImage";
import { compileImagePrompt } from "@/lib/image";
import { buildStoryBible, type StoryBible } from "@/lib/story/storyBible";
import { generateContent } from "@/lib/ai";
import type { GenerationOptions, GenerationResult, GenerationType } from "@/lib/ai/types";
import { uploadImageToSupabaseWithMeta, deleteStorageFile } from "@/lib/supabase/storage";
import { createAdminClient } from "@/lib/supabase/admin";

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
  | "DB_WRITE_FAILED";

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

export async function executeMediaGeneration(args: MediaGenerationArgs): Promise<MediaGenerationExecution> {
  if (!args.prompt?.trim()) {
    throw new Error("MISSING_PROVIDER_CREDENTIALS: A non-empty media prompt is required.");
  }

  if (args.type === "i2v" && !args.imageUrl?.trim()) {
    throw new Error("PROVIDER_REQUEST_FAILED: imageUrl is required for image-to-video generation.");
  }

  const plan = planMediaGeneration(args);
  const { provider, model } = normalizeProvider(args);
  const workspaceId = args.workspaceId?.trim() || "assistant-core";

  if (args.type === "image" && provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
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

    // Step 3: DB insert (AFTER storage write is confirmed)
    // BLOCKED: user_id context not available in tool executor yet.
    // DB persistence requires real user session linkage (future slice).
    // Storage write is proven. DB insert skipped until user context flows through.
    const assetId = crypto.randomUUID();
    console.log(JSON.stringify({
      level: "info",
      event: "DB_PERSISTENCE_SKIPPED",
      reason: "user_id not available in tool executor context",
      storagePath,
      assetId,
    }));

    return {
      ok: true,
      type: args.type,
      provider,
      model,
      status: "completed",
      outputUrl: image.outputUrl,
      externalId: assetId,
      costEstimate: null,
      plan,
    };
  }

  // Non-OpenAI or video path — no DB persistence yet (future slice)
  const options: GenerationOptions = {
    prompt: plan.finalPrompt,
    aspectRatio: args.aspectRatio,
    duration: args.duration,
    quality: args.quality,
    imageUrl: args.imageUrl,
    model: model ?? undefined,
  };

  const result = await generateContent(args.type as GenerationType, options, provider);

  return {
    ok: result.status !== "failed",
    type: args.type,
    provider,
    model,
    status: result.status,
    outputUrl: result.outputUrl ?? null,
    externalId: result.externalId ?? null,
    costEstimate: result.costEstimate ?? null,
    plan,
  };
}



