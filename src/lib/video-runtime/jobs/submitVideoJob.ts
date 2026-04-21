/**
 * jobs/submitVideoJob.ts
 *
 * Creates a video_jobs DB row, submits to provider, updates row with result.
 * Persistence-first: job row exists before any provider call.
 * Used for both single-clip and longform clip submissions.
 */

import { createVideoJob } from "../persistence/createVideoJob";
import { updateVideoJob } from "../persistence/updateVideoJob";
import { submitFalVideo } from "../providers/fal";
import { submitKlingVideo } from "../providers/kling";
import { submitRunwayVideo } from "../providers/runway";
import type { VideoPlan, VideoProviderSubmitResult } from "../types";

export async function submitVideoJob(args: {
  generationId: string;
  workspaceId: string;
  plan: VideoPlan;
  clipIndex?: number;
  parentJobId?: string;
}): Promise<{ jobId: string; submitResult: VideoProviderSubmitResult }> {
  const index = args.clipIndex ?? 0;
  const clip = args.plan.clips[index];
  if (!clip) {
    throw new Error("SUBMIT_VIDEO_JOB: clip at index " + index + " not found in plan");
  }

  // Create DB row before submitting — ensures every provider call is tracked
  const jobId = await createVideoJob({
    generationId: args.generationId,
    parentJobId: args.parentJobId,
    workspaceId: args.workspaceId,
    provider: args.plan.provider,
    model: args.plan.model,
    clipIndex: args.clipIndex,
    requestPayload: {
      clipIndex: index,
      prompt: clip.prompt,
      durationSeconds: clip.durationSeconds,
      mode: args.plan.mode,
      aspectRatio: args.plan.aspectRatio,
    },
  });

  await updateVideoJob(jobId, { status: "queued", phase: "submit" });

  // Submit to provider
  let submitResult: VideoProviderSubmitResult;
  const { provider, mode, aspectRatio, model } = args.plan;

  if (provider === "fal") {
    submitResult = await submitFalVideo({ clip, model, mode, aspectRatio });
  } else if (provider === "kling") {
    submitResult = await submitKlingVideo({ clip, model, mode, aspectRatio });
  } else if (provider === "runway") {
    submitResult = await submitRunwayVideo({ clip, model, mode, aspectRatio });
  } else {
    await updateVideoJob(jobId, { status: "failed", error: "Unknown provider: " + provider });
    return {
      jobId,
      submitResult: { accepted: false, provider, providerJobId: null, status: "failed", raw: null },
    };
  }

  // Update job with provider response
  await updateVideoJob(jobId, {
    status: submitResult.accepted ? "processing" : "failed",
    phase: "poll",
    ...(submitResult.providerJobId ? { providerJobId: submitResult.providerJobId } : {}),
    responsePayload: submitResult.raw as Record<string, unknown>,
    ...(!submitResult.accepted ? { error: "Provider rejected job submission" } : {}),
  });

  console.log(JSON.stringify({
    level: "info",
    event: submitResult.accepted ? "VIDEO_JOB_SUBMITTED" : "VIDEO_JOB_SUBMIT_FAILED",
    jobId,
    generationId: args.generationId,
    provider,
    clipIndex: index,
    providerJobId: submitResult.providerJobId,
  }));

  return { jobId, submitResult };
}
