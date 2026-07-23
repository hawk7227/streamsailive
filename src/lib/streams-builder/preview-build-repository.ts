import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "@/lib/streams-ai/protected-reasoning";

export const BUILDER_PREVIEW_PURPOSE = "streams_builder_preview_build";

export type DurablePreviewBuildRecord = {
  previewId: string;
  repository: string;
  sourceBranch: string;
  previewBranch: string;
  route: string;
  filePath: string;
  checkpointId: string;
  status: "queued" | "building" | "succeeded" | "failed";
  previewUrl?: string;
  deploymentId?: string;
  deploymentUrl?: string;
  error?: string;
  logs: string[];
  createdAt: string;
  updatedAt: string;
};

function db() {
  return streamsAISchema(createStreamsAIServiceClient());
}

function normalize(row: any): DurablePreviewBuildRecord | null {
  if (!row) return null;
  const output = row.output_json && typeof row.output_json === "object" ? row.output_json : {};
  const input = row.input_json && typeof row.input_json === "object" ? row.input_json : {};
  const record = output.previewBuild || input.previewBuild || output;
  if (!record?.previewId) return null;
  return {
    previewId: String(record.previewId),
    repository: String(record.repository || ""),
    sourceBranch: String(record.sourceBranch || "main"),
    previewBranch: String(record.previewBranch || ""),
    route: String(record.route || "/"),
    filePath: String(record.filePath || ""),
    checkpointId: String(record.checkpointId || ""),
    status: ["queued", "building", "succeeded", "failed"].includes(String(record.status)) ? record.status : "queued",
    previewUrl: record.previewUrl ? String(record.previewUrl) : undefined,
    deploymentId: record.deploymentId ? String(record.deploymentId) : undefined,
    deploymentUrl: record.deploymentUrl ? String(record.deploymentUrl) : undefined,
    error: record.error ? String(record.error) : undefined,
    logs: Array.isArray(record.logs) ? record.logs.map((line: unknown) => sanitizeStreamsAIText(String(line), 2000)).slice(-250) : [],
    createdAt: String(record.createdAt || row.created_at || new Date().toISOString()),
    updatedAt: String(record.updatedAt || row.updated_at || row.created_at || new Date().toISOString()),
  };
}

export class StreamsBuilderPreviewBuildRepository {
  private jobs = new StreamsAIJobsRepository();

  async read(scope: StreamsAIScope, previewId: string) {
    const { data, error } = await db().from(streamsAITables.jobs).select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .contains("input_json", { purpose: BUILDER_PREVIEW_PURPOSE, previewId })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Failed to read temporary preview build: ${error.message}`);
    return data ? { jobId: data.id, record: normalize(data) } : null;
  }

  async save(scope: StreamsAIScope, record: DurablePreviewBuildRecord, eventType?: string, eventMessage?: string) {
    const existing = await this.read(scope, record.previewId);
    const updatedAt = new Date().toISOString();
    const previewBuild = sanitizeStreamsAIPayload({ ...record, logs: record.logs.slice(-250), updatedAt });
    let job: any;
    if (existing?.jobId) {
      const { data, error } = await db().from(streamsAITables.jobs).update({
        status: record.status === "succeeded" ? "completed" : record.status === "failed" ? "failed" : "running",
        output_json: { previewBuild },
        error: record.error || null,
        updated_at: updatedAt,
      }).eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", existing.jobId).select("*").single();
      if (error) throw new Error(`Failed to update temporary preview build: ${error.message}`);
      job = data;
    } else {
      const { data, error } = await db().from(streamsAITables.jobs).insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        project_id: scope.defaultProjectId,
        workspace_id: "streams-builder",
        module_id: "preview-build",
        product_id: "streams-ai",
        status: record.status === "failed" ? "failed" : "running",
        kind: "chat_tool",
        input_json: sanitizeStreamsAIPayload({ purpose: BUILDER_PREVIEW_PURPOSE, previewId: record.previewId, previewBuild }),
        output_json: { previewBuild },
        error: record.error || null,
        credit_estimate: 0,
        credit_cost: 0,
        updated_at: updatedAt,
      }).select("*").single();
      if (error) throw new Error(`Failed to create temporary preview build: ${error.message}`);
      job = data;
    }
    if (eventType) {
      await this.jobs.createEvent(scope, {
        jobId: job.id,
        eventType,
        message: sanitizeStreamsAIText(eventMessage || `Preview build ${record.previewId} ${record.status}.`, 1000),
        data: {
          previewId: record.previewId,
          previewBranch: record.previewBranch,
          previewUrl: record.previewUrl || null,
          deploymentId: record.deploymentId || null,
          status: record.status,
          checkpointId: record.checkpointId,
        },
      });
    }
    return { jobId: job.id, record: normalize(job) };
  }
}
