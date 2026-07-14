import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "../server";
import type { StreamsAIScope } from "../auth";
import type { CreateAssetInput } from "./types";

export class StreamsAIAssetsRepository {
  private serviceClient() {
    return createStreamsAIServiceClient();
  }

  private db() {
    return streamsAISchema(this.serviceClient());
  }

  async list(scope: StreamsAIScope, filters: { projectId?: string | null; sessionId?: string | null } = {}) {
    let query = this.db()
      .from(streamsAITables.assets)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .order("created_at", { ascending: false });

    if (filters.projectId) query = query.eq("project_id", filters.projectId);
    if (filters.sessionId) query = query.eq("session_id", filters.sessionId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list STREAMS AI assets: ${error.message}`);
    return data || [];
  }

  async create(scope: StreamsAIScope, input: CreateAssetInput) {
    const { data, error } = await this.db()
      .from(streamsAITables.assets)
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        project_id: input.projectId ?? scope.defaultProjectId,
        session_id: input.sessionId ?? null,
        message_id: input.messageId ?? null,
        workspace_id: scope.workspaceId,
        module_id: scope.moduleId,
        product_id: input.productId ?? scope.productId,
        kind: input.kind || "file",
        name: input.name,
        mime_type: input.mimeType || null,
        size_bytes: input.sizeBytes || 0,
        storage_bucket: input.storageBucket || null,
        storage_path: input.storagePath || null,
        public_url: input.publicUrl || null,
        metadata: input.metadata || {},
      })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create STREAMS AI asset: ${error.message}`);
    return data;
  }

  async uploadFile(
    scope: StreamsAIScope,
    file: File,
    input: Omit<CreateAssetInput, "name" | "mimeType" | "sizeBytes" | "storageBucket" | "storagePath" | "publicUrl"> = {},
  ) {
    const serviceClient = this.serviceClient();
    const bucket = process.env.STREAMS_AI_ASSETS_BUCKET || "streams-ai-assets";
    const safeName = String(file.name || "upload.bin").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${scope.tenantId}/${scope.userId}/${crypto.randomUUID()}-${safeName}`;

    const { data: buckets, error: listError } = await serviceClient.storage.listBuckets();
    if (listError) throw new Error(`Failed to inspect STREAMS AI storage: ${listError.message}`);
    if (!buckets?.some((item) => item.name === bucket)) {
      const { error: createError } = await serviceClient.storage.createBucket(bucket, { public: false });
      if (createError && !/already exists|duplicate/i.test(createError.message)) {
        throw new Error(`Failed to create STREAMS AI asset bucket: ${createError.message}`);
      }
    }

    const bytes = await file.arrayBuffer();
    if (!bytes.byteLength) throw new Error("The selected file is empty.");

    const { error: uploadError } = await serviceClient.storage
      .from(bucket)
      .upload(storagePath, bytes, { contentType: file.type || "application/octet-stream", upsert: false });

    if (uploadError) throw new Error(`Failed to upload STREAMS AI asset: ${uploadError.message}`);

    return this.create(scope, {
      ...input,
      name: file.name,
      mimeType: file.type || null,
      sizeBytes: file.size,
      storageBucket: bucket,
      storagePath,
      kind:
        input.kind ||
        (file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
            ? "video"
            : file.type.startsWith("audio/")
              ? "audio"
              : file.type === "application/pdf"
                ? "pdf"
                : /word|document/i.test(file.type)
                  ? "document"
                  : "file"),
    });
  }
}
