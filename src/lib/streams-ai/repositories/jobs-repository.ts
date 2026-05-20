import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "../server";
import type { StreamsAIScope } from "../auth";
import type { CreateJobEventInput, CreateJobInput } from "./types";

export class StreamsAIJobsRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  async list(scope: StreamsAIScope, filters: { sessionId?: string | null; status?: string | null } = {}) {
    let query = this.db()
      .from(streamsAITables.jobs)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .order("created_at", { ascending: false });

    if (filters.sessionId) query = query.eq("session_id", filters.sessionId);
    if (filters.status) query = query.eq("status", filters.status);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list STREAMS AI jobs: ${error.message}`);
    return data || [];
  }

  async create(scope: StreamsAIScope, input: CreateJobInput = {}) {
    const { data, error } = await this.db()
      .from(streamsAITables.jobs)
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        project_id: input.projectId ?? scope.defaultProjectId,
        session_id: input.sessionId ?? null,
        message_id: input.messageId ?? null,
        tool_call_id: input.toolCallId ?? null,
        workspace_id: scope.workspaceId,
        module_id: scope.moduleId,
        product_id: input.productId ?? scope.productId,
        status: input.status || "queued",
        kind: input.kind || "chat",
        input_json: input.inputJson || {},
        credit_estimate: input.creditEstimate || 0,
      })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create STREAMS AI job: ${error.message}`);

    await this.createEvent(scope, {
      jobId: data.id,
      eventType: "created",
      message: "Job created",
      data: { status: data.status, kind: data.kind },
    });

    return data;
  }

  async get(scope: StreamsAIScope, jobId: string) {
    const { data, error } = await this.db()
      .from(streamsAITables.jobs)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", jobId)
      .maybeSingle();

    if (error) throw new Error(`Failed to read STREAMS AI job: ${error.message}`);
    return data;
  }

  async events(scope: StreamsAIScope, jobId: string) {
    const { data, error } = await this.db()
      .from(streamsAITables.jobEvents)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(`Failed to read STREAMS AI job events: ${error.message}`);
    return data || [];
  }

  async createEvent(scope: StreamsAIScope, input: CreateJobEventInput) {
    const { data, error } = await this.db()
      .from(streamsAITables.jobEvents)
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        job_id: input.jobId,
        event_type: input.eventType,
        message: input.message || null,
        data: input.data || {},
      })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create STREAMS AI job event: ${error.message}`);
    return data;
  }
}
