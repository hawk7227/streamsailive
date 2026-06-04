import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAIUsageRepository } from "@/lib/streams-ai/repositories/usage-repository";
import { STREAMS_AI_USAGE_MESSAGES } from "@/lib/streams-ai/usage-policy";

const usage = new StreamsAIUsageRepository();

function setupUnavailable(error: unknown) {
  console.error("[streams-ai-credits-api-error]", error);
  return streamsAIJson(
    {
      ok: false,
      code: "usage_setup_unavailable",
      message: STREAMS_AI_USAGE_MESSAGES.backendSetupUnavailable,
      availableCredits: null,
      credits: null,
      ledger: [],
    },
    503,
  );
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const state = await usage.getUsageState(scope);
    return streamsAIJson({
      ok: true,
      availableCredits: state.usageCredits.available,
      monthlyIncludedCredits: state.usageCredits.includedMonthlyGranted,
      usedThisPeriod: state.usageCredits.includedMonthlyUsed + state.usageCredits.used,
      reservedCredits: 0,
      credits: state.usageCredits,
      plan: state.plan,
      session: state.session,
      daily: state.daily,
      spend: state.spend,
      autoReload: state.autoReload,
      ledger: state.ledger,
    });
  } catch (error) {
    return setupUnavailable(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      paidUsageEnabled?: boolean;
      autoReloadEnabled?: boolean;
      reloadThresholdUsd?: number;
      reloadTopUpUsd?: number;
      monthlySpendLimitUsd?: number | null;
    }>(request);

    const state = await usage.updateSettings(scope, body);
    return streamsAIJson(state);
  } catch (error) {
    return setupUnavailable(error);
  }
}
