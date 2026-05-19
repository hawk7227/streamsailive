import { createStreamsAIServiceClient, streamsAISchema } from "../server";
import type { StreamsAIScope } from "../auth";
import type { CreateCreditLedgerInput } from "./types";

export class StreamsAICreditsRepository {
  private readonly db = streamsAISchema(createStreamsAIServiceClient());

  async balance(scope: StreamsAIScope) {
    const { data, error } = await this.db
      .from("credit_ledger")
      .select("amount")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId);

    if (error) throw new Error(`Failed to read STREAMS AI credit balance: ${error.message}`);
    return (data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }

  async list(scope: StreamsAIScope, limit = 50) {
    const { data, error } = await this.db
      .from("credit_ledger")
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to list STREAMS AI credit ledger: ${error.message}`);
    return data || [];
  }

  async create(scope: StreamsAIScope, input: CreateCreditLedgerInput) {
    const currentBalance = await this.balance(scope);
    const balanceAfter = currentBalance + Number(input.amount || 0);

    const { data, error } = await this.db
      .from("credit_ledger")
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        amount: input.amount,
        balance_after: balanceAfter,
        source: input.source || "system",
        reason: input.reason || null,
        related_job_id: input.relatedJobId || null,
        related_session_id: input.relatedSessionId || null,
        metadata: input.metadata || {},
      })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create STREAMS AI credit ledger entry: ${error.message}`);
    return data;
  }
}
