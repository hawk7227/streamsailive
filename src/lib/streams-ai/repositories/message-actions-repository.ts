import type { StreamsAIScope } from "../auth";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "../server";

export type MessageActionName =
  | "copied"
  | "feedback_up"
  | "feedback_down"
  | "feedback_cleared"
  | "shared"
  | "more_menu_opened"
  | "branch"
  | "branch_created"
  | "branch_duplicate_prevented"
  | "read_aloud_started"
  | "read_aloud_completed"
  | "read_aloud_failed"
  | "read_aloud_unavailable"
  | "regenerate"
  | "regenerate_started"
  | "regenerate_completed"
  | "regenerate_duplicate_prevented"
  | "regenerate_structure_rejected";

export const MESSAGE_ACTIONS = new Set<MessageActionName>([
  "copied",
  "feedback_up",
  "feedback_down",
  "feedback_cleared",
  "shared",
  "more_menu_opened",
  "branch",
  "branch_created",
  "branch_duplicate_prevented",
  "read_aloud_started",
  "read_aloud_completed",
  "read_aloud_failed",
  "read_aloud_unavailable",
  "regenerate",
  "regenerate_started",
  "regenerate_completed",
  "regenerate_duplicate_prevented",
  "regenerate_structure_rejected",
]);

export class StreamsAIMessageActionsRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  async getReceipt(scope: StreamsAIScope, idempotencyKey: string) {
    const { data, error } = await this.db()
      .from(streamsAITables.messageActionReceipts)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (error) throw new Error(`Failed to read message action receipt: ${error.message}`);
    return data || null;
  }

  async beginReceipt(scope: StreamsAIScope, input: {
    sessionId?: string | null;
    messageId?: string | null;
    action: MessageActionName;
    idempotencyKey: string;
  }) {
    const row = {
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      session_id: input.sessionId || null,
      message_id: input.messageId || null,
      action: input.action,
      idempotency_key: input.idempotencyKey,
      status: "started",
      result: {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.db()
      .from(streamsAITables.messageActionReceipts)
      .upsert(row, { onConflict: "tenant_id,user_id,idempotency_key", ignoreDuplicates: true })
      .select("*")
      .maybeSingle();

    if (error) throw new Error(`Failed to begin message action receipt: ${error.message}`);
    if (data) return { receipt: data, acquired: true };
    return { receipt: await this.getReceipt(scope, input.idempotencyKey), acquired: false };
  }

  async completeReceipt(scope: StreamsAIScope, idempotencyKey: string, result: Record<string, unknown>) {
    const { data, error } = await this.db()
      .from(streamsAITables.messageActionReceipts)
      .update({ status: "completed", result, updated_at: new Date().toISOString() })
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("idempotency_key", idempotencyKey)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to complete message action receipt: ${error.message}`);
    return data;
  }

  async failReceipt(scope: StreamsAIScope, idempotencyKey: string, result: Record<string, unknown>) {
    const { data, error } = await this.db()
      .from(streamsAITables.messageActionReceipts)
      .update({ status: "failed", result, updated_at: new Date().toISOString() })
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("idempotency_key", idempotencyKey)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(`Failed to mark message action receipt failed: ${error.message}`);
    return data || null;
  }

  async setFeedback(scope: StreamsAIScope, input: {
    sessionId: string;
    messageId: string;
    rating: -1 | 1 | null;
    metadata?: Record<string, unknown>;
  }) {
    if (input.rating === null) {
      const { error } = await this.db()
        .from(streamsAITables.messageFeedback)
        .delete()
        .eq("tenant_id", scope.tenantId)
        .eq("user_id", scope.userId)
        .eq("message_id", input.messageId);
      if (error) throw new Error(`Failed to clear message feedback: ${error.message}`);
      return null;
    }

    const { data, error } = await this.db()
      .from(streamsAITables.messageFeedback)
      .upsert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        session_id: input.sessionId,
        message_id: input.messageId,
        rating: input.rating,
        metadata: input.metadata || {},
        updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id,user_id,message_id" })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to save message feedback: ${error.message}`);
    return data;
  }

  async getFeedback(scope: StreamsAIScope, messageId: string) {
    const { data, error } = await this.db()
      .from(streamsAITables.messageFeedback)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("message_id", messageId)
      .maybeSingle();

    if (error) throw new Error(`Failed to read message feedback: ${error.message}`);
    return data || null;
  }
}
