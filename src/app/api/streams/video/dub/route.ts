/**
 * POST /api/streams/video/dub
 *
 * Language dubbing via ElevenLabs dubbing API (fal proxy).
 * One call: translation + voice synthesis + lipsync.
 * Cost: $0.90/min. Writes new video_versions row.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { falSubmit, FAL_ENDPOINTS } from "@/lib/streams/fal-client";

export const maxDuration = 60;

const SUPPORTED_LANGUAGES = [
  "es","fr","de","ja","pt","it","hi","ko","ar","zh","ru","nl","sv","pl","tr",
] as const;

type Language = typeof SUPPORTED_LANGUAGES[number];

type RequestBody = {
  generationLogId: string;
  videoUrl:        string;
  targetLanguage:  Language;
  sourceLanguage?: string;  // auto-detected if not provided
};

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody: unknown;
  try { rawBody = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = rawBody as RequestBody;

  if (!body.videoUrl || !body.targetLanguage) {
    return NextResponse.json({ error: "videoUrl and targetLanguage are required" }, { status: 400 });
  }

  if (!SUPPORTED_LANGUAGES.includes(body.targetLanguage)) {
    return NextResponse.json({
      error: `Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(", ")}`,
    }, { status: 400 });
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

  const dubResult = await falSubmit(FAL_ENDPOINTS.ELEVENLABS_DUBBING, {
    video_url:        body.videoUrl,
    target_language:  body.targetLanguage,
    source_language:  body.sourceLanguage ?? "auto",
  });

  if (!dubResult.ok) {
    return NextResponse.json({ error: `Dub submit failed: ${dubResult.error}` }, { status: 502 });
  }

  const versionId = crypto.randomUUID();
  await admin.from("video_versions").insert({
    id:               versionId,
    workspace_id:     workspaceId,
    generation_log_id: body.generationLogId,
    edit_type:        "language_dub",
    edit_metadata:    {
      target_language:  body.targetLanguage,
      source_language:  body.sourceLanguage ?? "auto",
      dub_request_id:   dubResult.responseUrl,
    },
  });

  return NextResponse.json({
    versionId,
    dubRequestId:    dubResult.responseUrl,
    status:          "processing",
    targetLanguage:  body.targetLanguage,
  });
}
