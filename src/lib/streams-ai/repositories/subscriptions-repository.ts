import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "../server";
import type { StreamsAIScope } from "../auth";

export type CreateSubscriptionInput = {
  planId: string;
  status?: string;
  billingProvider?: string | null;
  billingCustomerId?: string | null;
  billingSubscriptionId?: string | null;
  currentPeriodEnd?: string | null;
  metadata?: Record<string, unknown>;
};

export class StreamsAISubscriptionsRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  async list(scope: StreamsAIScope) {
    const { data, error } = await this.db()
      .from(streamsAITables.subscriptions)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to list STREAMS AI subscriptions: ${error.message}`);
    return data || [];
  }

  async active(scope: StreamsAIScope) {
    const rows = await this.list(scope);
    return rows.filter((row) => row.status === "active" || row.status === "trialing");
  }

  async upsert(scope: StreamsAIScope, input: CreateSubscriptionInput) {
    const { data, error } = await this.db()
      .from(streamsAITables.subscriptions)
      .upsert(
        {
          tenant_id: scope.tenantId,
          user_id: scope.userId,
          plan_id: input.planId,
          status: input.status || "active",
          billing_provider: input.billingProvider || null,
          billing_customer_id: input.billingCustomerId || null,
          billing_subscription_id: input.billingSubscriptionId || null,
          current_period_end: input.currentPeriodEnd || null,
          metadata: input.metadata || {},
        },
        { onConflict: "tenant_id,user_id,plan_id" },
      )
      .select("*")
      .single();

    if (error) throw new Error(`Failed to upsert STREAMS AI subscription: ${error.message}`);
    return data;
  }
}
