/**
 * POST /api/streams/video/generate
 *
 * Standalone Streams panel — video generation route.
 * Owns its own contract. No imports from video-runtime, assistant-core,
 * or any other existing runtime layer.
 *
 * Flow (persistence-first):
 *   1. Parse + validate request body
 *   2. Authenticate — get user from Supabase session
 *   3. Resolve workspace_id
 *   4. Insert generation_log row (status: pending) — before any fal call
 *   5. Submit to fal — falSubmit(KLING_V3_T2V, input)
 *   6. If submit fails — mark generation_log failed, return 500
 *   7. Update generation_log with responseUrl + fal_status: queued
 *   8. Return { generationId, responseUrl, status: "queued" }
 *
 * The client polls /api/streams/video/status with the responseUrl.
 * No long-running work happens in this request.
 *
 * What this route does NOT do:
 *   - Poll fal (that is the status route's job)
 *   - Download or upload video (that happens after polling completes)
 *   - Write to artifacts table (that happens after upload)
 *   - Fake a completed status
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { falSubmit, FAL_ENDPOINTS } from "@/lib/streams/fal-client";

export const maxDuration = 60;

// ─── Input contract ───────────────────────────────────────────────────────────

const VALID_DURATIONS    = [3, 4, 5, 8, 10, 15] as const;
const VALID_ASPECT_RATIOS = ["16:9", "9:16", "1:1"] as const;

type Duration    = typeof VALID_DURATIONS[number];
type AspectRatio = typeof VALID_ASPECT_RATIOS[number];

type VideoMode = "t2v" | "i2v" | "motion";

type RequestBody = {
  prompt:       string;
  mode?:        VideoMode;       // t2v (default) | i2v | motion
  imageUrl?:    string;          // I2V: start_image_url. Motion: character reference
  refVideoUrl?: string;          // Motion-control: reference video URL
  duration?:    Duration;
  aspectRatio?: AspectRatio;
  model?:       string;          // Standard | Pro | Precision | Cinema | Native Audio
};

type ValidationError = { field: string; message: string };

function validateBody(raw: unknown): { body: RequestBody } | { errors: ValidationError[] } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { errors: [{ field: "body", message: "Request body must be a JSON object" }] };
  }

  const obj = raw as Record<string, unknown>;
  const errors: ValidationError[] = [];

  // prompt — required, non-empty string, max 2000 chars
  if (typeof obj.prompt !== "string" || obj.prompt.trim().length === 0) {
    errors.push({ field: "prompt", message: "prompt is required and must be a non-empty string" });
  } else if (obj.prompt.trim().length > 2000) {
    errors.push({ field: "prompt", message: "prompt must not exceed 2000 characters" });
  }

  // duration — optional. Frontend sends as string ("5"), coerce to number before validation.
  if (obj.duration !== undefined) {
    const durationNum = typeof obj.duration === "string"
      ? parseInt(obj.duration, 10)
      : (obj.duration as number);
    if (!VALID_DURATIONS.includes(durationNum as Duration)) {
      errors.push({ field: "duration", message: "duration must be one of: 3, 4, 5, 8, 10, 15" });
    } else {
      obj.duration = durationNum; // normalize to number for downstream
    }
  }

  // aspectRatio — optional, must be one of the valid values
  if (obj.aspectRatio !== undefined) {
    if (!VALID_ASPECT_RATIOS.includes(obj.aspectRatio as AspectRatio)) {
      errors.push({
        field: "aspectRatio",
        message: `aspectRatio must be one of: ${VALID_ASPECT_RATIOS.join(", ")}`,
      });
    }
  }

  // imageUrl — required for I2V mode
  const mode = ((obj.mode as string) ?? "t2v").toLowerCase() as VideoMode;
  if ((mode === "i2v" || mode === "motion") && obj.imageUrl !== undefined) {
    if (typeof obj.imageUrl !== "string" || !obj.imageUrl.trim()) {
      errors.push({ field: "imageUrl", message: "imageUrl required for I2V and motion modes" });
    }
  }

  if (errors.length > 0) return { errors };

  return {
    body: {
      prompt:      (obj.prompt as string).trim(),
      mode,
      imageUrl:    typeof obj.imageUrl === "string" ? obj.imageUrl.trim() : undefined,
      refVideoUrl: typeof obj.refVideoUrl === "string" ? obj.refVideoUrl.trim() : undefined,
      duration:    (obj.duration as Duration)       ?? 5,
      aspectRatio: (obj.aspectRatio as AspectRatio) ?? "16:9",
      model:       typeof obj.model === "string" ? obj.model.toLowerCase() : undefined,
    },
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 },
    );
  }

  // 2. Validate body
  const validated = validateBody(rawBody);
  if ("errors" in validated) {
    return NextResponse.json(
      { error: "Validation failed", details: validated.errors },
      { status: 400 },
    );
  }

  const { prompt, duration, aspectRatio, mode, imageUrl, refVideoUrl, model } = validated.body;

  // Map brand model names to fal endpoints
  const MODEL_MAP: Record<string, { t2v: string; i2v: string }> = {
    "pro":       { t2v: FAL_ENDPOINTS.KLING_V3_PRO_T2V, i2v: FAL_ENDPOINTS.KLING_V3_PRO_I2V },
    "precision": { t2v: FAL_ENDPOINTS.KLING_O3_T2V,     i2v: FAL_ENDPOINTS.KLING_O3_I2V     },
    "cinema":    { t2v: FAL_ENDPOINTS.VEO_T2V,           i2v: FAL_ENDPOINTS.VEO_I2V          },
  };
  const modelKey     = (model ?? "standard").replace(/\s+/g, "-");
  const modelMap     = MODEL_MAP[modelKey] ?? { t2v: FAL_ENDPOINTS.KLING_V3_T2V, i2v: FAL_ENDPOINTS.KLING_V3_I2V };

  // Resolve endpoint by mode
  const endpoint = mode === "i2v"     ? modelMap.i2v
                 : mode === "motion"  ? FAL_ENDPOINTS.KLING_MOTION
                 : modelMap.t2v;

  const genType = mode === "i2v"    ? "video_i2v"
                : mode === "motion" ? "video_motion"
                : "video_t2v";

  // 3. Authenticate
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 4. Resolve workspace
  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const selection = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = selection.current.workspace.id;
  } catch (err) {
    console.error(JSON.stringify({
      level: "error",
      event: "STREAMS_VIDEO_WORKSPACE_FAILED",
      userId: user.id,
      reason: err instanceof Error ? err.message : String(err),
    }));
    return NextResponse.json({ error: "Could not resolve workspace" }, { status: 500 });
  }

  // 5. Persistence-first — insert generation_log before any fal call
  const generationId = crypto.randomUUID();
  const { error: insertError } = await admin.from("generation_log").insert({
    id:              generationId,
    workspace_id:    workspaceId,
    generation_type: genType,
    model:           modelKey,
    fal_endpoint:    endpoint,
    input_params:    { prompt, duration, aspectRatio, mode, imageUrl, refVideoUrl },
    fal_status:      "pending",
    created_at:      new Date().toISOString(),
  });

  if (insertError) {
    console.error(JSON.stringify({
      level: "error",
      event: "STREAMS_VIDEO_LOG_INSERT_FAILED",
      workspaceId,
      reason: insertError.message,
    }));
    return NextResponse.json(
      { error: "Failed to create generation record" },
      { status: 500 },
    );
  }

  // 6. Build fal input — schema differs by mode
  const falInput: Record<string, unknown> = {
    prompt,
    duration:        String(duration),
    aspect_ratio:    aspectRatio,
    generate_audio:  true,
  };

  if (mode === "t2v") {
    // T2V-only params
    falInput.negative_prompt = "blur, distort, low quality, watermark";
    falInput.cfg_scale        = 0.5;
  } else if (mode === "i2v" && imageUrl) {
    // I2V: Kling v3 uses start_image_url; O3 uses image_url
    // Set both — fal ignores unknown params safely (confirmed in audit)
    falInput.start_image_url = imageUrl;
    falInput.image_url        = imageUrl;
  } else if (mode === "motion") {
    // Motion-control: prompt = CHARACTER APPEARANCE TEXT (not motion!)
    // Motion comes from refVideoUrl
    if (refVideoUrl) falInput.video_url = refVideoUrl;
    // Remove negative_prompt — not supported by motion-control
  }

  // ── Cost enforcement ─────────────────────────────────────────────────────
  const { data: wSettings } = await admin
    .from("workspace_settings").select("cost_limit_daily_usd").eq("workspace_id", workspaceId).maybeSingle();
  const limitUsd = wSettings?.cost_limit_daily_usd ?? null;
  if (limitUsd != null && limitUsd > 0) {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const { data: rows } = await admin.from("generation_log").select("cost_usd")
      .eq("workspace_id", workspaceId).gte("created_at", todayStart.toISOString());
    const spent = (rows ?? []).reduce((s: number, r: {cost_usd: number|null}) => s + (r.cost_usd ?? 0), 0);
    if (spent >= limitUsd) {
      return NextResponse.json({ error: `Daily cost limit $${limitUsd.toFixed(2)} reached. Spent: $${spent.toFixed(2)}` }, { status: 402 });
    }
  }

  const submitResult = await falSubmit(endpoint, falInput);

  if (!submitResult.ok) {
    // Mark generation failed — do not leave a dangling pending record
    await admin.from("generation_log").update({
      fal_status: "failed",
      fal_error:  submitResult.error,
    }).eq("id", generationId);

    console.error(JSON.stringify({
      level: "error",
      event: "STREAMS_VIDEO_FAL_SUBMIT_FAILED",
      generationId,
      workspaceId,
      reason: submitResult.error,
    }));

    return NextResponse.json(
      { error: "Video generation provider rejected the request", detail: submitResult.error },
      { status: 502 },
    );
  }

  // 7. Update generation_log with responseUrl
  // responseUrl is the fal polling handle — store it as fal_request_id
  const { responseUrl } = submitResult;

  await admin.from("generation_log").update({
    fal_request_id: responseUrl,
    fal_status:     "pending",   // still pending — not complete until poll confirms
  }).eq("id", generationId);

  console.log(JSON.stringify({
    level: "info",
    event: "STREAMS_VIDEO_QUEUED",
    generationId,
    workspaceId,
    endpoint,
    duration,
    aspectRatio,
  }));

  // 8. Return job identifiers — client polls /api/streams/video/status
  return NextResponse.json({
    generationId,
    responseUrl,
    status:   "queued",
    endpoint,
    model:    "kling-v3-standard",
  });
}
