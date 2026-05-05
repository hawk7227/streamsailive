/**
 * POST /api/streams/image/generate
 *
 * FLUX Kontext (aspect ratio) or FLUX Dev/LoRA (custom px with rounding).
 * Custom sizing rule: Math.round(value / 8) * 8 — enforced server-side.
 * Custom-px models: flux-dev, flux-lora, seedream, flux-pro
 * Aspect-ratio models: kontext, kontext-max, design
 *
 * Returns { generationId, responseUrl } — client polls /api/streams/video/status.
 */

import { NextResponse } from "next/server";
import { resolveStreamsRouteContext, isFallbackTestWorkspace } from "@/lib/streams/test-mode-auth";
import { checkRateLimit } from "@/lib/streams/rate-limiter";
import { falSubmit, FAL_ENDPOINTS } from "@/lib/streams/fal-client";
import { chooseProviderForQuality, compileImagePrompt } from "@/lib/streams/quality/quality-governor";
import { STREAMS_IMAGE_PROVIDER_CAPABILITIES, isExactSizeRequest, normalizeStreamsImageModel } from "@/lib/streams/quality/provider-capabilities";

export const maxDuration = 60;

const CUSTOM_PX_MODELS = new Set(["flux-dev", "flux-lora", "seedream", "flux-pro"]);

const MODEL_ENDPOINTS: Record<string, string> = {
  kontext: FAL_ENDPOINTS.FLUX_KONTEXT,
  "kontext-max": FAL_ENDPOINTS.FLUX_KONTEXT_MAX,
  "flux-pro": FAL_ENDPOINTS.FLUX_PRO,
  "flux-dev": FAL_ENDPOINTS.FLUX_DEV,
  "flux-lora": FAL_ENDPOINTS.FLUX_LORA,
  design: FAL_ENDPOINTS.RECRAFT_V4,
  seedream: FAL_ENDPOINTS.SEEDREAM,
};

function roundTo8(v: number): number {
  return Math.round(v / 8) * 8;
}

type RequestBody = {
  userId?: string;
  workspaceId?: string;
  model?: string;
  prompt: string;
  aspectRatio?: string;
  width?: number;
  height?: number;
  numImages?: number;
};

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = rawBody as RequestBody;

  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const ctx = await resolveStreamsRouteContext({
    request,
    body: body as Record<string, unknown>,
    requireWorkspace: false,
    allowTestMode: true,
  });

  if (!ctx?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = body.workspaceId ?? ctx.workspaceId ?? "streams-public-test";
  const requestedModel = normalizeStreamsImageModel(body.model);
  const exactSize = isExactSizeRequest(body.width, body.height);

  const routingDecision = chooseProviderForQuality(
    {
      mediaType: "image",
      prompt: body.prompt,
      width: exactSize ? body.width : null,
      height: exactSize ? body.height : null,
      aspectRatio: exactSize ? null : body.aspectRatio ?? "1:1",
      bulkCount: body.numImages ?? 1,
      requiresRealism: true,
    },
    STREAMS_IMAGE_PROVIDER_CAPABILITIES,
  );

  const model = exactSize
    ? routingDecision?.model ?? "flux-pro"
    : MODEL_ENDPOINTS[requestedModel]
      ? requestedModel
      : routingDecision?.model ?? "kontext";

  const endpoint = MODEL_ENDPOINTS[model] ?? FAL_ENDPOINTS.FLUX_KONTEXT;
  const useCustom = exactSize && CUSTOM_PX_MODELS.has(model);

  if (exactSize && !useCustom) {
    return NextResponse.json(
      {
        error: "Requested exact image size requires a native custom-dimension provider",
        detail: `No approved native-size image model selected for ${body.width}x${body.height}.`,
      },
      { status: 422 },
    );
  }

  const compiledPrompt = compileImagePrompt({
    prompt: body.prompt.trim(),
    realism: true,
    width: useCustom ? body.width : null,
    height: useCustom ? body.height : null,
    aspectRatio: useCustom ? null : body.aspectRatio ?? "1:1",
  });

  const falInput: Record<string, unknown> = {
    prompt: compiledPrompt,
    num_images: Math.min(body.numImages ?? 1, 4),
  };

  if (useCustom && body.width && body.height) {
    falInput.width = roundTo8(body.width);
    falInput.height = roundTo8(body.height);
  } else {
    falInput.aspect_ratio = body.aspectRatio ?? "1:1";
  }

  const generationId = crypto.randomUUID();
  let persistedLog = false;

  if (!ctx.isTestMode || !isFallbackTestWorkspace(workspaceId)) {
    const insertResult = await ctx.admin.from("generation_log").insert({
      id: generationId,
      workspace_id: workspaceId,
      generation_type: "image",
      model,
      fal_endpoint: endpoint,
      input_params: falInput,
      fal_status: "pending",
    });

    if (insertResult.error) {
      if (!ctx.isTestMode) {
        return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
      }
    } else {
      persistedLog = true;
    }
  }

  if (!ctx.isTestMode || persistedLog) {
    const rateResult = checkRateLimit(workspaceId);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again shortly." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const { data: wSettings } = await ctx.admin
      .from("workspace_settings")
      .select("cost_limit_daily_usd")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const limitUsd = wSettings?.cost_limit_daily_usd ?? null;
    if (limitUsd != null && limitUsd > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: rows } = await ctx.admin
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
      await ctx.admin
        .from("generation_log")
        .update({ fal_status: "failed", fal_error: submitResult.error })
        .eq("id", generationId);
    }
    return NextResponse.json({ error: submitResult.error }, { status: 502 });
  }

  if (persistedLog) {
    await ctx.admin
      .from("generation_log")
      .update({ fal_request_id: submitResult.responseUrl })
      .eq("id", generationId);
  }

  return NextResponse.json({
    generationId,
    responseUrl: submitResult.responseUrl,
    status: "queued",
    model,
    endpoint,
    exactSize,
    width: useCustom && body.width ? roundTo8(body.width) : undefined,
    height: useCustom && body.height ? roundTo8(body.height) : undefined,
    aspectRatio: useCustom ? undefined : body.aspectRatio ?? "1:1",
    qualityPolicy: {
      tier: "premium_realistic",
      provider: "fal",
      noSilentDowngrade: true,
      allowCrop: false,
      reason: routingDecision?.reason ?? "default premium Kontext route",
    },
    persisted: persistedLog,
    testMode: ctx.isTestMode,
  });
}
