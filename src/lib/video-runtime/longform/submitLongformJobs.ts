/**
 * longform/submitLongformJobs.ts
 *
 * Submits all clips in a longform plan as independent provider jobs.
 * Creates a parent video_job row to track overall completion.
 * Each clip gets its own video_jobs row with parent_job_id linkage.
 * Partial failure is acceptable — the cron skips clips without provider IDs.
 */

import { createVideoJob } from "../persistence/createVideoJob";
import { updateVideoJob } from "../persistence/updateVideoJob";
import { submitVideoJob } from "../jobs/submitVideoJob";
import type { VideoPlan } from "../types";

export async function submitLongformJobs(args: {
  generationId: string;
  workspaceId: string;
  plan: VideoPlan;
}): Promise<{ parentJobId: string; submittedClipCount: number }> {
  // Create parent tracking row (no provider_job_id — resolved by stitch)
  const parentJobId = await createVideoJob({
    generationId: args.generationId,
    workspaceId: args.workspaceId,
    provider: args.plan.provider,
    model: args.plan.model,
    requestPayload: {
      type: "longform_parent",
      clipCount: args.plan.clips.length,
      mode: args.plan.mode,
    },
  });

  await updateVideoJob(parentJobId, { status: "processing", phase: "poll" });

  // Submit each clip in parallel
  const clipResults = await Promise.allSettled(
    args.plan.clips.map((_, clipIndex) =>
      submitVideoJob({
        generationId: args.generationId,
        workspaceId: args.workspaceId,
        plan: args.plan,
        clipIndex,
        parentJobId,
      }),
    ),
  );

  let submittedClipCount = 0;
  for (const [i, result] of clipResults.entries()) {
    if (result.status === "fulfilled") {
      submittedClipCount++;
    } else {
      console.error(JSON.stringify({
        level: "error",
        event: "LONGFORM_CLIP_SUBMIT_FAILED",
        generationId: args.generationId,
        parentJobId,
        clipIndex: i,
        reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
      }));
    }
  }

  console.log(JSON.stringify({
    level: "info",
    event: "LONGFORM_BATCH_SUBMITTED",
    generationId: args.generationId,
    parentJobId,
    totalClips: args.plan.clips.length,
    submittedClipCount,
  }));

  return { parentJobId, submittedClipCount };
}
