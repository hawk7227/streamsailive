import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { processUploadedAssets, processUploadedAsset } from "@/lib/streams-ai/asset-processing";
import { StreamsAIAssetsRepository } from "@/lib/streams-ai/repositories/assets-repository";

const assets = new StreamsAIAssetsRepository();

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
      const files = form.getAll("file").filter((item): item is File => item instanceof File);
      if (!files.length) return streamsAIJson({ ok: false, error: "file is required" }, 400);

      const sessionId = stringOrNull(form.get("sessionId")) || inferSessionIdFromRequest(request);
      const projectId = stringOrNull(form.get("projectId"));
      const messageId = stringOrNull(form.get("messageId"));
      const productId = stringOrNull(form.get("productId"));

      const uploaded = [];
      for (const file of files) {
        uploaded.push(
          await assets.uploadFile(scope, file, {
            sessionId,
            projectId,
            messageId,
            productId,
            metadata: { source: "streams-ai-upload", uploadStatus: "stored", processingStatus: "queued" },
          }),
        );
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
          } : {
            processingStatus: "failed",
            extractionStatus: "failed",
            processingError: result?.error || "Processing failed",
          }),
        };
        return withProcessedMetadata({ ...asset, metadata });
      });

      return streamsAIJson({ ok: true, assets: normalized, processing }, 201);
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
    summary: metadata.summary || "",
    extractionError: metadata.processingError || "",
    status: metadata.processingStatus === "failed" ? "error" : "ready",
  };
}
