import { after, type NextRequest } from "next/server";
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

      const uploaded: Record<string, any>[] = [];
      const failures: Array<{ name: string; error: string }> = [];
      for (const file of files) {
        try {
          uploaded.push(
            await assets.uploadFile(scope, file, {
              sessionId,
              projectId,
              messageId,
              productId,
              metadata: {
                source: "streams-ai-upload",
                uploadStatus: "stored",
                processingStatus: "queued",
                extractionStatus: "queued",
              },
            }) as Record<string, any>,
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
          error: failures[0]?.error || "The files could not be stored.",
          code: "STREAMS_UPLOAD_STORAGE_FAILED",
          failures,
        }, 500);
      }

      const storedAssets = uploaded.map((asset) => withProcessedMetadata(asset));

      // Never keep the client request open while parsing PDFs, Office files, EPUBs,
      // spreadsheets, or building retrieval chunks. The files are already durable.
      // Processing continues after the response and can be refreshed through GET.
      after(async () => {
        try {
          await processUploadedAssets(scope, uploaded);
        } catch (error) {
          console.error("[streams-ai/assets] deferred processing failed", error);
        }
      });

      return streamsAIJson({
        ok: true,
        assets: storedAssets,
        failures,
        partial: failures.length > 0,
        processingDeferred: true,
        storedCount: uploaded.length,
        failedCount: failures.length,
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
      metadata: { ...(body.metadata || {}), processingStatus: "queued", extractionStatus: "queued" },
    });

    after(async () => {
      try {
        await processUploadedAsset(scope, asset as Record<string, any>);
      } catch (error) {
        console.error("[streams-ai/assets] deferred processing failed", error);
      }
    });

    return streamsAIJson({
      ok: true,
      asset: withProcessedMetadata(asset as Record<string, any>),
      processingDeferred: true,
    }, 201);
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
  const processingStatus = metadata.processingStatus || metadata.extractionStatus || "stored";
  return {
    ...asset,
    processingStatus,
    extractionStatus: metadata.extractionStatus || processingStatus,
    textPreview: metadata.textPreview || "",
    textChunkCount: metadata.chunkCount || 0,
    pageCount: metadata.pageCount || null,
    summary: metadata.summary || "",
    extractionError: metadata.processingError || "",
    status: processingStatus === "failed" ? "processing_error" : processingStatus === "ready" ? "ready" : "stored",
  };
}
