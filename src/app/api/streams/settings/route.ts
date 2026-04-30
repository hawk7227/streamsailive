/**
 * GET  /api/streams/settings  — load workspace settings
 * POST /api/streams/settings  — save workspace settings
 *
 * Reads/writes workspace_settings via admin client.
 * Public /streams test mode is allowed only when the request explicitly uses
 * TEST_USER_ID. In that mode, routes can respond without forcing a login.
 */

import { NextResponse } from "next/server";
import { resolveStreamsRouteContext, isFallbackTestWorkspace } from "@/lib/streams/test-mode-auth";

export const maxDuration = 30;

type SettingsBody = {
  userId?: string;
  workspaceId?: string;
  default_video_model?: string;
  default_image_model?: string;
  default_voice_model?: string;
  default_music_model?: string;
  cost_limit_daily_usd?: number | null;
  cost_limit_monthly_usd?: number | null;
  quality_preset?: "fast" | "standard" | "pro";
  watermark_enabled?: boolean;
  fal_key_hint?: string;
  elevenlabs_key_hint?: string;
  openai_key_hint?: string;
};

export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await resolveStreamsRouteContext({ request, requireWorkspace: false, allowTestMode: true });
  if (!ctx?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = ctx.workspaceId;
  if (!workspaceId || (ctx.isTestMode && isFallbackTestWorkspace(workspaceId))) {
    return NextResponse.json({ settings: null, testMode: ctx.isTestMode, persisted: false });
  }

  const { data, error } = await ctx.admin
    .from("workspace_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }

  return NextResponse.json({ settings: data ?? null, testMode: ctx.isTestMode, persisted: true });
}

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = rawBody as SettingsBody;
  const ctx = await resolveStreamsRouteContext({
    request,
    body: body as Record<string, unknown>,
    requireWorkspace: false,
    allowTestMode: true,
  });

  if (!ctx?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = body.workspaceId ?? ctx.workspaceId;
  if (!workspaceId || (ctx.isTestMode && isFallbackTestWorkspace(workspaceId))) {
    return NextResponse.json({ ok: true, testMode: true, persisted: false });
  }

  const upsertData = {
    workspace_id: workspaceId,
    ...(body.default_video_model !== undefined && { default_video_model: body.default_video_model }),
    ...(body.default_image_model !== undefined && { default_image_model: body.default_image_model }),
    ...(body.default_voice_model !== undefined && { default_voice_model: body.default_voice_model }),
    ...(body.default_music_model !== undefined && { default_music_model: body.default_music_model }),
    ...(body.cost_limit_daily_usd !== undefined && { cost_limit_daily_usd: body.cost_limit_daily_usd }),
    ...(body.cost_limit_monthly_usd !== undefined && { cost_limit_monthly_usd: body.cost_limit_monthly_usd }),
    ...(body.quality_preset !== undefined && { quality_preset: body.quality_preset }),
    ...(body.watermark_enabled !== undefined && { watermark_enabled: body.watermark_enabled }),
    ...(body.fal_key_hint !== undefined && { fal_key_hint: body.fal_key_hint }),
    ...(body.elevenlabs_key_hint !== undefined && { elevenlabs_key_hint: body.elevenlabs_key_hint }),
    ...(body.openai_key_hint !== undefined && { openai_key_hint: body.openai_key_hint }),
    updated_at: new Date().toISOString(),
  };

  const { error } = await ctx.admin
    .from("workspace_settings")
    .upsert(upsertData, { onConflict: "workspace_id" });

  if (error) {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, testMode: ctx.isTestMode, persisted: true });
}
