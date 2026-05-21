import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAICreditLedgerRepository } from "@/lib/streams-ai/repositories/credit-ledger-repository";
import { StreamsAIEntitlementsRepository } from "@/lib/streams-ai/repositories/entitlements-repository";
import { StreamsAISubscriptionsRepository } from "@/lib/streams-ai/repositories/subscriptions-repository";
import { StreamsAIUsageEventsRepository } from "@/lib/streams-ai/repositories/usage-events-repository";

const creditLedger = new StreamsAICreditLedgerRepository();
const entitlements = new StreamsAIEntitlementsRepository();
const subscriptions = new StreamsAISubscriptionsRepository();
const usageEvents = new StreamsAIUsageEventsRepository();

function normalizeRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => ({ ...row }));
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const [creditRows, balance, entitlementRows, subscriptionRows, usageRows] = await Promise.all([
      creditLedger.list(scope, 100),
      creditLedger.balance(scope),
      entitlements.list(scope),
      subscriptions.list(scope),
      usageEvents.list(scope),
    ]);

    return streamsAIJson({
      ok: true,
      source: "streams-ai-account-status",
      scope: {
        tenantId: scope.tenantId,
        userId: scope.userId,
        defaultProjectId: scope.defaultProjectId,
        workspaceId: scope.workspaceId,
        moduleId: scope.moduleId,
        productId: scope.productId,
      },
      credits: {
        balance,
        ledger: normalizeRows(creditRows as Array<Record<string, unknown>>),
      },
      entitlements: normalizeRows(entitlementRows as Array<Record<string, unknown>>),
      subscriptions: normalizeRows(subscriptionRows as Array<Record<string, unknown>>),
      usageEvents: normalizeRows(usageRows as Array<Record<string, unknown>>),
    });
  } catch (error) {
    return streamsAIError(error);
  }
}
