import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsResumableUploadsRepository, STREAMS_RESUMABLE_UPLOAD_LIMITS } from "@/lib/streams-mobile/resumable-uploads-repository";
import { sanitizeStreamsAIPayload } from "@/lib/streams-ai/protected-reasoning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const uploads = new StreamsResumableUploadsRepository();

function fail(error: unknown, status = 400) {
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown upload error" }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const uploadId = request.nextUrl.searchParams.get("uploadId");
    if (uploadId) {
      const upload = await uploads.get(scope, uploadId);
      if (!upload) return fail(new Error("Upload session not found"), 404);
      return NextResponse.json({ ok: true, apiVersion: "v1", upload, limits: STREAMS_RESUMABLE_UPLOAD_LIMITS });
    }
    return NextResponse.json({ ok: true, apiVersion: "v1", uploads: await uploads.list(scope, Number(request.nextUrl.searchParams.get("limit") || 100)), limits: STREAMS_RESUMABLE_UPLOAD_LIMITS });
  } catch (error) {
    return fail(error, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const uploadId = String(form.get("uploadId") || "");
      const chunkIndex = Number(form.get("chunkIndex"));
      const byteOffset = Number(form.get("byteOffset"));
      const checksum = String(form.get("checksum") || "") || null;
      const file = form.get("chunk");
      if (!uploadId || !(file instanceof File)) return fail(new Error("uploadId and chunk file are required"));
      const upload = await uploads.uploadChunk(scope, { uploadId, chunkIndex, byteOffset, bytes: Buffer.from(await file.arrayBuffer()), checksum });
      return NextResponse.json({ ok: true, apiVersion: "v1", upload });
    }
    const body = sanitizeStreamsAIPayload(await request.json().catch(() => ({}))) as Record<string, any>;
    if (!body.idempotencyKey || !body.fileName || !body.totalBytes) return fail(new Error("idempotencyKey, fileName, and totalBytes are required"));
    const upload = await uploads.create(scope, {
      idempotencyKey: body.idempotencyKey,
      fileName: body.fileName,
      mimeType: body.mimeType,
      totalBytes: body.totalBytes,
      chunkSize: body.chunkSize,
      projectId: body.projectId,
      sessionId: body.sessionId,
      deviceId: body.deviceId,
      expectedChecksum: body.expectedChecksum,
      metadata: body.metadata || {},
    });
    return NextResponse.json({ ok: true, apiVersion: "v1", upload, limits: STREAMS_RESUMABLE_UPLOAD_LIMITS }, { status: 201 });
  } catch (error) {
    return fail(error, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = sanitizeStreamsAIPayload(await request.json().catch(() => ({}))) as Record<string, any>;
    if (!body.uploadId || !body.action) return fail(new Error("uploadId and action are required"));
    if (body.action === "complete") return NextResponse.json({ ok: true, apiVersion: "v1", upload: await uploads.complete(scope, body.uploadId) });
    if (body.action === "cancel") return NextResponse.json({ ok: true, apiVersion: "v1", upload: await uploads.cancel(scope, body.uploadId) });
    return fail(new Error("action must be complete or cancel"));
  } catch (error) {
    return fail(error, 500);
  }
}
