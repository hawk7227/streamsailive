import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "../server";
import type { StreamsAIScope } from "../auth";

export type CreditLedgerEntryInput = {
  amount: number;
  reason: string;
  relatedJobId?: string | null;
  relatedProviderRunId?: string | null;
  metadata?: Record<string, unknown>;
};

export class StreamsAICreditLedgerRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  async list(scope: StreamsAIScope, limit = 50) {
    const { data, error } = await this.db()
      .from(streamsAITables.creditLedger)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(200, limit)));

    if (error) throw new Error(`Failed to list STREAMS AI credit ledger: ${error.message}`);
    return data || [];
  }

  async balance(scope: StreamsAIScope) {
    const rows = await this.list(scope, 5000);
    return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }

  async create(scope: StreamsAIScope, input: CreditLedgerEntryInput) {
    const { data, error } = await this.db()
      .from(streamsAITables.creditLedger)
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        related_job_id: input.relatedJobId || null,
        related_provider_run_id: input.relatedProviderRunId || null,
        amount: input.amount,
        reason: input.reason,
        metadata: input.metadata || {},
      })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create STREAMS AI credit ledger row: ${error.message}`);
    return data;
  }

  async assertSufficientCredits(scope: StreamsAIScope, estimatedCost: number) {
    const balance = await this.balance(scope);
    if (balance < estimatedCost) {
      throw new Error(`INSUFFICIENT_CREDITS: required ${estimatedCost}, available ${balance}`);
    }
    return { balance, estimatedCost };
  }
}
