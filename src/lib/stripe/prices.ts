import type { PlanKey } from "@/lib/plans";
import { STRIPE_PRICE_PROFESSIONAL_MONTHLY, STRIPE_PRICE_PROFESSIONAL_YEARLY, STRIPE_PRICE_STARTER_MONTHLY, STRIPE_PRICE_STARTER_YEARLY } from "@/lib/env";

export type BillingInterval = "monthly" | "yearly";

type StripePriceIds = Record<
  PlanKey,
  { monthly: string | null; yearly: string | null }
>;

export const STRIPE_PRICE_IDS: StripePriceIds = {
  free: {
    monthly: null,
    yearly: null,
  },
  starter: {
    monthly: STRIPE_PRICE_STARTER_MONTHLY ?? null,
    yearly: STRIPE_PRICE_STARTER_YEARLY ?? null,
  },
  professional: {
    monthly: STRIPE_PRICE_PROFESSIONAL_MONTHLY ?? null,
    yearly: STRIPE_PRICE_PROFESSIONAL_YEARLY ?? null,
  },
  enterprise: {
    monthly: null,
    yearly: null,
  },
};

export function getStripePriceId(
  planKey: PlanKey,
  billing: BillingInterval
) {
  const priceId = STRIPE_PRICE_IDS[planKey]?.[billing] ?? null;

  if (!priceId) {
    throw new Error(`Missing Stripe price ID for ${planKey} (${billing})`);
  }

  return priceId;
}

export function getPlanKeyFromPriceId(priceId: string) {
  const entries = Object.entries(STRIPE_PRICE_IDS) as [
    PlanKey,
    { monthly: string | null; yearly: string | null }
  ][];

  for (const [planKey, prices] of entries) {
    if (prices.monthly === priceId) {
      return { planKey, billing: "monthly" as const };
    }
    if (prices.yearly === priceId) {
      return { planKey, billing: "yearly" as const };
    }
  }

  return null;
}
