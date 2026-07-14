import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { processUploadedAssets, processUploadedAsset } from "@/lib/streams-ai/asset-processing";
import { StreamsAIAssetsRepository } from "@/lib/streams-ai/repositories/assets-repository";

const assets = new StreamsAIAssetsRepository();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isUploadFileLike(value: FormDataEntryValue): value is File {
  return typeof value !== "string"
    && typeof (value as File)?.arrayBuffer === "function"
    && typeof (value as File)?.name === "string"
    && Number.isFinite(Number((value as File)?.size));
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const data = await assets.list(scope, { projectId, sessionId });
    return streamsAIJson({ ok: true, assets: data.map(withProcessedMetadata) });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const files = form.getAll("file").filter(isUploadFileLike);
      if (!files.length) {
        return streamsAIJson({
          ok: false,
          error: "No readable file was received. Please select the file again.",
          code: "STREAMS_UPLOAD_FILE_MISSING",
        }, 400);
      }

      const sessionId = stringOrNull(form.get("sessionId")) || inferSessionIdFromRequest(request);
      const projectId = stringOrNull(form.get("projectId"));
      const messageId = stringOrNull(form.get("messageId"));
      const productId = stringOrNull(form.get("productId"));

      const uploaded = [];
      const failures: Array<{ name: string; error: string }> = [];
      for (const file of files) {
        try {
          uploaded.push(
            await assets.uploadFile(scope, file, {
              sessionId,
              projectId,
              messageId,
              productId,
              metadata: { source: "streams-ai-upload", uploadStatus: "stored", processingStatus: "queued" },
            }),
          );
        } catch (error) {
          failures.push({
            name: file.name || "Uploaded file",
            error: error instanceof Error ? error.message : String(error || "Upload failed"),
          });
        }
      }

      if (!uploaded.length) {
        return streamsAIJson({
          ok: false,
          error: failures[0]?.error || "The file could not be stored.",
          code: "STREAMS_UPLOAD_STORAGE_FAILED",
          failures,
        }, 500);
      }

      const processing = await processUploadedAssets(scope, uploaded as Record<string, any>[]);
      const normalized = uploaded.map((asset: Record<string, any>, index) => {
        const result = processing[index] || {};
        const metadata = {
          ...(asset.metadata || {}),
          ...(result?.ok ? {
            processingStatus: result?.status || "ready",
            extractionStatus: result?.status || "ready",
            chunkCount: result?.chunkCount || 0,
            summary: result?.summary || null,
            textPreview: result?.textPreview || null,
            pageCount: result?.pageCount || null,
          } : {
            processingStatus: "failed",
            extractionStatus: "failed",
            processingError: result?.error || "Processing failed",
          }),
        };
        return withProcessedMetadata({ ...asset, metadata });
      });

      return streamsAIJson({
        ok: true,
        assets: normalized,
        processing,
        failures,
        partial: failures.length > 0,
      }, failures.length ? 207 : 201);
    }

    const body = await readJsonBody<{
      name?: string;
      kind?: string;
      projectId?: string | null;
      sessionId?: string | null;
      messageId?: string | null;
      productId?: string | null;
      mimeType?: string | null;
      sizeBytes?: number;
      storageBucket?: string | null;
      storagePath?: string | null;
      publicUrl?: string | null;
      metadata?: Record<string, unknown>;
    }>(request);

    if (!body.name?.trim()) return streamsAIJson({ ok: false, error: "name is required" }, 400);

    const asset = await assets.create(scope, {
      name: body.name,
      kind: body.kind,
      projectId: body.projectId,
      sessionId: body.sessionId,
      messageId: body.messageId,
      productId: body.productId,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      storageBucket: body.storageBucket,
      storagePath: body.storagePath,
      publicUrl: body.publicUrl,
      metadata: { ...(body.metadata || {}), processingStatus: "queued" },
    });

    const processing = await processUploadedAsset(scope, asset as Record<string, any>);
    return streamsAIJson({ ok: true, asset: withProcessedMetadata(asset as Record<string, any>), processing }, 201);
  } catch (error) {
    return streamsAIError(error);
  }
}

function stringOrNull(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function inferSessionIdFromRequest(request: NextRequest) {
  const referer = request.headers.get("referer") || request.headers.get("referrer") || "";
  try {
    const path = new URL(referer).pathname;
    const parts = path.split("/").filter(Boolean);
    return parts[0] === "streams-ai" && parts[1] ? parts[1] : null;
  } catch {
    return null;
  }
}

function withProcessedMetadata(asset: Record<string, any>) {
  const metadata = asset.metadata || {};
  return {
    ...asset,
    processingStatus: metadata.processingStatus || metadata.extractionStatus || "stored",
    extractionStatus: metadata.extractionStatus || metadata.processingStatus || "stored",
    textPreview: metadata.textPreview || "",
    textChunkCount: metadata.chunkCount || 0,
    pageCount: metadata.pageCount || null,
    summary: metadata.summary || "",
    extractionError: metadata.processingError || "",
    status: metadata.processingStatus === "failed" ? "processing_error" : "ready",
  };
}
