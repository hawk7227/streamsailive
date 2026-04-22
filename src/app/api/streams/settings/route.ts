/**
 * GET  /api/streams/settings  — load workspace settings
 * POST /api/streams/settings  — save workspace settings
 *
 * Reads/writes workspace_settings table via admin client.
 * API key values are never stored in plaintext — only the last 4 chars
 * are stored as hints for masked display in the UI.
 * Actual key validation is done by TestKey action on the frontend.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";

export const maxDuration = 30;

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = sel.current.workspace.id;
  } catch {
    return NextResponse.json({ error: "Could not resolve workspace" }, { status: 500 });
  }

  const { data, error } = await admin
    .from("workspace_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows — first load, return defaults
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }

  return NextResponse.json({ settings: data ?? null });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

type SettingsBody = {
  default_video_model?:    string;
  default_image_model?:    string;
  default_voice_model?:    string;
  default_music_model?:    string;
  cost_limit_daily_usd?:   number | null;
  cost_limit_monthly_usd?: number | null;
  quality_preset?:         "fast" | "standard" | "pro";
  watermark_enabled?:      boolean;
  // Key hints — UI sends only last 4 chars, never full key
  fal_key_hint?:           string;
  elevenlabs_key_hint?:    string;
  openai_key_hint?:        string;
};

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try { rawBody = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = rawBody as SettingsBody;

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = sel.current.workspace.id;
  } catch {
    return NextResponse.json({ error: "Could not resolve workspace" }, { status: 500 });
  }

  const upsertData = {
    workspace_id:             workspaceId,
    ...(body.default_video_model    !== undefined && { default_video_model:    body.default_video_model    }),
    ...(body.default_image_model    !== undefined && { default_image_model:    body.default_image_model    }),
    ...(body.default_voice_model    !== undefined && { default_voice_model:    body.default_voice_model    }),
    ...(body.default_music_model    !== undefined && { default_music_model:    body.default_music_model    }),
    ...(body.cost_limit_daily_usd   !== undefined && { cost_limit_daily_usd:   body.cost_limit_daily_usd   }),
    ...(body.cost_limit_monthly_usd !== undefined && { cost_limit_monthly_usd: body.cost_limit_monthly_usd }),
    ...(body.quality_preset         !== undefined && { quality_preset:         body.quality_preset         }),
    ...(body.watermark_enabled      !== undefined && { watermark_enabled:      body.watermark_enabled      }),
    ...(body.fal_key_hint           !== undefined && { fal_key_hint:           body.fal_key_hint           }),
    ...(body.elevenlabs_key_hint    !== undefined && { elevenlabs_key_hint:    body.elevenlabs_key_hint    }),
    ...(body.openai_key_hint        !== undefined && { openai_key_hint:        body.openai_key_hint        }),
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("workspace_settings")
    .upsert(upsertData, { onConflict: "workspace_id" });

  if (error) {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
