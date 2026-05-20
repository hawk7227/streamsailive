import { createStreamsAIServiceClient, streamsAISchema } from "../server";
import type { StreamsAIScope } from "../auth";

export type CreateProviderRunInput = {
  jobId?: string | null;
  provider: string;
  model?: string | null;
  status?: string;
  requestJson?: Record<string, unknown>;
  responseJson?: Record<string, unknown> | null;
  outputAssetId?: string | null;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

export class StreamsAIProviderRunsRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  async create(scope: StreamsAIScope, input: CreateProviderRunInput) {
    const { data, error } = await this.db()
      .from("provider_runs")
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        job_id: input.jobId || null,
        provider: input.provider,
        model: input.model || null,
        status: input.status || "queued",
        request_json: input.requestJson || {},
        response_json: input.responseJson || null,
        output_asset_id: input.outputAssetId || null,
        error: input.error || null,
        started_at: input.startedAt || null,
        completed_at: input.completedAt || null,
      })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create STREAMS AI provider run: ${error.message}`);
    return data;
  }

  async list(scope: StreamsAIScope, filters: { jobId?: string | null } = {}) {
    let query = this.db()
      .from("provider_runs")
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .order("created_at", { ascending: false });

    if (filters.jobId) query = query.eq("job_id", filters.jobId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list STREAMS AI provider runs: ${error.message}`);
    return data || [];
  }
}
