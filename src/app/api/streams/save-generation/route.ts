/**
 * POST /api/streams/save-generation
 *
 * Called by the browser after a direct provider call completes.
 * Saves the completed generation to generation_log so it appears
 * in the Library and gallery views.
 *
 * Direct calls (fal-direct, openai-direct) bypass the server-side
 * generation routes that would normally write to generation_log.
 * This endpoint writes the final row after the fact.
 *
 * Body:
 *   type:       "image" | "video" | "voice" | "music"
 *   outputUrl:  string   — final output URL from provider
 *   prompt:     string   — user prompt
 *   model?:     string   — model name
 *   provider?:  string   — "fal" | "openai" | "elevenlabs" | "runway"
 *   costUsd?:   number   — approximate cost
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";

export const maxDuration = 15;

type SaveBody = {
  type:      "image" | "video" | "voice" | "music";
  outputUrl: string;
  prompt:    string;
  model?:    string;
  provider?: string;
  costUsd?:  number;
};

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: SaveBody;
  try {
    body = await request.json() as SaveBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.outputUrl || !body.type || !body.prompt) {
    return NextResponse.json({ error: "outputUrl, type, and prompt are required" }, { status: 400 });
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
    .from("generation_log")
    .insert({
      workspace_id:    workspaceId,
      generation_type: body.type,
      model:           body.model ?? body.provider ?? "direct",
      fal_endpoint:    body.provider ?? "direct",
      input_params:    { prompt: body.prompt },
      fal_status:      "done",
      output_url:      body.outputUrl,
      cost_usd:        body.costUsd ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: `Failed to save: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, saved: true }, { status: 201 });
}
