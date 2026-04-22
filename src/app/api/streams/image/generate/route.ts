/**
 * POST /api/streams/image/generate
 *
 * FLUX Kontext (aspect ratio) or FLUX Dev/LoRA (custom px with rounding).
 * Custom sizing rule: Math.round(value / 8) * 8 — enforced server-side.
 * Models that support custom px: flux-dev, flux-lora, seedream
 * Models that use aspect ratio enum: kontext, kontext-max, recraft-v4
 *
 * Returns { generationId, responseUrl } — client polls /api/streams/video/status.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { falSubmit, FAL_ENDPOINTS } from "@/lib/streams/fal-client";

export const maxDuration = 60;

// Custom-px models — others use aspect ratio enum
const CUSTOM_PX_MODELS = new Set(["flux-dev", "flux-lora", "seedream", "flux-pro"]);

// Brand name → fal endpoint
const MODEL_ENDPOINTS: Record<string, string> = {
  "kontext":     FAL_ENDPOINTS.FLUX_KONTEXT,
  "kontext-max": FAL_ENDPOINTS.FLUX_KONTEXT_MAX,
  "flux-pro":    FAL_ENDPOINTS.FLUX_PRO,
  "flux-dev":    FAL_ENDPOINTS.FLUX_DEV,
  "flux-lora":   FAL_ENDPOINTS.FLUX_LORA,
  "design":      FAL_ENDPOINTS.RECRAFT_V4,
  "seedream":    FAL_ENDPOINTS.SEEDREAM,
};

function roundTo8(v: number): number {
  return Math.round(v / 8) * 8;
}

type RequestBody = {
  model?:       string;
  prompt:       string;
  aspectRatio?: string;
  width?:       number;
  height?:      number;
  numImages?:   number;
};

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody: unknown;
  try { rawBody = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = rawBody as RequestBody;

  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = sel.current.workspace.id;
  } catch {
    return NextResponse.json({ error: "Could not resolve workspace" }, { status: 500 });
  }

  const model    = (body.model ?? "kontext").toLowerCase().replace(/\s+/g, "-");
  const endpoint = MODEL_ENDPOINTS[model] ?? FAL_ENDPOINTS.FLUX_KONTEXT;
  const useCustom = CUSTOM_PX_MODELS.has(model) && body.width && body.height;

  // Build fal input
  const falInput: Record<string, unknown> = {
    prompt:     body.prompt.trim(),
    num_images: Math.min(body.numImages ?? 1, 4),
  };

  if (useCustom && body.width && body.height) {
    // Server-side rounding — client preview value was already rounded but enforce here too
    falInput.width  = roundTo8(body.width);
    falInput.height = roundTo8(body.height);
  } else {
    falInput.aspect_ratio = body.aspectRatio ?? "1:1";
  }

  const generationId = crypto.randomUUID();
  await admin.from("generation_log").insert({
    id:              generationId,
    workspace_id:    workspaceId,
    generation_type: "image",
    model,
    fal_endpoint:    endpoint,
    input_params:    falInput,
    fal_status:      "pending",
  });

  const submitResult = await falSubmit(endpoint, falInput);

  if (!submitResult.ok) {
    await admin.from("generation_log").update({ fal_status: "failed", fal_error: submitResult.error }).eq("id", generationId);
    return NextResponse.json({ error: submitResult.error }, { status: 502 });
  }

  await admin.from("generation_log").update({ fal_request_id: submitResult.responseUrl }).eq("id", generationId);

  return NextResponse.json({ generationId, responseUrl: submitResult.responseUrl, status: "queued", model, endpoint });
}
