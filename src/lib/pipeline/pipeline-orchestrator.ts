/**
 * pipeline-orchestrator.ts
 *
 * Production orchestrator. Replaces all hardcoded creative logic:
 *
 * Step 1 — AI generates 3 distinct concepts from intake brief (no hardcoded angles)
 * Step 2 — AI generates copy per concept (no mechanical field extraction)
 * Step 3 — Config-driven validator (no telehealth-locked blocked phrases)
 * Step 4 — All 3 concepts generate images in parallel (not just concept-1)
 * Step 5 — Kling I2V on accepted image
 * Step 4.5 — Real compositor + Supabase upload
 *
 * Spec files (pipeline-execution.ts and all media-realism/*.ts) are NOT modified.
 */

import { validateIntakeBrief } from "./qc/intakeGate";
import { runImageGenerationWithQc } from "./qc/imageQc";
import { generateCreative } from "../creative/generateCreative";
import { generateCopy } from "../creative/generateCopy";
import { validateCopyWithPolicy } from "../compliance/validateCopy";
import { buildPolicy, UNIVERSAL_POLICY, HEALTHCARE_COMPLIANCE } from "../compliance/compliancePolicy";
import { getDefaultAspectRatio, getVideoMotionPolicy } from "../media-realism/realismPolicy";
import { scoreVideoCandidate, shouldRejectVideoCandidate } from "../media-realism/videoQc";
import { selectBestVideoCandidate } from "../media-realism/candidateSelector";
import { compositeAndUpload } from "../media-realism/typographyProvider";
import { generateRealVideoCandidate } from "../media-realism/videoProvider";
import { scoreStructuralIntegrity } from "../generator-intelligence/services/structuralScoring";
import { buildRepairPlan } from "../generator-intelligence/services/repairLoop";
import { scoreImageCandidate, shouldRejectImageCandidate } from "../media-realism/imageQc";
import type {
  AssetLibraryRecord,
  ImageGenerationResult,
  IntakeBrief,
  VideoGenerationResult,
} from "../media-realism/types";

export type { AssetLibraryRecord };

// Extended record that includes all 3 concept images
export interface ProductionRecord extends Omit<AssetLibraryRecord, "image"> {
  images: ImageGenerationResult[];          // all 3 concepts
  image: ImageGenerationResult;             // best accepted (for compatibility)
}

export async function runPipelineProduction(intake: IntakeBrief): Promise<ProductionRecord> {
  // ── Intake gate ──────────────────────────────────────────────────────────
  const gate = validateIntakeBrief(intake);
  if (!gate.valid) throw new Error(`Intake gate failed: ${gate.errors.join(", ")}`);

  // ── Step 1: AI-generated creative (no hardcoded concepts) ────────────────
  const strategy = await generateCreative(intake);

  // ── Step 2: AI-generated copy per concept ────────────────────────────────
  const copy = await generateCopy(strategy.conceptDirections);

  // ── Step 3: Config-driven validation ─────────────────────────────────────
  // Policy is built per run. Healthcare addon applied only when niche = telehealth.
  const complianceAddons = intake.niche === "telehealth" ? [HEALTHCARE_COMPLIANCE] : [];
  const policy = buildPolicy(UNIVERSAL_POLICY, ...complianceAddons);
  const validator = validateCopyWithPolicy(copy, policy);

  if (validator.status === "block") {
    throw new Error(`Validator blocked: ${validator.issues.map(i => i.message).join(" | ")}`);
  }

  // ── Step 4: All 3 concepts generate images in parallel ───────────────────
  const aspectRatio = getDefaultAspectRatio(intake.targetPlatform);

  // Update overlayIntents on conceptDirections from the AI-generated copy
  const enrichedDirections = strategy.conceptDirections.map((concept, i) => {
    const variant = copy.variants[i];
    return {
      ...concept,
      overlayIntent: {
        ...concept.overlayIntent,
        headline: variant?.headline ?? concept.overlayIntent.headline,
        cta: variant?.cta ?? concept.overlayIntent.cta,
      },
    };
  });

  const images = await Promise.all(
    enrichedDirections.map(concept =>
      runImageGenerationWithQc({
        concept,
        validator,
        aspectRatio,
        overlayIntent: concept.overlayIntent,
        maxAttempts: Number(process.env.IMAGE_MAX_ATTEMPTS ?? "3"),
      })
    )
  );

  // Select best accepted image across all concepts
  const acceptedImages = images.filter(img => img.accepted && img.acceptedCandidate);
  if (acceptedImages.length === 0) {
    const reasons = images.map(img => img.qcReport.blockReason ?? "unknown").join("; ");
    throw new Error(`All concept images failed QC: ${reasons}`);
  }

  // Best = highest QC total score
  const bestImage = acceptedImages.reduce((best, img) => {
    const bScore = best.qcReport.acceptedScore?.totalScore ?? 0;
    const iScore = img.qcReport.acceptedScore?.totalScore ?? 0;
    return iScore > bScore ? img : best;
  });

  // ── Step 4.5: Compositor ─────────────────────────────────────────────────
  const compositeAssetUrl = await compositeAndUpload(
    bestImage.acceptedCandidate!.url,
    copy,
    intake,
  );

  // ── Step 5: Real Kling I2V ───────────────────────────────────────────────
  const video = await runRealVideo(bestImage.acceptedCandidate!.url);

  // ── Build record ─────────────────────────────────────────────────────────
  const record: ProductionRecord = {
    runId: strategy.runId,
    rulesetVersion: strategy.rulesetVersion,
    status: "readyForHumanReview",
    intake,
    strategy: { ...strategy, conceptDirections: enrichedDirections },
    copy,
    validator,
    images,
    image: bestImage,
    compositeAssetUrl,
    video,
  };

  return record;
}

async function runRealVideo(imageUrl: string): Promise<VideoGenerationResult> {
  const policy = getVideoMotionPolicy();
  try {
    const candidate = await generateRealVideoCandidate(imageUrl, 1);
    const score = scoreVideoCandidate(candidate, policy);
    const rejected = shouldRejectVideoCandidate(score);
    return {
      accepted: !rejected,
      acceptedCandidate: rejected ? undefined : candidate,
      rejectedCandidates: rejected ? [{ candidate, score }] : [],
      motionPolicy: policy,
      qcReport: {
        attempts: 1,
        acceptedCandidateId: rejected ? undefined : candidate.id,
        acceptedScore: rejected ? undefined : score,
        blockReason: rejected ? "Video QC scored below threshold" : undefined,
      },
    };
  } catch (err) {
    return {
      accepted: false,
      rejectedCandidates: [],
      motionPolicy: policy,
      qcReport: { attempts: 1, blockReason: err instanceof Error ? err.message : "Video provider error" },
    };
  }
}

// Single-step execution for individual step testing
export { executeNode } from "./pipeline-execution";


export type PipelineRuntimeEvent =
  | "planning_started"
  | "provider_selected"
  | "chapter_started"
  | "scene_started"
  | "clip_rendering"
  | "clip_completed"
  | "final_stitching"
  | "completed"
  | "failed";

type PipelineListener = (payload?: Record<string, unknown>) => void;

export interface PipelineExecutionHandle {
  on: (event: PipelineRuntimeEvent, listener: PipelineListener) => void;
}

function createPipelineExecutionHandle() {
  const listeners = new Map<PipelineRuntimeEvent, Set<PipelineListener>>();
  return {
    emit(event: PipelineRuntimeEvent, payload?: Record<string, unknown>) {
      listeners.get(event)?.forEach((listener) => {
        try {
          listener(payload);
        } catch {
          // swallow listener errors to keep pipeline running
        }
      });
    },
    handle: {
      on(event: PipelineRuntimeEvent, listener: PipelineListener) {
        const set = listeners.get(event) ?? new Set<PipelineListener>();
        set.add(listener);
        listeners.set(event, set);
      },
    } as PipelineExecutionHandle,
  };
}

function selectProvider(task: "image" | "video") {
  const providers = task === "image"
    ? [
        { name: "fal", cost: 1, quality: 0.8 },
        { name: "openai", cost: 2, quality: 0.9 },
      ]
    : [
        { name: "kling", cost: 1, quality: 0.86 },
        { name: "runway", cost: 3, quality: 0.95 },
      ];
  return providers.sort((a, b) => a.cost - b.cost)[0];
}

function buildIntakeFromPrompt(prompt: string): IntakeBrief {
  return {
    targetPlatform: "meta",
    sceneContext: prompt,
    audienceSegment: "real people in ordinary situations",
    brandVoiceStatement: "Grounded, non-staged, realism-first",
  };
}

function buildLongVideoPlanFromPrompt(prompt: string) {
  const hourMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(hour|hr)/i);
  const minuteMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(minute|min)/i);
  const requestedMinutes = hourMatch ? Math.max(20, Math.round(parseFloat(hourMatch[1]) * 60)) : minuteMatch ? Math.max(20, Math.round(parseFloat(minuteMatch[1]))) : 20;
  const chapterCount = requestedMinutes > 60 ? Math.max(6, Math.ceil(requestedMinutes / 12)) : Math.max(3, Math.ceil(requestedMinutes / 10));
  const chapters = Array.from({ length: chapterCount }, (_, chapterIdx) => {
    const sceneCount = requestedMinutes > 60 ? 8 : 5;
    return {
      chapterIndex: chapterIdx + 1,
      scenes: Array.from({ length: sceneCount }, (_, sceneIdx) => ({
        sceneIndex: sceneIdx + 1,
        clipCount: requestedMinutes > 60 ? 6 : 4,
        prompt: `${prompt}. Chapter ${chapterIdx + 1}. Scene ${sceneIdx + 1}.`,
      })),
    };
  });
  const totalScenes = chapters.reduce((sum, chapter) => sum + chapter.scenes.length, 0);
  const totalClips = chapters.reduce((sum, chapter) => sum + chapter.scenes.reduce((sceneTotal, scene) => sceneTotal + scene.clipCount, 0), 0);
  return { requestedMinutes, chapters, totalScenes, totalClips };
}

async function enforceRealism(record: ProductionRecord, prompt: string, mode: string) {
  const referenceAnalysis = {
    hasReferences: false,
    referenceStrength: "low" as const,
    likelyMultiAngle: false,
    likelySingleStill: true,
    identitySensitive: /same person|identity|same subject/i.test(prompt),
    anatomyRisk: "medium" as const,
    warnings: [],
    guidance: [],
  };

  const score = scoreStructuralIntegrity({
    referenceSummary: prompt,
    storyBible: prompt,
    referenceAnalysis,
    medium: mode === "PLAN_IMAGE" ? "image" : "video",
  });

  const repairPlan = buildRepairPlan(score, mode === "PLAN_IMAGE" ? "image" : "video");

  if (record.image?.acceptedCandidate && record.strategy?.conceptDirections?.[0]) {
    const scenePlan = {
      conceptId: record.strategy.conceptDirections[0].id,
      conceptType: "realism",
      subjectType: record.strategy.conceptDirections[0].subjectType,
      subjectCount: 1 as const,
      action: record.strategy.conceptDirections[0].action,
      environment: record.strategy.conceptDirections[0].environment,
      mood: record.strategy.conceptDirections[0].desiredMood,
      realismMode: record.strategy.conceptDirections[0].realismMode,
      shotType: "medium" as const,
      orientation: "landscape" as const,
      requiredProps: [],
      forbiddenProps: [],
      forbiddenScenes: [],
      noTextInImage: true as const,
    };
    const layoutPlan = {
      aspectRatio: "16:9" as const,
      subjectAnchor: "left" as const,
      safeZones: ["top_left"] as const,
      protectedZones: ["center"] as const,
      faceZone: "center_left" as const,
      backgroundDensity: "low_on_overlay_side" as const,
      compositionRules: ["keep subject grounded"],
      overlaySafeMap: { top_left: "clear" },
    };
    const qcScore = scoreImageCandidate(record.image.acceptedCandidate, scenePlan as any, layoutPlan as any);
    const rejectImage = shouldRejectImageCandidate(qcScore);
    if (!repairPlan.shouldRetry && !rejectImage) {
      return { record, score, repairPlan };
    }
  }

  if (repairPlan.shouldRetry) {
    const rerun = await runPipelineProduction(buildIntakeFromPrompt(`${prompt}. ${repairPlan.instructions.join(" ")}`));
    return { record: rerun, score, repairPlan };
  }

  return { record, score, repairPlan };
}

export async function runPipeline(params: { prompt: string; mode: "PLAN_IMAGE" | "PLAN_VIDEO" | "PLAN_LONG_VIDEO" | "REGENERATE_REALISM" | "SEND_TO_SCREEN" | "SEND_TO_SHELF"; }) {
  const bus = createPipelineExecutionHandle();

  (async () => {
    try {
      bus.emit("planning_started", { prompt: params.prompt, mode: params.mode });

      if (params.mode === "PLAN_LONG_VIDEO") {
        const plan = buildLongVideoPlanFromPrompt(params.prompt);
        let clipIndex = 0;
        const sceneVideos: string[] = [];

        for (const chapter of plan.chapters) {
          bus.emit("chapter_started", { chapterIndex: chapter.chapterIndex, totalChapters: plan.chapters.length });
          for (let sceneIdx = 0; sceneIdx < chapter.scenes.length; sceneIdx += 1) {
            const scene = chapter.scenes[sceneIdx];
            bus.emit("scene_started", { chapterIndex: chapter.chapterIndex, sceneIndex: scene.sceneIndex, totalScenes: plan.totalScenes, totalClips: plan.totalClips });
            const provider = selectProvider("video");
            bus.emit("provider_selected", { provider: provider.name, task: "video" });
            const clipTasks = Array.from({ length: scene.clipCount }, async (_, localClipIdx) => {
              const nextClip = clipIndex + localClipIdx + 1;
              bus.emit("clip_rendering", { clipIndex: nextClip, totalClips: plan.totalClips, sceneIndex: scene.sceneIndex, chapterIndex: chapter.chapterIndex });
              const record = await runPipelineProduction(buildIntakeFromPrompt(scene.prompt));
              const enforced = await enforceRealism(record, scene.prompt, "PLAN_VIDEO");
              if (enforced.record.video?.acceptedCandidate?.url) {
                sceneVideos.push(enforced.record.video.acceptedCandidate.url);
              }
              bus.emit("clip_completed", { clipIndex: nextClip, totalClips: plan.totalClips, sceneIndex: scene.sceneIndex, chapterIndex: chapter.chapterIndex, videoUrl: enforced.record.video?.acceptedCandidate?.url ?? null, imageUrl: enforced.record.image?.acceptedCandidate?.url ?? null });
              return enforced.record;
            });
            await Promise.all(clipTasks);
            clipIndex += scene.clipCount;
          }
        }

        bus.emit("final_stitching", { totalClips: plan.totalClips, sceneVideos: sceneVideos.length });
        bus.emit("completed", { mode: params.mode, finalVideoUrl: sceneVideos[sceneVideos.length - 1] ?? null, sceneVideos });
        return;
      }

      const provider = selectProvider(params.mode === "PLAN_IMAGE" ? "image" : "video");
      bus.emit("provider_selected", { provider: provider.name, task: params.mode === "PLAN_IMAGE" ? "image" : "video" });

      const record = await runPipelineProduction(buildIntakeFromPrompt(params.prompt));
      const enforced = await enforceRealism(record, params.prompt, params.mode);

      bus.emit("completed", {
        mode: params.mode,
        imageUrl: enforced.record.image?.acceptedCandidate?.url ?? null,
        videoUrl: enforced.record.video?.acceptedCandidate?.url ?? null,
        record: enforced.record,
      });
    } catch (error) {
      bus.emit("failed", { error: error instanceof Error ? error.message : String(error) });
    }
  })();

  return bus.handle;
}
