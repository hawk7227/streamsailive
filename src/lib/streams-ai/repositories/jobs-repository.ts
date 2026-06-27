import { getCapabilityProduct } from "../capabilities/capability-products";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "../server";
import type { StreamsAIScope } from "../auth";
import { StreamsAICreditLedgerRepository } from "./credit-ledger-repository";
import { StreamsAIEntitlementsRepository } from "./entitlements-repository";
import type { CreateJobEventInput, CreateJobInput } from "./types";

const creditLedger = new StreamsAICreditLedgerRepository();
const entitlements = new StreamsAIEntitlementsRepository();

export type UpdateJobInput = {
  status?: string;
  inputJson?: Record<string, unknown>;
  creditEstimate?: number;
  metadata?: Record<string, unknown>;
};

function shouldEnforceCredits() {
  return process.env.STREAMS_AI_ENFORCE_CREDITS === "true";
}

function normalizeJobRow<T extends Record<string, unknown> | null>(row: T): T {
  if (!row) return row;
  const inputJson = (row.input_json && typeof row.input_json === "object" ? row.input_json : {}) as Record<string, unknown>;
  const nextMetadata = row.metadata && typeof row.metadata === "object" ? row.metadata : inputJson.metadata;
  return { ...row, metadata: nextMetadata } as T;
}

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
    return (data || []).map((row) => normalizeJobRow(row));
  }

  async create(scope: StreamsAIScope, input: CreateJobInput = {}) {
    const capability = getCapabilityProduct(input.kind || "chat_tool");
    const effectiveProductId = input.productId && input.productId !== "streams-ai" ? input.productId : capability.productId;
    const effectiveCreditEstimate = input.creditEstimate ?? capability.estimatedCredits ?? 0;

    if (capability.entitlementRequired) {
      await entitlements.require(scope, effectiveProductId);
    }

    if (effectiveCreditEstimate > 0 && shouldEnforceCredits()) {
      await creditLedger.assertSufficientCredits(scope, effectiveCreditEstimate);
    }

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
        product_id: effectiveProductId,
        status: input.status || "queued",
        kind: capability.kind,
        input_json: {
          ...(input.inputJson || {}),
          capability: {
            kind: capability.kind,
            productId: effectiveProductId,
            displayName: capability.displayName,
            executionStatus: capability.executionStatus,
          },
        },
        credit_estimate: effectiveCreditEstimate,
      })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create STREAMS AI job: ${error.message}`);

    await this.createEvent(scope, {
      jobId: data.id,
      eventType: "created",
      message: "Job created",
      data: { status: data.status, kind: data.kind, productId: effectiveProductId, creditEstimate: effectiveCreditEstimate, creditsEnforced: shouldEnforceCredits() },
    });

    return normalizeJobRow(data);
  }

  async update(scope: StreamsAIScope, jobId: string, input: UpdateJobInput) {
    const patch: Record<string, unknown> = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.creditEstimate !== undefined) patch.credit_estimate = input.creditEstimate;

    if (input.inputJson !== undefined || input.metadata !== undefined) {
      const current = await this.get(scope, jobId);
      const currentInputJson = (current?.input_json && typeof current.input_json === "object" ? current.input_json : {}) as Record<string, unknown>;
      patch.input_json = {
        ...currentInputJson,
        ...(input.inputJson || {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      };
    }

    const { data, error } = await this.db()
      .from(streamsAITables.jobs)
      .update(patch)
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", jobId)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to update STREAMS AI job: ${error.message}`);
    return normalizeJobRow(data);
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
    return normalizeJobRow(data);
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
