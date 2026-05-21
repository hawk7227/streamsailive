import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "../server";
import type { StreamsAIScope } from "../auth";

export type CreateUsageEventInput = {
  sessionId?: string | null;
  jobId?: string | null;
  providerRunId?: string | null;
  productId?: string | null;
  eventType: string;
  provider?: string | null;
  model?: string | null;
  inputUnits?: number;
  outputUnits?: number;
  costUsd?: number;
  creditsDebited?: number;
  metadata?: Record<string, unknown>;
};

export class StreamsAIUsageEventsRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  async create(scope: StreamsAIScope, input: CreateUsageEventInput) {
    const { data, error } = await this.db()
      .from(streamsAITables.usageEvents)
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        session_id: input.sessionId || null,
        job_id: input.jobId || null,
        provider_run_id: input.providerRunId || null,
        product_id: input.productId || scope.productId,
        event_type: input.eventType,
        provider: input.provider || null,
        model: input.model || null,
        input_units: input.inputUnits || 0,
        output_units: input.outputUnits || 0,
        cost_usd: input.costUsd || 0,
        credits_debited: input.creditsDebited || 0,
        metadata: input.metadata || {},
      })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create STREAMS AI usage event: ${error.message}`);
    return data;
  }

  async list(scope: StreamsAIScope, filters: { sessionId?: string | null; jobId?: string | null } = {}) {
    let query = this.db()
      .from(streamsAITables.usageEvents)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .order("created_at", { ascending: false });

    if (filters.sessionId) query = query.eq("session_id", filters.sessionId);
    if (filters.jobId) query = query.eq("job_id", filters.jobId);

    const { data, error } = await query.limit(100);
    if (error) throw new Error(`Failed to list STREAMS AI usage events: ${error.message}`);
    return data || [];
  }
}
