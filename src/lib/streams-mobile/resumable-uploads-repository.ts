import { createHash } from "node:crypto";
import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";
import { StreamsAIAssetsRepository } from "@/lib/streams-ai/repositories/assets-repository";
import { sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "@/lib/streams-ai/protected-reasoning";

const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;
const MIN_CHUNK_BYTES = 64 * 1024;
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

function safeFileName(value: string) {
  return sanitizeStreamsAIText(value, 255).replace(/[^a-zA-Z0-9._-]/g, "_") || "upload.bin";
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export class StreamsResumableUploadsRepository {
  private service = createStreamsAIServiceClient();
  private assets = new StreamsAIAssetsRepository();
  private db() { return streamsAISchema(this.service); }

  async list(scope: StreamsAIScope, limit = 100) {
    const { data, error } = await this.db().from(streamsAITables.uploadSessions).select("*")
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId)
      .order("updated_at", { ascending: false }).limit(Math.max(1, Math.min(limit, 250)));
    if (error) throw new Error(`Failed to list Streams upload sessions: ${error.message}`);
    return data || [];
  }

  async get(scope: StreamsAIScope, uploadId: string) {
    const { data: session, error } = await this.db().from(streamsAITables.uploadSessions).select("*")
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", uploadId).maybeSingle();
    if (error) throw new Error(`Failed to read Streams upload session: ${error.message}`);
    if (!session) return null;
    const { data: chunks, error: chunkError } = await this.db().from(streamsAITables.uploadChunks).select("*")
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("upload_session_id", uploadId).order("chunk_index");
    if (chunkError) throw new Error(`Failed to read Streams upload chunks: ${chunkError.message}`);
    return { ...session, chunks: chunks || [], nextOffset: Number(session.confirmed_bytes || 0) };
  }

  async create(scope: StreamsAIScope, input: {
    idempotencyKey: string;
    fileName: string;
    mimeType?: string | null;
    totalBytes: number;
    chunkSize?: number;
    projectId?: string | null;
    sessionId?: string | null;
    deviceId?: string | null;
    expectedChecksum?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const idempotencyKey = sanitizeStreamsAIText(input.idempotencyKey, 300).trim();
    if (!idempotencyKey) throw new Error("idempotencyKey is required");
    const totalBytes = Math.trunc(Number(input.totalBytes));
    if (!Number.isFinite(totalBytes) || totalBytes <= 0 || totalBytes > MAX_UPLOAD_BYTES) throw new Error(`totalBytes must be between 1 and ${MAX_UPLOAD_BYTES}`);
    const chunkSize = Math.max(MIN_CHUNK_BYTES, Math.min(MAX_CHUNK_BYTES, Math.trunc(Number(input.chunkSize || 4 * 1024 * 1024))));
    const totalChunks = Math.ceil(totalBytes / chunkSize);
    const bucket = process.env.STREAMS_AI_ASSETS_BUCKET || "streams-ai-assets";
    const storagePrefix = `${scope.tenantId}/${scope.userId}/uploads/${crypto.randomUUID()}`;
    const { data, error } = await this.db().from(streamsAITables.uploadSessions).upsert({
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      project_id: input.projectId || scope.defaultProjectId,
      session_id: input.sessionId || null,
      device_id: input.deviceId || null,
      idempotency_key: idempotencyKey,
      file_name: safeFileName(input.fileName),
      mime_type: sanitizeStreamsAIText(input.mimeType || "", 200) || null,
      total_bytes: totalBytes,
      chunk_size: chunkSize,
      total_chunks: totalChunks,
      storage_bucket: bucket,
      storage_prefix: storagePrefix,
      expected_checksum: sanitizeStreamsAIText(input.expectedChecksum || "", 128) || null,
      metadata: sanitizeStreamsAIPayload(input.metadata || {}),
      status: "created",
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,user_id,idempotency_key", ignoreDuplicates: true }).select("*").maybeSingle();
    if (error) throw new Error(`Failed to create Streams upload session: ${error.message}`);
    if (data) return this.get(scope, data.id);
    const { data: existing, error: existingError } = await this.db().from(streamsAITables.uploadSessions).select("id")
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("idempotency_key", idempotencyKey).single();
    if (existingError) throw new Error(`Failed to restore Streams upload session: ${existingError.message}`);
    return this.get(scope, existing.id);
  }

  async uploadChunk(scope: StreamsAIScope, input: { uploadId: string; chunkIndex: number; byteOffset: number; bytes: Buffer; checksum?: string | null }) {
    const state = await this.get(scope, input.uploadId);
    if (!state) throw new Error("Upload session not found");
    if (!["created", "uploading", "failed"].includes(state.status)) throw new Error(`Upload session is ${state.status}`);
    const chunkIndex = Math.trunc(Number(input.chunkIndex));
    const byteOffset = Math.trunc(Number(input.byteOffset));
    if (chunkIndex < 0 || chunkIndex >= Number(state.total_chunks)) throw new Error("chunkIndex is outside the upload manifest");
    const expectedOffset = chunkIndex * Number(state.chunk_size);
    if (byteOffset !== expectedOffset) throw new Error(`byteOffset must equal ${expectedOffset} for chunk ${chunkIndex}`);
    const expectedSize = Math.min(Number(state.chunk_size), Number(state.total_bytes) - byteOffset);
    if (input.bytes.length !== expectedSize) throw new Error(`Chunk ${chunkIndex} must contain exactly ${expectedSize} bytes`);
    const computedChecksum = sha256(input.bytes);
    if (input.checksum && computedChecksum !== input.checksum.toLowerCase()) throw new Error("Chunk checksum does not match");
    const storagePath = `${state.storage_prefix}/chunk-${String(chunkIndex).padStart(8, "0")}`;
    const { error: uploadError } = await this.service.storage.from(state.storage_bucket).upload(storagePath, input.bytes, { contentType: "application/octet-stream", upsert: true });
    if (uploadError) throw new Error(`Failed to upload Streams chunk: ${uploadError.message}`);
    const { error } = await this.db().from(streamsAITables.uploadChunks).upsert({
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      upload_session_id: state.id,
      chunk_index: chunkIndex,
      byte_offset: byteOffset,
      size_bytes: input.bytes.length,
      checksum: computedChecksum,
      storage_path: storagePath,
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,user_id,upload_session_id,chunk_index" });
    if (error) throw new Error(`Failed to confirm Streams upload chunk: ${error.message}`);
    const { data: confirmed, error: countError } = await this.db().from(streamsAITables.uploadChunks).select("size_bytes")
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("upload_session_id", state.id).eq("status", "confirmed");
    if (countError) throw new Error(`Failed to calculate Streams upload progress: ${countError.message}`);
    const confirmedBytes = (confirmed || []).reduce((sum: number, row: any) => sum + Number(row.size_bytes || 0), 0);
    await this.db().from(streamsAITables.uploadSessions).update({ status: "uploading", confirmed_bytes: confirmedBytes, confirmed_chunks: (confirmed || []).length, last_error: null, updated_at: new Date().toISOString() })
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", state.id);
    return this.get(scope, state.id);
  }

  async complete(scope: StreamsAIScope, uploadId: string) {
    const state = await this.get(scope, uploadId);
    if (!state) throw new Error("Upload session not found");
    if (state.status === "completed") return state;
    if (state.status === "cancelled") throw new Error("Upload session was cancelled");
    if (Number(state.confirmed_chunks) !== Number(state.total_chunks) || Number(state.confirmed_bytes) !== Number(state.total_bytes)) throw new Error("All upload chunks must be confirmed before completion");
    await this.db().from(streamsAITables.uploadSessions).update({ status: "completing", updated_at: new Date().toISOString() })
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", uploadId);
    try {
      const buffers: Buffer[] = [];
      for (const chunk of state.chunks) {
        const { data, error } = await this.service.storage.from(state.storage_bucket).download(chunk.storage_path);
        if (error || !data) throw new Error(`Failed to download upload chunk ${chunk.chunk_index}: ${error?.message || "missing data"}`);
        buffers.push(Buffer.from(await data.arrayBuffer()));
      }
      const complete = Buffer.concat(buffers);
      if (complete.length !== Number(state.total_bytes)) throw new Error("Completed upload size does not match manifest");
      const checksum = sha256(complete);
      if (state.expected_checksum && checksum !== String(state.expected_checksum).toLowerCase()) throw new Error("Completed upload checksum does not match");
      const finalPath = `${scope.tenantId}/${scope.userId}/${crypto.randomUUID()}-${safeFileName(state.file_name)}`;
      const { error: finalError } = await this.service.storage.from(state.storage_bucket).upload(finalPath, complete, { contentType: state.mime_type || "application/octet-stream", upsert: false });
      if (finalError) throw new Error(`Failed to finalize Streams upload: ${finalError.message}`);
      const asset = await this.assets.create(scope, {
        projectId: state.project_id,
        sessionId: state.session_id,
        name: state.file_name,
        mimeType: state.mime_type,
        sizeBytes: complete.length,
        storageBucket: state.storage_bucket,
        storagePath: finalPath,
        kind: String(state.mime_type || "").startsWith("image/") ? "image" : String(state.mime_type || "").startsWith("video/") ? "video" : String(state.mime_type || "").startsWith("audio/") ? "audio" : "file",
        metadata: { ...(state.metadata || {}), uploadSessionId: state.id, checksum, resumable: true },
      });
      await this.db().from(streamsAITables.uploadSessions).update({ status: "completed", asset_id: asset.id, completed_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
        .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", uploadId);
      await this.service.storage.from(state.storage_bucket).remove(state.chunks.map((chunk: any) => chunk.storage_path));
      return this.get(scope, uploadId);
    } catch (error) {
      await this.db().from(streamsAITables.uploadSessions).update({ status: "failed", last_error: error instanceof Error ? error.message : "Upload completion failed", updated_at: new Date().toISOString() })
        .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", uploadId);
      throw error;
    }
  }

  async cancel(scope: StreamsAIScope, uploadId: string) {
    const state = await this.get(scope, uploadId);
    if (!state) throw new Error("Upload session not found");
    if (state.status === "completed") throw new Error("Completed uploads cannot be cancelled");
    await this.service.storage.from(state.storage_bucket).remove(state.chunks.map((chunk: any) => chunk.storage_path));
    const { data, error } = await this.db().from(streamsAITables.uploadSessions).update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", uploadId).select("*").single();
    if (error) throw new Error(`Failed to cancel Streams upload: ${error.message}`);
    return data;
  }
}

export const STREAMS_RESUMABLE_UPLOAD_LIMITS = { maxUploadBytes: MAX_UPLOAD_BYTES, minChunkBytes: MIN_CHUNK_BYTES, maxChunkBytes: MAX_CHUNK_BYTES } as const;
