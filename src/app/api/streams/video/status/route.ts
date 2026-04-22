/**
 * POST /api/streams/video/status
 *
 * Polls a fal job and, when complete, downloads the video from fal's
 * temporary URL, uploads it to durable Supabase storage, and finalizes
 * the generation_log record.
 *
 * Called by the client on a polling interval after /api/streams/video/generate
 * returns { status: "queued", responseUrl, generationId }.
 *
 * Flow:
 *   1. Parse + validate body
 *   2. Auth — get user
 *   3. Resolve workspace
 *   4. Authorization — verify generation_log row belongs to this workspace
 *   5. falPoll(responseUrl)
 *   6. processing → return { status: "processing" }
 *   7. failed     → mark generation_log failed → return { status: "failed" }
 *   8. completed:
 *        a. extractVideoUrl(raw) — if null, mark failed
 *        b. Download from fal temporary URL (60s timeout)
 *        c. Upload to Supabase storage bucket "generations"
 *        d. UPDATE generation_log: output_url, fal_status "done", fal_duration_ms
 *        e. return { status: "completed", artifactUrl }
 *
 * Artifact write decision:
 *   artifacts.generation_id is NOT NULL REFERENCES generations(id).
 *   This panel writes to generation_log, not generations.
 *   Writing to artifacts would require writing to generations — coupling the
 *   standalone panel to the existing system. That violates the standalone contract.
 *   Output URL is stored in generation_log.output_url only.
 *   The panel's library reads from generation_log.
 *
 * Upload pattern:
 *   Copied from video-runtime/storage/uploadVideoArtifact.ts — not imported.
 *   Bucket: "generations" (existing, confirmed in migrations).
 *   Path: {workspaceId}/{uuid}.{ext}
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { falPoll, extractVideoUrl, extractAudioUrl, extractMusicUrl } from "@/lib/streams/fal-client";

export const maxDuration = 60;

// ─── Constants ────────────────────────────────────────────────────────────────

const DOWNLOAD_TIMEOUT_MS = 60_000;
const STORAGE_BUCKET      = "generations";

// ─── Input contract ───────────────────────────────────────────────────────────

type RequestBody = {
  responseUrl:  string;
  generationId: string;
};

type ValidationError = { field: string; message: string };

function validateBody(
  raw: unknown,
): { body: RequestBody } | { errors: ValidationError[] } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { errors: [{ field: "body", message: "Request body must be a JSON object" }] };
  }

  const obj = raw as Record<string, unknown>;
  const errors: ValidationError[] = [];

  if (typeof obj.responseUrl !== "string" || obj.responseUrl.trim().length === 0) {
    errors.push({ field: "responseUrl", message: "responseUrl is required" });
  }

  if (typeof obj.generationId !== "string" || obj.generationId.trim().length === 0) {
    errors.push({ field: "generationId", message: "generationId is required" });
  }

  if (errors.length > 0) return { errors };

  return {
    body: {
      responseUrl:  (obj.responseUrl  as string).trim(),
      generationId: (obj.generationId as string).trim(),
    },
  };
}

// ─── Storage: download from fal + upload to Supabase ─────────────────────────
// Pattern copied from video-runtime/storage/uploadVideoArtifact.ts.
// Not imported — owned by this module.

async function downloadAndUpload(
  providerUrl: string,
  workspaceId: string,
): Promise<{ storageUrl: string; mimeType: string }> {
  const res = await fetch(providerUrl, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`DOWNLOAD_FAILED: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") ?? "video/mp4";
  const ext         = contentType.includes("webm") ? "webm" : "mp4";
  const storagePath = `${workspaceId}/${crypto.randomUUID()}.${ext}`;
  const arrayBuffer = await res.arrayBuffer();

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, arrayBuffer, { contentType, upsert: true });

  if (uploadError) {
    throw new Error(`STORAGE_UPLOAD_FAILED: ${uploadError.message}`);
  }

  const { data } = admin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return { storageUrl: data.publicUrl, mimeType: contentType };
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

  const { responseUrl, generationId } = validated.body;

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
      event: "STREAMS_STATUS_WORKSPACE_FAILED",
      userId: user.id,
      reason: err instanceof Error ? err.message : String(err),
    }));
    return NextResponse.json({ error: "Could not resolve workspace" }, { status: 500 });
  }

  // 5. Authorization — verify this generation_log row belongs to this workspace
  // Prevents one workspace from polling another workspace's fal job
  const { data: logRow, error: logError } = await admin
    .from("generation_log")
    .select("id, fal_status, output_url, generation_type")
    .eq("id", generationId)
    .eq("workspace_id", workspaceId)
    .single();

  if (logError || !logRow) {
    return NextResponse.json(
      { error: "Generation not found" },
      { status: 404 },
    );
  }

  // 6. If already finalized — return current state without polling fal again
  if (logRow.fal_status === "done" && logRow.output_url) {
    return NextResponse.json({
      status:      "completed",
      artifactUrl: logRow.output_url,
      generationId,
    });
  }

  if (logRow.fal_status === "failed") {
    return NextResponse.json({ status: "failed", generationId });
  }

  // 7. Poll fal
  const pollResult = await falPoll(responseUrl);

  if (pollResult.status === "processing") {
    return NextResponse.json({ status: "processing", generationId });
  }

  if (pollResult.status === "failed") {
    await admin
      .from("generation_log")
      .update({ fal_status: "failed", fal_error: "fal reported FAILED" })
      .eq("id", generationId);

    console.error(JSON.stringify({
      level: "error",
      event: "STREAMS_VIDEO_FAL_FAILED",
      generationId,
      workspaceId,
    }));

    return NextResponse.json({ status: "failed", generationId });
  }

  // pollResult.status === "completed"

  // 8a. Extract output URL — strategy depends on generation_type
  // Video:        extractVideoUrl  (Kling, Veo, etc.)
  // Music/Voice:  extractAudioUrl  (ElevenLabs TTS, MiniMax)
  // Music cover:  extractMusicUrl  (MiniMax Music)
  // Image:        extractVideoUrl  falls back gracefully; images often return { url: string }
  const genType = (logRow as Record<string, unknown>).generation_type as string ?? "video";

  let providerVideoUrl: string | null = null;
  if (genType === "music") {
    providerVideoUrl = extractMusicUrl(pollResult.raw) ?? extractAudioUrl(pollResult.raw);
  } else if (genType === "voice") {
    providerVideoUrl = extractAudioUrl(pollResult.raw);
  } else {
    // video, image, motion, video_t2v, video_i2v — try video first, fall back to audio
    providerVideoUrl = extractVideoUrl(pollResult.raw) ?? extractAudioUrl(pollResult.raw);
  }

  if (!providerVideoUrl) {
    await admin
      .from("generation_log")
      .update({
        fal_status: "failed",
        fal_error:  "fal completed but returned no video URL",
      })
      .eq("id", generationId);

    console.error(JSON.stringify({
      level: "error",
      event: "STREAMS_VIDEO_NO_URL",
      generationId,
      workspaceId,
      raw: JSON.stringify(pollResult.raw).slice(0, 200),
    }));

    return NextResponse.json(
      { status: "failed", error: "Provider returned no video URL", generationId },
      { status: 502 },
    );
  }

  // 8b + 8c. Download from fal's temporary URL → upload to durable Supabase storage
  const uploadStart = Date.now();
  let storageUrl: string;
  let mimeType: string;

  try {
    ({ storageUrl, mimeType } = await downloadAndUpload(providerVideoUrl, workspaceId));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);

    await admin
      .from("generation_log")
      .update({ fal_status: "failed", fal_error: reason })
      .eq("id", generationId);

    console.error(JSON.stringify({
      level: "error",
      event: "STREAMS_VIDEO_UPLOAD_FAILED",
      generationId,
      workspaceId,
      reason,
    }));

    return NextResponse.json(
      { status: "failed", error: "Upload to storage failed", generationId },
      { status: 500 },
    );
  }

  const falDurationMs = Date.now() - uploadStart;

  // 8d. Finalize generation_log — durable URL only, never the fal temporary URL
  await admin
    .from("generation_log")
    .update({
      output_url:      storageUrl,
      fal_status:      "done",
      fal_duration_ms: falDurationMs,
    })
    .eq("id", generationId);

  console.log(JSON.stringify({
    level: "info",
    event: "STREAMS_VIDEO_COMPLETED",
    generationId,
    workspaceId,
    storageUrl,
    mimeType,
    falDurationMs,
  }));

  // 8e. Return durable storage URL — never the fal temporary URL
  return NextResponse.json({
    status:      "completed",
    artifactUrl: storageUrl,
    generationId,
  });
}
