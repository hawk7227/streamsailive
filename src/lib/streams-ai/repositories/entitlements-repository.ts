import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "../server";
import type { StreamsAIScope } from "../auth";

export type EntitlementCheckResult = {
  allowed: boolean;
  productId: string;
  status?: string | null;
  planId?: string | null;
  reason?: string;
};

const ALL_ACCESS_PRODUCTS = new Set(["all-access", "streams-all-access"]);

export class StreamsAIEntitlementsRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  async list(scope: StreamsAIScope) {
    const { data, error } = await this.db()
      .from(streamsAITables.productEntitlements)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to list STREAMS AI entitlements: ${error.message}`);
    return data || [];
  }

  async check(scope: StreamsAIScope, productId: string): Promise<EntitlementCheckResult> {
    const rows = await this.list(scope);
    const direct = rows.find((row) => row.product_id === productId && row.status === "active");
    const streamsAI = rows.find((row) => row.product_id === "streams-ai" && row.status === "active");
    const allAccess = rows.find((row) => ALL_ACCESS_PRODUCTS.has(String(row.product_id)) && row.status === "active");

    if (direct) {
      return { allowed: true, productId, status: String(direct.status), planId: direct.plan_id ? String(direct.plan_id) : null };
    }

    if (allAccess) {
      return { allowed: true, productId, status: String(allAccess.status), planId: allAccess.plan_id ? String(allAccess.plan_id) : null, reason: "all_access_entitlement" };
    }

    if (productId === "streams-ai" && streamsAI) {
      return { allowed: true, productId, status: String(streamsAI.status), planId: streamsAI.plan_id ? String(streamsAI.plan_id) : null };
    }

    return { allowed: false, productId, reason: "missing_active_entitlement" };
  }

  async require(scope: StreamsAIScope, productId: string) {
    const result = await this.check(scope, productId);
    if (!result.allowed) throw new Error(`ENTITLEMENT_REQUIRED: ${productId}`);
    return result;
  }
}
