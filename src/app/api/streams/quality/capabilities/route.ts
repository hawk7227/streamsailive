import { NextResponse } from "next/server";
import { resolveStreamsRouteContext } from "@/lib/streams/test-mode-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

const DEFAULT_CAPABILITIES = [
  {
    provider: "fal",
    model: "flux-pro-kontext",
    media_type: "image",
    supports_exact_dimensions: false,
    supports_bulk: true,
    supports_img2img: true,
    supports_inpaint: false,
    supports_outpaint: false,
    supports_upscale: false,
    supported_aspect_ratios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    realism_tier: 5,
    prompt_adherence_tier: 5,
    speed_tier: 3,
    cost_tier: 3,
    active: true,
  },
  {
    provider: "fal",
    model: "flux-dev",
    media_type: "image",
    supports_exact_dimensions: true,
    supports_bulk: true,
    supports_img2img: false,
    supports_inpaint: false,
    supports_outpaint: false,
    supports_upscale: false,
    supported_aspect_ratios: [],
    min_width: 256,
    max_width: 1440,
    min_height: 256,
    max_height: 1440,
    realism_tier: 4,
    prompt_adherence_tier: 4,
    speed_tier: 4,
    cost_tier: 2,
    active: true,
  },
  {
    provider: "fal",
    model: "kling-v3-standard",
    media_type: "video",
    supports_exact_dimensions: false,
    supports_bulk: false,
    supported_aspect_ratios: ["16:9", "9:16", "1:1"],
    realism_tier: 4,
    prompt_adherence_tier: 4,
    speed_tier: 3,
    cost_tier: 4,
    active: true,
  }
];

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveStreamsRouteContext({ request, requireWorkspace: false, allowTestMode: true });
  if (!ctx?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.admin
    .from("streams_provider_capabilities")
    .select("*")
    .eq("active", true)
    .order("media_type");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], testMode: ctx.isTestMode });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { body = {}; }

  const ctx = await resolveStreamsRouteContext({ request, body, requireWorkspace: false, allowTestMode: true });
  if (!ctx?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await ctx.admin
    .from("streams_provider_capabilities")
    .upsert(DEFAULT_CAPABILITIES, { onConflict: "provider,model,media_type" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, inserted: DEFAULT_CAPABILITIES.length, testMode: ctx.isTestMode });
}
