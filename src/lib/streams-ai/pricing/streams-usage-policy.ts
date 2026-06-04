export type StreamsUsageResetWindow = "five_hour_session" | "daily" | "monthly";

export type StreamsUsageCreditPolicy = {
  includedUsageResetWindow: StreamsUsageResetWindow;
  includedUsageResetHours: number;
  paidUsageCreditsAllowedOnFreePlan: boolean;
  paidUsageCreditsAllowedOnPaidPlans: boolean;
  defaultMonthlySpendLimitUsd: number;
  maximumMonthlySpendLimitUsd: number;
  dailyUsageCreditPurchaseLimitUsd: number;
  lowBalanceWarningUsd: number;
  defaultAutoReloadEnabled: boolean;
  defaultAutoReloadThresholdUsd: number;
  defaultAutoReloadTopUpUsd: number;
};

export const STREAMS_USAGE_CREDIT_POLICY: StreamsUsageCreditPolicy = {
  includedUsageResetWindow: "five_hour_session",
  includedUsageResetHours: 5,
  paidUsageCreditsAllowedOnFreePlan: false,
  paidUsageCreditsAllowedOnPaidPlans: true,
  defaultMonthlySpendLimitUsd: 100,
  maximumMonthlySpendLimitUsd: 2000,
  dailyUsageCreditPurchaseLimitUsd: 2000,
  lowBalanceWarningUsd: 15,
  defaultAutoReloadEnabled: false,
  defaultAutoReloadThresholdUsd: 10,
  defaultAutoReloadTopUpUsd: 50,
};

export const STREAMS_USAGE_COPY = {
  includedLimitReached: "You've used your included session limit. Wait for your reset or use usage credits to keep building.",
  freeLimitReached: "You've used your free included usage. Upgrade to keep building now or wait for your reset.",
  paidCreditsEnabled: "Usage credits let you keep building after your included plan usage runs out.",
  autoReload: "Automatically add usage credits when your balance is running low.",
  spendLimit: "Set a monthly spending limit for usage credits.",
};

export function getNextUsageResetAt(now = new Date(), resetHours = STREAMS_USAGE_CREDIT_POLICY.includedUsageResetHours) {
  const next = new Date(now);
  next.setHours(next.getHours() + resetHours, 0, 0, 0);
  return next;
}

export function canEnableUsageCredits(planId: string) {
  return planId !== "free_builder" && STREAMS_USAGE_CREDIT_POLICY.paidUsageCreditsAllowedOnPaidPlans;
}
