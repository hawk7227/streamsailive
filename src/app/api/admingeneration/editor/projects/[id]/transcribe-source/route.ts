import { NextResponse } from "next/server";
import {
  createTargetedEdit,
  getEditorProjectBundle,
  persistTranscriptWordsFromAnalyzer,
} from "@/lib/admingeneration/db/editor-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function internalUrl(request: Request, path: string) {
  return new URL(path, new URL(request.url).origin).toString();
}

function extractWords(result: any): any[] {
  return (
    result?.words ||
    result?.transcript?.words ||
    result?.result?.words ||
    result?.result?.transcript?.words ||
    result?.data?.words ||
    []
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const params = await context.params;
    const projectId = params.id;
    const body = await request.json().catch(() => ({}));

    const bundle = await getEditorProjectBundle(projectId);
    const sourceAsset =
      bundle.assets.find((asset: any) => String(asset.asset_kind || "").includes("source_video")) ||
      bundle.assets.find((asset: any) => String(asset.mime_type || "").startsWith("video/")) ||
      null;

    const sourceUrl =
      body.sourceUrl ||
      body.assetUrl ||
      sourceAsset?.asset_url ||
      sourceAsset?.url ||
      null;

    if (!sourceUrl) {
      return NextResponse.json(
        {
          ok: false,
          status: "missing_source_video",
          error: "No source video URL is available for transcription.",
        },
        { status: 422 },
      );
    }

    const transcriptResponse = await fetch(
      internalUrl(request, "/api/pipeline-test/transcript/transcribe"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          projectId,
          sourceUrl,
          assetId: sourceAsset?.id || body.sourceAssetId || null,
          analysisId: body.analysisId || bundle.project?.analysis_id || null,
          source: "admingeneration-editor-current-video",
        }),
      },
    );

    const transcriptResult = await transcriptResponse.json().catch(() => null);
    const words = extractWords(transcriptResult);

    if (!transcriptResponse.ok || !words.length) {
      const queued = await createTargetedEdit({
        projectId,
        action: "transcription",
        targetType: "source_video",
        targetId: sourceAsset?.id || null,
        instruction: "Transcribe the currently loaded source video.",
        selected: {
          sourceUrl,
          sourceAssetId: sourceAsset?.id || null,
          transcriptionResponseStatus: transcriptResponse.status,
          transcriptionResult: transcriptResult,
        },
        providerIntent: "stt",
      });

      return NextResponse.json(
        {
          ok: false,
          status: "transcription_provider_output_missing",
          error: "Transcription route did not return word timestamps for the current video.",
          projectId,
          sourceUrl,
          queued,
        },
        { status: 502 },
      );
    }

    const persisted = await persistTranscriptWordsFromAnalyzer({
      projectId,
      words,
      segmentId: body.segmentId || null,
    });

    const queued = await createTargetedEdit({
      projectId,
      action: "transcription",
      targetType: "source_video",
      targetId: sourceAsset?.id || null,
      instruction: "Transcribed currently loaded source video.",
      selected: {
        sourceUrl,
        sourceAssetId: sourceAsset?.id || null,
        insertedWords: persisted.insertedWords,
      },
      providerIntent: "stt",
    });

    return NextResponse.json({
      ok: true,
      status: "transcribed",
      projectId,
      sourceUrl,
      insertedWords: persisted.insertedWords,
      providerRun: queued.providerRun,
      version: queued.version,
      editJob: queued.editJob,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
