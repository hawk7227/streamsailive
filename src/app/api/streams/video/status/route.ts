/**
 * POST /api/streams/video/status
 *
 * Polls a fal job and, when complete, downloads the temporary provider
 * artifact, uploads it to durable Supabase storage, and finalizes the
 * generation_log record when a persisted record exists.
 *
 * This route also supports public Streams test-mode polling when the request
 * explicitly uses TEST_USER_ID. In that case, if no generation_log row exists,
 * the route still polls fal and returns a durable storage URL.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStreamsRouteContext } from "@/lib/streams/test-mode-auth";
import { falPoll, extractVideoUrl, extractAudioUrl, extractMusicUrl, extractImageUrl } from "@/lib/streams/fal-client";

export const maxDuration = 60;

const DOWNLOAD_TIMEOUT_MS = 60_000;
const STORAGE_BUCKET = "generations";

type RequestBody = {
  userId?: string;
  workspaceId?: string;
  responseUrl: string;
  generationId: string;
};

type ValidationError = { field: string; message: string };

function validateBody(raw: unknown): { body: RequestBody } | { errors: ValidationError[] } {
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
      userId: typeof obj.userId === "string" ? obj.userId.trim() : undefined,
      workspaceId: typeof obj.workspaceId === "string" ? obj.workspaceId.trim() : undefined,
      responseUrl: (obj.responseUrl as string).trim(),
      generationId: (obj.generationId as string).trim(),
    },
  };
}

async function downloadAndUpload(providerUrl: string, workspaceId: string): Promise<{ storageUrl: string; mimeType: string }> {
  const res = await fetch(providerUrl, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`DOWNLOAD_FAILED: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") ?? "video/mp4";
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("jpeg") || contentType.includes("jpg")
      ? "jpg"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("mp3") || contentType.includes("mpeg")
          ? "mp3"
          : contentType.includes("wav")
            ? "wav"
            : contentType.includes("webm")
              ? "webm"
              : "mp4";

  const storagePath = `${workspaceId}/${crypto.randomUUID()}.${ext}`;
  const arrayBuffer = await res.arrayBuffer();

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, arrayBuffer, { contentType, upsert: true });

  if (uploadError) {
    throw new Error(`STORAGE_UPLOAD_FAILED: ${uploadError.message}`);
  }

  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return { storageUrl: data.publicUrl, mimeType: contentType };
}

function extractProviderArtifactUrl(raw: unknown, generationType: string): string | null {
  if (generationType === "music") {
    return extractMusicUrl(raw) ?? extractAudioUrl(raw);
  }

  if (generationType === "voice") {
    return extractAudioUrl(raw);
  }

  if (generationType === "image") {
    return extractImageUrl(raw) ?? extractVideoUrl(raw);
  }

  return extractVideoUrl(raw) ?? extractAudioUrl(raw) ?? extractImageUrl(raw);
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
    return NextResponse.json({ error: "Validation failed", details: validated.errors }, { status: 400 });
  }

  const { responseUrl, generationId, workspaceId: requestedWorkspaceId } = validated.body;

  const ctx = await resolveStreamsRouteContext({
    request,
    body: validated.body as Record<string, unknown>,
    requireWorkspace: false,
    allowTestMode: true,
  });

  if (!ctx?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = ctx.admin as ReturnType<typeof createAdminClient>;
  const workspaceId = requestedWorkspaceId ?? ctx.workspaceId ?? "streams-public-test";

  let generationType = "video";
  let persistedLog = false;
  let finalizedUrl: string | null = null;

  const { data: logRow } = await admin
    .from("generation_log")
    .select("id, fal_status, output_url, generation_type")
    .eq("id", generationId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (logRow) {
    persistedLog = true;
    generationType = (logRow as Record<string, unknown>).generation_type as string ?? "video";

    if (logRow.fal_status === "done" && logRow.output_url) {
      return NextResponse.json({
        status: "completed",
        artifactUrl: logRow.output_url,
        generationId,
      });
    }

    if (logRow.fal_status === "failed") {
      return NextResponse.json({ status: "failed", generationId });
    }
  }

  const pollResult = await falPoll(responseUrl);

  if (pollResult.status === "processing") {
    return NextResponse.json({ status: "processing", generationId });
  }

  if (pollResult.status === "failed") {
    if (persistedLog) {
      await admin
        .from("generation_log")
        .update({ fal_status: "failed", fal_error: "fal reported FAILED" })
        .eq("id", generationId);
    }
    return NextResponse.json({ status: "failed", generationId });
  }

  const providerArtifactUrl = extractProviderArtifactUrl(pollResult.raw, generationType);

  if (!providerArtifactUrl) {
    if (persistedLog) {
      await admin
        .from("generation_log")
        .update({ fal_status: "failed", fal_error: "Provider completed but returned no artifact URL" })
        .eq("id", generationId);
    }

    return NextResponse.json(
      { status: "failed", error: "Provider returned no artifact URL", generationId },
      { status: 502 },
    );
  }

  let storageUrl: string;
  let mimeType: string;
  const uploadStart = Date.now();

  try {
    ({ storageUrl, mimeType } = await downloadAndUpload(providerArtifactUrl, workspaceId));
    finalizedUrl = storageUrl;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);

    if (persistedLog) {
      await admin
        .from("generation_log")
        .update({ fal_status: "failed", fal_error: reason })
        .eq("id", generationId);
    }

    return NextResponse.json(
      { status: "failed", error: "Upload to storage failed", generationId },
      { status: 500 },
    );
  }

  const falDurationMs = Date.now() - uploadStart;
  const rawResult = pollResult.raw as Record<string, unknown> | null;
  const costObj = rawResult ? (rawResult.cost as Record<string, unknown> | undefined) : undefined;
  const falCostUsd = costObj?.total_cost != null
    ? Number(costObj.total_cost)
    : rawResult?.cost != null
      ? Number(rawResult.cost)
      : null;

  if (persistedLog && finalizedUrl) {
    await admin
      .from("generation_log")
      .update({
        output_url: finalizedUrl,
        fal_status: "done",
        fal_duration_ms: falDurationMs,
        ...(falCostUsd != null && { cost_usd: falCostUsd }),
      })
      .eq("id", generationId);
  }

  return NextResponse.json({
    status: "completed",
    artifactUrl: finalizedUrl,
    generationId,
    mimeType,
    persisted: persistedLog,
    testMode: ctx.isTestMode,
  });
}
