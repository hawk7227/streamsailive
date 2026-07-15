import { getCapabilityProduct } from "../capabilities/capability-products";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "../server";
import type { StreamsAIScope } from "../auth";
import { StreamsAICreditLedgerRepository } from "./credit-ledger-repository";
import { StreamsAIEntitlementsRepository } from "./entitlements-repository";
import type { CreateJobEventInput, CreateJobInput } from "./types";
import { assertNoProtectedFields, sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "../protected-reasoning";
import { buildStructuredProgressUpdate } from "../runtime/progress-update-structure";

const creditLedger = new StreamsAICreditLedgerRepository();
const entitlements = new StreamsAIEntitlementsRepository();
const TERMINAL_JOB_STATUSES = new Set(["completed", "failed", "cancelled", "blocked"]);

export type UpdateJobInput = {
  status?: string;
  sessionId?: string | null;
  messageId?: string | null;
  inputJson?: Record<string, unknown>;
  outputJson?: Record<string, unknown> | null;
  error?: string | null;
  creditEstimate?: number;
  metadata?: Record<string, unknown>;
};

function shouldEnforceCredits() {
  return process.env.STREAMS_AI_ENFORCE_CREDITS === "true";
}

export function isAuthorizedInternalChatOperation(input: CreateJobInput = {}) {
  return input.kind === "chat_tool"
    && input.productId !== "text-2-image"
    && input.productId !== "photo-2-motion"
    && input.productId !== "text-2-video"
    && input.inputJson?.purpose === "streams_ai_chat_operation"
    && input.creditEstimate === 0;
}

function normalizeJobRow<T extends Record<string, any> | null>(row: T): T {
  if (!row) return row;
  const clean = sanitizeStreamsAIPayload(row);
  const inputJson = (clean.input_json && typeof clean.input_json === "object" ? clean.input_json : {}) as Record<string, unknown>;
  const nextMetadata = clean.metadata && typeof clean.metadata === "object" ? clean.metadata : inputJson.metadata;
  return { ...clean, metadata: nextMetadata } as T;
}

function normalizeEventRow<T extends Record<string, any> | null>(row: T): T {
  return row ? sanitizeStreamsAIPayload(row) as T : row;
}

export class StreamsAIJobsRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  async list(scope: StreamsAIScope, filters: { sessionId?: string | null; status?: string | null } = {}) {
    let query = this.db().from(streamsAITables.jobs).select("*").eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).order("created_at", { ascending: false });
    if (filters.sessionId) query = query.eq("session_id", filters.sessionId);
    if (filters.status) query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to list STREAMS AI jobs: ${error.message}`);
    return (data || []).map((row) => normalizeJobRow(row));
  }

  async findChatOperationByIdempotency(scope: StreamsAIScope, idempotencyKey: string) {
    const key = sanitizeStreamsAIText(idempotencyKey, 300).trim();
    if (!key) return null;
    const { data, error } = await this.db()
      .from(streamsAITables.jobs)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .contains("input_json", { purpose: "streams_ai_chat_operation", idempotencyKey: key })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Failed to recover STREAMS AI chat operation: ${error.message}`);
    return normalizeJobRow(data);
  }

  async create(scope: StreamsAIScope, input: CreateJobInput = {}) {
    assertNoProtectedFields(input);
    const capability = getCapabilityProduct(input.kind || "chat_tool");
    const effectiveProductId = input.productId && input.productId !== "streams-ai" ? input.productId : capability.productId;
    const effectiveCreditEstimate = input.creditEstimate ?? capability.estimatedCredits ?? 0;
    const internalChatOperation = isAuthorizedInternalChatOperation(input);

    if (capability.entitlementRequired && !internalChatOperation) await entitlements.require(scope, effectiveProductId);
    if (effectiveCreditEstimate > 0 && shouldEnforceCredits()) await creditLedger.assertSufficientCredits(scope, effectiveCreditEstimate);

    const inputJson = sanitizeStreamsAIPayload({
      ...(input.inputJson || {}),
      capability: {
        kind: capability.kind,
        productId: effectiveProductId,
        displayName: capability.displayName,
        executionStatus: capability.executionStatus,
      },
    }) as Record<string, unknown>;
    const { data, error } = await this.db().from(streamsAITables.jobs).insert({
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
      input_json: inputJson,
      credit_estimate: effectiveCreditEstimate,
    }).select("*").single();

    if (error) throw new Error(`Failed to create STREAMS AI job: ${error.message}`);
    if (inputJson.suppressCreatedEvent !== true) {
      await this.createEvent(scope, {
        jobId: data.id,
        eventType: "created",
        message: "Job created",
        data: { status: data.status, kind: data.kind, productId: effectiveProductId, creditEstimate: effectiveCreditEstimate, creditsEnforced: shouldEnforceCredits() },
      });
    }
    return normalizeJobRow(data);
  }

  async update(scope: StreamsAIScope, jobId: string, input: UpdateJobInput) {
    assertNoProtectedFields(input);
    const current = await this.get(scope, jobId);
    if (!current) throw new Error("STREAMS AI job not found.");
    const currentStatus = String(current.status || "");
    const requestedStatus = input.status === undefined ? currentStatus : String(input.status);
    if (TERMINAL_JOB_STATUSES.has(currentStatus) && requestedStatus !== currentStatus) throw new Error(`STREAMS AI job is already ${currentStatus}.`);

    const patch: Record<string, unknown> = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.sessionId !== undefined) patch.session_id = input.sessionId;
    if (input.messageId !== undefined) patch.message_id = input.messageId;
    if (input.outputJson !== undefined) patch.output_json = input.outputJson == null ? null : sanitizeStreamsAIPayload(input.outputJson);
    if (input.error !== undefined) patch.error = input.error == null ? null : sanitizeStreamsAIText(input.error, 4000);
    if (input.creditEstimate !== undefined) patch.credit_estimate = input.creditEstimate;
    if (input.inputJson !== undefined || input.metadata !== undefined) {
      const currentInputJson = (current.input_json && typeof current.input_json === "object" ? current.input_json : {}) as Record<string, unknown>;
      patch.input_json = sanitizeStreamsAIPayload({
        ...currentInputJson,
        ...(input.inputJson || {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      });
    }

    const { data, error } = await this.db().from(streamsAITables.jobs).update(patch).eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", jobId).select("*").single();
    if (error) throw new Error(`Failed to update STREAMS AI job: ${error.message}`);
    return normalizeJobRow(data);
  }

  async get(scope: StreamsAIScope, jobId: string) {
    const { data, error } = await this.db().from(streamsAITables.jobs).select("*").eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", jobId).maybeSingle();
    if (error) throw new Error(`Failed to read STREAMS AI job: ${error.message}`);
    return normalizeJobRow(data);
  }

  async events(scope: StreamsAIScope, jobId: string) {
    const { data, error } = await this.db().from(streamsAITables.jobEvents).select("*").eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("job_id", jobId).order("created_at", { ascending: true }).order("id", { ascending: true });
    if (error) throw new Error(`Failed to read STREAMS AI job events: ${error.message}`);
    return (data || []).map((row) => normalizeEventRow(row));
  }

  async createEvent(scope: StreamsAIScope, input: CreateJobEventInput) {
    assertNoProtectedFields(input);
    const [existingEvents, job] = await Promise.all([this.events(scope, input.jobId), this.get(scope, input.jobId)]);
    if (!job) throw new Error("STREAMS AI job not found for event.");
    const sequenceNumber = existingEvents.reduce((max, event: any) => Math.max(max, Number(event?.data?.sequenceNumber || 0)), 0) + 1;
    const baseData = sanitizeStreamsAIPayload({ ...(input.data || {}), sequenceNumber }) as Record<string, any>;
    const progressUpdate = buildStructuredProgressUpdate({
      ...baseData,
      message: input.message,
      jobInput: job.input_json && typeof job.input_json === "object" ? job.input_json : {},
    });
    const dataPayload = sanitizeStreamsAIPayload({
      ...baseData,
      goal: progressUpdate.goal,
      completedWork: progressUpdate.completedWork,
      currentAction: progressUpdate.currentAction,
      evidence: progressUpdate.evidence,
      nextAction: progressUpdate.nextAction,
      remainingWork: progressUpdate.remainingWork,
      planVersion: progressUpdate.planVersion,
      progressUpdate,
    });
    const { data, error } = await this.db().from(streamsAITables.jobEvents).insert({
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      job_id: input.jobId,
      event_type: input.eventType,
      message: input.message ? sanitizeStreamsAIText(input.message, 4000) : null,
      data: dataPayload,
    }).select("*").single();
    if (error) throw new Error(`Failed to create STREAMS AI job event: ${error.message}`);
    return normalizeEventRow(data);
  }
}
