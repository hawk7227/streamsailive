import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAIUsageRepository } from "@/lib/streams-ai/repositories/usage-repository";
import {
  STREAMS_AI_AUTO_RELOAD_DEFAULT_THRESHOLD_USD,
  STREAMS_AI_AUTO_RELOAD_DEFAULT_TOP_UP_USD,
  STREAMS_AI_FEATURE_COSTS,
  STREAMS_AI_MAX_SELF_SERVE_MONTHLY_SPEND_LIMIT_USD,
  STREAMS_AI_PLAN_POLICIES,
  STREAMS_AI_USAGE_MESSAGES,
} from "@/lib/streams-ai/usage-policy";

const usage = new StreamsAIUsageRepository();

type UsageSettingsPatch = {
  paidUsageEnabled?: boolean;
  autoReloadEnabled?: boolean;
  reloadThresholdUsd?: number;
  reloadTopUpUsd?: number;
  monthlySpendLimitUsd?: number | null;
};

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function currentSessionResetAt(hours: number) {
  const now = new Date();
  const windowMs = hours * 60 * 60 * 1000;
  const startMs = Math.floor(now.getTime() / windowMs) * windowMs;
  return addHours(new Date(startMs), hours).toISOString();
}

function monthlyResetAt(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0)).toISOString();
}

function fallbackFreeBuilderUsageState(patch: UsageSettingsPatch = {}) {
  const plan = STREAMS_AI_PLAN_POLICIES.free_builder;
  const sessionLimit = plan.sessionCredits;
  const dailyLimit = plan.dailyCredits;
  const includedMonthly = plan.monthlyIncludedCredits || plan.welcomeCredits || 0;
  const autoReloadEnabled = patch.autoReloadEnabled === true && plan.usageCreditsEnabled;

  return {
    ok: true,
    setupMode: "safe_free_builder_fallback",
    plan,
    account: {
      status: "active",
      paymentMethodStatus: "missing",
    },
    session: {
      used: 0,
      available: sessionLimit,
      limit: sessionLimit,
      resetAt: currentSessionResetAt(plan.sessionWindowHours),
      status: "available",
    },
    daily: {
      used: 0,
      available: dailyLimit,
      limit: dailyLimit,
      operatorUsed: 0,
      studioUsed: 0,
      videoUsed: 0,
      launchUsed: 0,
      status: "available",
    },
    usageCredits: {
      eligible: plan.usageCreditsEnabled,
      enabled: false,
      received: 0,
      used: 0,
      available: 0,
      includedMonthlyGranted: includedMonthly,
      includedMonthlyUsed: 0,
      includedMonthlyAvailable: includedMonthly,
      monthlyResetAt: monthlyResetAt(),
    },
    spend: {
      currentMonthSpendUsd: 0,
      monthlyLimitUsd: 0,
      maxSelfServeMonthlyLimitUsd: STREAMS_AI_MAX_SELF_SERVE_MONTHLY_SPEND_LIMIT_USD,
      status: "active",
      unlimitedAllowed: false,
    },
    autoReload: {
      enabled: autoReloadEnabled,
      thresholdUsd:
        typeof patch.reloadThresholdUsd === "number"
          ? Math.max(0, patch.reloadThresholdUsd)
          : STREAMS_AI_AUTO_RELOAD_DEFAULT_THRESHOLD_USD,
      topUpUsd:
        typeof patch.reloadTopUpUsd === "number"
          ? Math.max(0, patch.reloadTopUpUsd)
          : STREAMS_AI_AUTO_RELOAD_DEFAULT_TOP_UP_USD,
      status: autoReloadEnabled ? "on" : "off",
      nextCondition: "Upgrade required before paid continuation, auto-reload, and paid usage credits can run.",
    },
    featureCosts: STREAMS_AI_FEATURE_COSTS,
    messages: STREAMS_AI_USAGE_MESSAGES,
    ledger: [],
    notifications: [],
  };
}

function accountControlUnavailable(error: unknown, patch: UsageSettingsPatch = {}) {
  console.error("[streams-ai-usage-api-fallback]", error);
  return streamsAIJson(fallbackFreeBuilderUsageState(patch));
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const state = await usage.getUsageState(scope);
    return streamsAIJson(state);
  } catch (error) {
    return accountControlUnavailable(error);
  }
}

export async function PATCH(request: NextRequest) {
  let body: UsageSettingsPatch = {};

  try {
    body = await readJsonBody<UsageSettingsPatch>(request);
    const scope = await requireStreamsAIScope(request);
    const state = await usage.updateSettings(scope, body);
    return streamsAIJson(state);
  } catch (error) {
    return accountControlUnavailable(error, body);
  }
}
