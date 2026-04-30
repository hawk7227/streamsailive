/**
 * POST /api/streams/video/generate
 *
 * Standalone Streams panel — video generation route.
 * Public /streams test mode is allowed only for TEST_USER_ID.
 */

import { NextResponse } from "next/server";
import { resolveStreamsRouteContext, isFallbackTestWorkspace } from "@/lib/streams/test-mode-auth";
import { falSubmit, FAL_ENDPOINTS } from "@/lib/streams/fal-client";

export const maxDuration = 60;

const VALID_DURATIONS = [3, 4, 5, 8, 10, 15] as const;
const VALID_ASPECT_RATIOS = ["16:9", "9:16", "1:1"] as const;

type Duration = typeof VALID_DURATIONS[number];
type AspectRatio = typeof VALID_ASPECT_RATIOS[number];
type VideoMode = "t2v" | "i2v" | "motion";

type RequestBody = {
  prompt: string;
  userId?: string;
  workspaceId?: string;
  mode?: VideoMode;
  imageUrl?: string;
  refVideoUrl?: string;
  duration?: Duration;
  aspectRatio?: AspectRatio;
  model?: string;
};

type ValidationError = { field: string; message: string };

function validateBody(raw: unknown): { body: RequestBody } | { errors: ValidationError[] } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { errors: [{ field: "body", message: "Request body must be a JSON object" }] };
  }

  const obj = raw as Record<string, unknown>;
  const errors: ValidationError[] = [];

  if (typeof obj.prompt !== "string" || obj.prompt.trim().length === 0) {
    errors.push({ field: "prompt", message: "prompt is required and must be a non-empty string" });
  } else if (obj.prompt.trim().length > 2000) {
    errors.push({ field: "prompt", message: "prompt must not exceed 2000 characters" });
  }

  if (obj.duration !== undefined) {
    const durationNum = typeof obj.duration === "string"
      ? parseInt(obj.duration, 10)
      : Number(obj.duration);

    if (!VALID_DURATIONS.includes(durationNum as Duration)) {
      errors.push({ field: "duration", message: "duration must be one of: 3, 4, 5, 8, 10, 15" });
    } else {
      obj.duration = durationNum;
    }
  }

  if (obj.aspectRatio !== undefined && !VALID_ASPECT_RATIOS.includes(obj.aspectRatio as AspectRatio)) {
    errors.push({
      field: "aspectRatio",
      message: `aspectRatio must be one of: ${VALID_ASPECT_RATIOS.join(", ")}`,
    });
  }

  const mode = ((typeof obj.mode === "string" ? obj.mode : "t2v").toLowerCase()) as VideoMode;

  if (!["t2v", "i2v", "motion"].includes(mode)) {
    errors.push({ field: "mode", message: "mode must be t2v, i2v, or motion" });
  }

  if ((mode === "i2v" || mode === "motion") && obj.imageUrl !== undefined) {
    if (typeof obj.imageUrl !== "string" || !obj.imageUrl.trim()) {
      errors.push({ field: "imageUrl", message: "imageUrl required for I2V and motion modes" });
    }
  }

  if (errors.length > 0) return { errors };

  return {
    body: {
      prompt: (obj.prompt as string).trim(),
      userId: typeof obj.userId === "string" ? obj.userId.trim() : undefined,
      workspaceId: typeof obj.workspaceId === "string" ? obj.workspaceId.trim() : undefined,
      mode,
      imageUrl: typeof obj.imageUrl === "string" ? obj.imageUrl.trim() : undefined,
      refVideoUrl: typeof obj.refVideoUrl === "string" ? obj.refVideoUrl.trim() : undefined,
      duration: (obj.duration as Duration) ?? 5,
      aspectRatio: (obj.aspectRatio as AspectRatio) ?? "16:9",
      model: typeof obj.model === "string" ? obj.model.toLowerCase() : undefined,
    },
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  const validated = validateBody(rawBody);
  if ("errors" in validated) {
    return NextResponse.json(
      { error: "Validation failed", details: validated.errors },
      { status: 400 },
    );
  }

  const { prompt, duration, aspectRatio, mode, imageUrl, refVideoUrl, model } = validated.body;

  const MODEL_MAP: Record<string, { t2v: string; i2v: string }> = {
    pro: { t2v: FAL_ENDPOINTS.KLING_V3_PRO_T2V, i2v: FAL_ENDPOINTS.KLING_V3_PRO_I2V },
    precision: { t2v: FAL_ENDPOINTS.KLING_O3_T2V, i2v: FAL_ENDPOINTS.KLING_O3_I2V },
    cinema: { t2v: FAL_ENDPOINTS.VEO_T2V, i2v: FAL_ENDPOINTS.VEO_I2V },
  };

  const modelKey = (model ?? "standard").replace(/\s+/g, "-");
  const modelMap = MODEL_MAP[modelKey] ?? {
    t2v: FAL_ENDPOINTS.KLING_V3_T2V,
    i2v: FAL_ENDPOINTS.KLING_V3_I2V,
  };

  const endpoint =
    mode === "i2v"
      ? modelMap.i2v
      : mode === "motion"
        ? FAL_ENDPOINTS.KLING_MOTION
        : modelMap.t2v;

  const genType =
    mode === "i2v"
      ? "video_i2v"
      : mode === "motion"
        ? "video_motion"
        : "video_t2v";

  const ctx = await resolveStreamsRouteContext({
    request,
    body: rawBody as Record<string, unknown>,
    requireWorkspace: false,
    allowTestMode: true,
  });

  if (!ctx?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = ctx.admin;
  const requestedWorkspaceId =
    typeof (rawBody as Record<string, unknown>).workspaceId === "string"
      ? ((rawBody as Record<string, unknown>).workspaceId as string)
      : null;

  const workspaceId = requestedWorkspaceId ?? ctx.workspaceId ?? "streams-public-test";
  const shouldPersist = !ctx.isTestMode || !isFallbackTestWorkspace(workspaceId);

  const generationId = crypto.randomUUID();
  let persistedLog = false;

  if (shouldPersist) {
    const { error: insertError } = await admin.from("generation_log").insert({
      id: generationId,
      workspace_id: workspaceId,
      generation_type: genType,
      model: modelKey,
      fal_endpoint: endpoint,
      input_params: { prompt, duration, aspectRatio, mode, imageUrl, refVideoUrl },
      fal_status: "pending",
      created_at: new Date().toISOString(),
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

    persistedLog = true;
  }

  const falInput: Record<string, unknown> = {
    prompt,
    duration: String(duration),
    aspect_ratio: aspectRatio,
    generate_audio: true,
  };

  if (mode === "t2v") {
    falInput.negative_prompt = "blur, distort, low quality, watermark";
    falInput.cfg_scale = 0.5;
  } else if (mode === "i2v" && imageUrl) {
    falInput.start_image_url = imageUrl;
    falInput.image_url = imageUrl;
  } else if (mode === "motion") {
    if (refVideoUrl) falInput.video_url = refVideoUrl;
    if (imageUrl) falInput.image_url = imageUrl;
  }

  if (persistedLog) {
    const { data: wSettings } = await admin
      .from("workspace_settings")
      .select("cost_limit_daily_usd")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const limitUsd = wSettings?.cost_limit_daily_usd ?? null;

    if (limitUsd != null && limitUsd > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: rows } = await admin
        .from("generation_log")
        .select("cost_usd")
        .eq("workspace_id", workspaceId)
        .gte("created_at", todayStart.toISOString());

      const spent = (rows ?? []).reduce(
        (sum: number, row: { cost_usd: number | null }) => sum + (row.cost_usd ?? 0),
        0,
      );

      if (spent >= limitUsd) {
        return NextResponse.json(
          { error: `Daily cost limit $${limitUsd.toFixed(2)} reached. Spent: $${spent.toFixed(2)}` },
          { status: 402 },
        );
      }
    }
  }

  const submitResult = await falSubmit(endpoint, falInput);

  if (!submitResult.ok) {
    if (persistedLog) {
      await admin
        .from("generation_log")
        .update({
          fal_status: "failed",
          fal_error: submitResult.error,
        })
        .eq("id", generationId);
    }

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

  const { responseUrl } = submitResult;

  if (persistedLog) {
    await admin
      .from("generation_log")
      .update({
        fal_request_id: responseUrl,
        fal_status: "pending",
      })
      .eq("id", generationId);
  }

  console.log(JSON.stringify({
    level: "info",
    event: "STREAMS_VIDEO_QUEUED",
    generationId,
    workspaceId,
    endpoint,
    duration,
    aspectRatio,
    persisted: persistedLog,
    testMode: ctx.isTestMode,
  }));

  return NextResponse.json({
    generationId,
    responseUrl,
    status: "queued",
    endpoint,
    model: modelKey,
    persisted: persistedLog,
    testMode: ctx.isTestMode,
  });
}
