/**
 * src/lib/video-runtime/generateVideo.ts
 *
 * THE single public gate for all video generation.
 *
 * Every video entrypoint must call this function:
 *   - assistant tool (via media-generation.ts)
 *   - /api/generations route
 *   - pipeline test client
 *   - any future entrypoint
 *
 * Flow:
 *   normalize → validate → plan → createGeneration → submit → return pending
 *
 * This function owns:
 *   - input normalization
 *   - governance gates
 *   - provider resolution
 *   - plan building
 *   - persistence creation
 *   - job submission
 *
 * This function does NOT own:
 *   - polling (cron / processVideoJob)
 *   - artifact finalization (pollVideoJob)
 *   - stitching (stitchLongformVideo via processVideoJob)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVideoRequest } from "./normalizeVideoRequest";
import { validateVideoRequest } from "./validateVideoRequest";
import { buildVideoPlan } from "./buildVideoPlan";
import { resolveVideoProvider } from "./resolveVideoProvider";
import { createGenerationRecord } from "./persistence/createGeneration";
import { submitVideoJob } from "./jobs/submitVideoJob";
import { submitLongformJobs } from "./longform/submitLongformJobs";
import type { GenerateVideoInput, GenerateVideoResult } from "./types";

// Re-export for callers that catch governance errors
export { VideoRuntimeError } from "./types";

export async function generateVideo(
  input: GenerateVideoInput,
): Promise<GenerateVideoResult> {
  // 1. Normalize — clean, typed request
  const req = normalizeVideoRequest(input);

  // 2. Resolve provider — canonical {provider, model} pair
  const resolved = resolveVideoProvider(req);
  const normalizedReq = { ...req, provider: resolved.provider, model: resolved.model };

  // 3. Validate — throws VideoRuntimeError on governance violations
  validateVideoRequest(normalizedReq);

  // 4. Plan — typed VideoPlan with clips
  const plan = buildVideoPlan(normalizedReq);

  // 5. Create generation record (persistence-first)
  let generationId: string;
  try {
    generationId = await createGenerationRecord(normalizedReq, plan);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ level: "error", event: "GENERATION_RECORD_FAILED", reason }));
    return { ok: false, generationId: "", status: "failed", outputUrl: null, provider: resolved.provider, model: resolved.model };
  }

  // 6. Submit — single clip or longform batch
  try {
    if (plan.requiresStitching) {
      await submitLongformJobs({ generationId, workspaceId: normalizedReq.workspaceId, plan });
    } else {
      await submitVideoJob({ generationId, workspaceId: normalizedReq.workspaceId, plan, clipIndex: 0 });
    }
  } catch (err) {
    // Submission failure — mark generation failed
    const reason = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ level: "error", event: "VIDEO_SUBMIT_FAILED", generationId, reason }));
    const admin = createAdminClient();
    await admin.from("generations").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", generationId);
    return { ok: false, generationId, status: "failed", outputUrl: null, provider: resolved.provider, model: resolved.model };
  }

  return {
    ok: true,
    generationId,
    status: "pending",
    outputUrl: null,
    provider: resolved.provider,
    model: resolved.model,
  };
}
