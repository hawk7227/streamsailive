/**
 * pipeline-orchestrator.ts
 *
 * Production orchestrator. Wraps executePipeline from the spec
 * (pipeline-execution.ts) and replaces the two stubs with real providers:
 *
 *   - handleTypography stub  →  compositeAndUpload (Satori + Sharp + Supabase)
 *   - handleVideo stub       →  generateRealVideoCandidate (Kling I2V)
 *
 * The spec files are NOT modified. This file is the real execution path.
 * /api/pipeline/run-node/route.ts calls executePipeline from the spec,
 * which means the stubs still run in the spec's runPipeline mode.
 * Use runPipelineProduction from here for the real path.
 */

import { executePipeline, executeNode } from "./pipeline-execution";
import { compositeAndUpload } from "../media-realism/typographyProvider";
import { generateRealVideoCandidate } from "../media-realism/videoProvider";
import { getVideoMotionPolicy } from "../media-realism/realismPolicy";
import { scoreVideoCandidate, shouldRejectVideoCandidate } from "../media-realism/videoQc";
import type {
  AssetLibraryRecord,
  CopyGenerationOutput,
  IntakeBrief,
  VideoGenerationResult,
} from "../media-realism/types";

export { executeNode };

/**
 * Full pipeline with real providers.
 * Runs the spec pipeline then replaces the two stub outputs with real ones.
 */
export async function runPipelineProduction(intake: IntakeBrief): Promise<AssetLibraryRecord> {
  // Run the full spec pipeline — gets us everything except real typography and video
  const record = await executePipeline(intake);

  // Replace typography stub URL with real composite
  const realCompositeUrl = await compositeAndUpload(
    record.image.acceptedCandidate!.url,
    record.copy,
    intake,
  );

  // Replace video stub with real Kling I2V
  const realVideo = await runRealVideo(record.image.acceptedCandidate!.url);

  return {
    ...record,
    compositeAssetUrl: realCompositeUrl,
    video: realVideo,
  };
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
    const message = err instanceof Error ? err.message : "Unknown video error";
    return {
      accepted: false,
      rejectedCandidates: [],
      motionPolicy: policy,
      qcReport: { attempts: 1, blockReason: message },
    };
  }
}
