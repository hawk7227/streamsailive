import { NextResponse } from "next/server";
import { buildInitialVideoReferenceBlueprint, requiredWorkerCapabilities } from "@/lib/admingeneration/video-reference-ingest";
import { createReferenceAnalysis } from "@/lib/admingeneration/video-reference-repository";
import type { VideoReferenceSourceType } from "@/lib/admingeneration/video-reference-blueprint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

function sourceTypeFor(payload: Record<string, unknown>): VideoReferenceSourceType {
  const raw = String(payload.sourceType || payload.type || "").toLowerCase();
  if (raw === "upload" || raw === "uploaded_video") return "upload";
  if (raw === "recording") return "recording";
  if (raw === "url" || raw === "direct_url") return "url";

  const url = String(payload.url || payload.sourceUrl || "");
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (url) return "url";
  return "upload";
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload || typeof payload !== "object") {
    return jsonError("Invalid video reference analysis request body.", 400);
  }

  const projectId = typeof payload.projectId === "string" ? payload.projectId : null;
  const sourceType = sourceTypeFor(payload);
  const sourceUrl = typeof payload.url === "string"
    ? payload.url.trim()
    : typeof payload.sourceUrl === "string"
      ? payload.sourceUrl.trim()
      : null;
  const sourceAssetId = typeof payload.assetId === "string"
    ? payload.assetId
    : typeof payload.sourceAssetId === "string"
      ? payload.sourceAssetId
      : null;
  const title = typeof payload.title === "string" ? payload.title : null;

  if ((sourceType === "youtube" || sourceType === "url") && !sourceUrl) {
    return jsonError("A source URL is required for YouTube/direct URL analysis.", 400);
  }

  if ((sourceType === "upload" || sourceType === "recording") && !sourceAssetId && !sourceUrl) {
    return jsonError("An uploaded video assetId or stored sourceUrl is required for uploaded video analysis.", 400);
  }

  const initial = await buildInitialVideoReferenceBlueprint({
    sourceType,
    sourceUrl,
    sourceAssetId,
    title,
  });

  const createResult = await createReferenceAnalysis({
    projectId,
    sourceType,
    sourceUrl,
    sourceAssetId,
    status: "needs_worker",
    blueprint: initial.blueprint,
    transcript: initial.transcript,
    summary: initial.blueprint.summary.conciseSummary,
    metadata: {
      source: "admingeneration-reference-analyze",
      mode: "full-video-reference-analysis",
      videoId: initial.videoId,
      channelName: initial.channelName,
      thumbnailUrl: initial.thumbnailUrl,
      requiredWorkerCapabilities: requiredWorkerCapabilities(),
      needsWorker: true,
      workerReason:
        "Full duplication-grade analysis requires ffmpeg/ffprobe frame extraction, shot detection, audio extraction, transcription, and visual/audio model analysis outside the request path.",
    },
  });

  return NextResponse.json({
    ok: true,
    route: "admingeneration-reference-analyze",
    status: createResult.record.status,
    analysisId: createResult.record.id,
    projectId,
    sourceType,
    sourceUrl,
    sourceAssetId,
    persistence: createResult.persistence,
    persistenceError: "persistenceError" in createResult ? createResult.persistenceError : null,
    requiredMigration: "requiredMigration" in createResult ? createResult.requiredMigration : null,
    blueprint: createResult.record.blueprint,
    transcript: createResult.record.transcript,
    summary: createResult.record.summary,
    worker: {
      required: true,
      capabilities: requiredWorkerCapabilities(),
      reason:
        "This route creates and persists the analysis job/initial blueprint. The complete video analyzer worker must extract frames/audio and update the same analysis row with completed blueprint data.",
    },
  });
}
