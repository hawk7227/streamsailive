import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "../server";
import type { StreamsAIScope } from "../auth";
import {
  getStreamsAIFeatureCost,
  getStreamsAIPlanPolicy,
  normalizeStreamsAIPlanId,
  STREAMS_AI_AUTO_RELOAD_DEFAULT_THRESHOLD_USD,
  STREAMS_AI_AUTO_RELOAD_DEFAULT_TOP_UP_USD,
  STREAMS_AI_DEFAULT_MONTHLY_SPEND_LIMIT_USD,
  STREAMS_AI_FEATURE_COSTS,
  STREAMS_AI_MAX_SELF_SERVE_MONTHLY_SPEND_LIMIT_USD,
  STREAMS_AI_USAGE_MESSAGES,
  type StreamsAIFeatureCostKey,
} from "../usage-policy";

type JsonObject = Record<string, unknown>;

type UsageSettingsPatch = {
  paidUsageEnabled?: boolean;
  autoReloadEnabled?: boolean;
  reloadThresholdUsd?: number;
  reloadTopUpUsd?: number;
  monthlySpendLimitUsd?: number | null;
};

type UsageGateInput = {
  featureKey?: StreamsAIFeatureCostKey;
  stage?: "draft" | "final";
  credits?: number;
  relatedJobId?: string | null;
  relatedSessionId?: string | null;
  confirmPaidUsage?: boolean;
};

function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function monthReset(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

function currentSessionWindow(hours: number) {
  const now = new Date();
  const windowMs = hours * 60 * 60 * 1000;
  const startMs = Math.floor(now.getTime() / windowMs) * windowMs;
  const start = new Date(startMs);
  const reset = addHours(start, hours);
  return { key: `${hours}h-${start.toISOString()}`, start, reset };
}

function asNumber(value: unknown, fallback = 0) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function metadata(row: JsonObject | null | undefined): JsonObject {
  const value = row?.metadata;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function clampSpendLimit(value: number | null | undefined) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return STREAMS_AI_DEFAULT_MONTHLY_SPEND_LIMIT_USD;
  return Math.max(0, Math.min(STREAMS_AI_MAX_SELF_SERVE_MONTHLY_SPEND_LIMIT_USD, value));
}

export class StreamsAIUsageRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  private async resolvePlan(scope: StreamsAIScope) {
    const { data: subscriptions, error: subscriptionsError } = await this.db()
      .from(streamsAITables.subscriptions)
      .select("plan_id,status,created_at")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (subscriptionsError) throw new Error(`Usage setup unavailable: ${subscriptionsError.message}`);

    const activeSubscription = (subscriptions || []).find((row) => row.status === "active" || row.status === "trialing");
    if (activeSubscription?.plan_id) return getStreamsAIPlanPolicy(activeSubscription.plan_id);

    const { data: entitlements, error: entitlementsError } = await this.db()
      .from(streamsAITables.productEntitlements)
      .select("plan_id,status,created_at")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("product_id", scope.productId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (entitlementsError) throw new Error(`Usage setup unavailable: ${entitlementsError.message}`);

    const activeEntitlement = (entitlements || []).find((row) => row.status === "active" || row.status === "trialing");
    return getStreamsAIPlanPolicy(activeEntitlement?.plan_id || "free_builder");
  }

  private async ensureAccount(scope: StreamsAIScope, planId: string) {
    const { data, error } = await this.db()
      .from(streamsAITables.accounts)
      .upsert(
        {
          tenant_id: scope.tenantId,
          user_id: scope.userId,
          plan_id: normalizeStreamsAIPlanId(planId),
          account_status: "active",
          metadata: {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,user_id" },
      )
      .select("*")
      .single();

    if (error) throw new Error(`Usage setup unavailable: ${error.message}`);
    return data as JsonObject;
  }

  private async ensureWallet(scope: StreamsAIScope, planId: string) {
    const policy = getStreamsAIPlanPolicy(planId);
    const month = monthKey();
    const reset = monthReset().toISOString();

    const { data: existing, error: existingError } = await this.db()
      .from(streamsAITables.usageWallets)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .maybeSingle();

    if (existingError) throw new Error(`Usage setup unavailable: ${existingError.message}`);

    if (!existing) {
      const firstGrant = policy.monthlyIncludedCredits || policy.welcomeCredits || 0;
      const { data, error } = await this.db()
        .from(streamsAITables.usageWallets)
        .insert({
          tenant_id: scope.tenantId,
          user_id: scope.userId,
          plan_id: policy.id,
          included_monthly_granted: firstGrant,
          included_monthly_used: 0,
          included_monthly_available: firstGrant,
          paid_credits_received: 0,
          paid_credits_used: 0,
          paid_credits_available: 0,
          welcome_credits_granted: policy.welcomeCredits || 0,
          welcome_credits_expires_at: policy.welcomeExpiresDays
            ? addHours(new Date(), policy.welcomeExpiresDays * 24).toISOString()
            : null,
          current_month_key: month,
          monthly_reset_at: reset,
          metadata: { paidUsageEnabled: false },
        })
        .select("*")
        .single();

      if (error) throw new Error(`Usage setup unavailable: ${error.message}`);
      await this.createUsageLedger(scope, {
        ledgerType: "grant",
        amount: firstGrant,
        balanceAfter: firstGrant,
        reason: policy.welcomeCredits ? "Welcome usage credits granted" : "Monthly included usage granted",
      });
      return data as JsonObject;
    }

    const row = existing as JsonObject;
    const needsMonthlyReset = row.current_month_key !== month || row.plan_id !== policy.id;
    if (!needsMonthlyReset) return row;

    const nextIncluded = policy.monthlyIncludedCredits || 0;
    const { data, error } = await this.db()
      .from(streamsAITables.usageWallets)
      .update({
        plan_id: policy.id,
        included_monthly_granted: nextIncluded,
        included_monthly_used: 0,
        included_monthly_available: nextIncluded,
        current_month_key: month,
        monthly_reset_at: reset,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .select("*")
      .single();

    if (error) throw new Error(`Usage setup unavailable: ${error.message}`);
    await this.createUsageLedger(scope, {
      ledgerType: "monthly_reset",
      amount: nextIncluded,
      balanceAfter: nextIncluded,
      reason: "Included usage reset is available",
    });
    await this.notify(scope, "included_usage_reset_available", "Included usage reset", "Your included usage has reset and is ready for this billing cycle.");
    return data as JsonObject;
  }

  private async ensureSession(scope: StreamsAIScope, planId: string) {
    const policy = getStreamsAIPlanPolicy(planId);
    const window = currentSessionWindow(policy.sessionWindowHours);
    const { data: existing, error: existingError } = await this.db()
      .from(streamsAITables.usageSessions)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("session_key", window.key)
      .maybeSingle();

    if (existingError) throw new Error(`Usage setup unavailable: ${existingError.message}`);
    if (existing) return existing as JsonObject;

    const { data, error } = await this.db()
      .from(streamsAITables.usageSessions)
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        session_key: window.key,
        window_started_at: window.start.toISOString(),
        reset_at: window.reset.toISOString(),
        included_limit: policy.sessionCredits,
        included_used: 0,
        included_available: policy.sessionCredits,
      })
      .select("*")
      .single();

    if (error) throw new Error(`Usage setup unavailable: ${error.message}`);
    return data as JsonObject;
  }

  private async ensureDailyUsage(scope: StreamsAIScope, planId: string) {
    const policy = getStreamsAIPlanPolicy(planId);
    const date = dayKey();
    const { data: existing, error: existingError } = await this.db()
      .from(streamsAITables.dailyUsage)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("usage_date", date)
      .maybeSingle();

    if (existingError) throw new Error(`Usage setup unavailable: ${existingError.message}`);
    if (existing) return existing as JsonObject;

    const { data, error } = await this.db()
      .from(streamsAITables.dailyUsage)
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        usage_date: date,
        daily_limit: policy.dailyCredits,
        daily_used: 0,
        daily_available: policy.dailyCredits,
      })
      .select("*")
      .single();

    if (error) throw new Error(`Usage setup unavailable: ${error.message}`);
    return data as JsonObject;
  }

  private async ensureSpendLimit(scope: StreamsAIScope, planId: string) {
    const policy = getStreamsAIPlanPolicy(planId);
    const month = monthKey();
    const { data: existing, error: existingError } = await this.db()
      .from(streamsAITables.spendLimits)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .maybeSingle();

    if (existingError) throw new Error(`Usage setup unavailable: ${existingError.message}`);

    if (!existing) {
      const { data, error } = await this.db()
        .from(streamsAITables.spendLimits)
        .insert({
          tenant_id: scope.tenantId,
          user_id: scope.userId,
          monthly_limit_usd: policy.usageCreditsEnabled ? STREAMS_AI_DEFAULT_MONTHLY_SPEND_LIMIT_USD : 0,
          current_month_spend_usd: 0,
          current_month_key: month,
          unlimited_allowed: policy.id !== "free_builder",
          status: "active",
        })
        .select("*")
        .single();

      if (error) throw new Error(`Usage setup unavailable: ${error.message}`);
      return data as JsonObject;
    }

    if ((existing as JsonObject).current_month_key === month) return existing as JsonObject;

    const { data, error } = await this.db()
      .from(streamsAITables.spendLimits)
      .update({ current_month_spend_usd: 0, current_month_key: month, updated_at: new Date().toISOString() })
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .select("*")
      .single();

    if (error) throw new Error(`Usage setup unavailable: ${error.message}`);
    return data as JsonObject;
  }

  private async ensureAutoReload(scope: StreamsAIScope) {
    const { data: existing, error: existingError } = await this.db()
      .from(streamsAITables.autoReloadSettings)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .maybeSingle();

    if (existingError) throw new Error(`Usage setup unavailable: ${existingError.message}`);
    if (existing) return existing as JsonObject;

    const { data, error } = await this.db()
      .from(streamsAITables.autoReloadSettings)
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        enabled: false,
        threshold_usd: STREAMS_AI_AUTO_RELOAD_DEFAULT_THRESHOLD_USD,
        top_up_usd: STREAMS_AI_AUTO_RELOAD_DEFAULT_TOP_UP_USD,
        status: "off",
      })
      .select("*")
      .single();

    if (error) throw new Error(`Usage setup unavailable: ${error.message}`);
    return data as JsonObject;
  }

  async getUsageState(scope: StreamsAIScope) {
    const plan = await this.resolvePlan(scope);
    const [account, wallet, session, daily, spendLimit, autoReload] = await Promise.all([
      this.ensureAccount(scope, plan.id),
      this.ensureWallet(scope, plan.id),
      this.ensureSession(scope, plan.id),
      this.ensureDailyUsage(scope, plan.id),
      this.ensureSpendLimit(scope, plan.id),
      this.ensureAutoReload(scope),
    ]);

    const [ledger, notifications] = await Promise.all([this.listUsageLedger(scope, 30), this.listNotifications(scope, 20)]);
    const walletMetadata = metadata(wallet);
    const paidUsageEnabled = plan.usageCreditsEnabled && walletMetadata.paidUsageEnabled === true;
    const sessionAvailable = asNumber(session.included_available);
    const dailyAvailable = asNumber(daily.daily_available);
    const includedAvailable = asNumber(wallet.included_monthly_available);
    const paidAvailable = asNumber(wallet.paid_credits_available);
    const monthlySpend = asNumber(spendLimit.current_month_spend_usd);
    const monthlyLimit = spendLimit.monthly_limit_usd === null ? null : asNumber(spendLimit.monthly_limit_usd);

    return {
      ok: true,
      plan,
      account: {
        status: account.account_status || "active",
        paymentMethodStatus: account.payment_method_status || "missing",
      },
      session: {
        used: asNumber(session.included_used),
        available: sessionAvailable,
        limit: asNumber(session.included_limit),
        resetAt: session.reset_at,
        status: sessionAvailable <= 0 ? "limit_reached" : sessionAvailable <= Math.max(2, asNumber(session.included_limit) * 0.2) ? "near_limit" : "available",
      },
      daily: {
        used: asNumber(daily.daily_used),
        available: dailyAvailable,
        limit: asNumber(daily.daily_limit),
        operatorUsed: asNumber(daily.operator_used),
        studioUsed: asNumber(daily.studio_used),
        videoUsed: asNumber(daily.video_used),
        launchUsed: asNumber(daily.launch_used),
        status: dailyAvailable <= 0 ? "limit_reached" : dailyAvailable <= Math.max(3, asNumber(daily.daily_limit) * 0.2) ? "near_limit" : "available",
      },
      usageCredits: {
        eligible: plan.usageCreditsEnabled,
        enabled: paidUsageEnabled,
        received: asNumber(wallet.paid_credits_received),
        used: asNumber(wallet.paid_credits_used),
        available: paidAvailable,
        includedMonthlyGranted: asNumber(wallet.included_monthly_granted),
        includedMonthlyUsed: asNumber(wallet.included_monthly_used),
        includedMonthlyAvailable: includedAvailable,
        monthlyResetAt: wallet.monthly_reset_at,
      },
      spend: {
        currentMonthSpendUsd: monthlySpend,
        monthlyLimitUsd: monthlyLimit,
        maxSelfServeMonthlyLimitUsd: STREAMS_AI_MAX_SELF_SERVE_MONTHLY_SPEND_LIMIT_USD,
        status: monthlyLimit !== null && monthlySpend >= monthlyLimit ? "limit_reached" : "active",
        unlimitedAllowed: spendLimit.unlimited_allowed === true,
      },
      autoReload: {
        enabled: autoReload.enabled === true,
        thresholdUsd: asNumber(autoReload.threshold_usd, STREAMS_AI_AUTO_RELOAD_DEFAULT_THRESHOLD_USD),
        topUpUsd: asNumber(autoReload.top_up_usd, STREAMS_AI_AUTO_RELOAD_DEFAULT_TOP_UP_USD),
        status: autoReload.status || "off",
        nextCondition: "Runs when balance is below threshold, payment is ready, and spend limit allows it.",
      },
      featureCosts: STREAMS_AI_FEATURE_COSTS,
      messages: STREAMS_AI_USAGE_MESSAGES,
      ledger,
      notifications,
    };
  }

  async updateSettings(scope: StreamsAIScope, patch: UsageSettingsPatch) {
    const plan = await this.resolvePlan(scope);
    await this.ensureWallet(scope, plan.id);
    await this.ensureAutoReload(scope);
    await this.ensureSpendLimit(scope, plan.id);

    if (typeof patch.paidUsageEnabled === "boolean") {
      if (!plan.usageCreditsEnabled && patch.paidUsageEnabled) {
        throw new Error(STREAMS_AI_USAGE_MESSAGES.freeLimitReached);
      }
      const { data: wallet, error } = await this.db()
        .from(streamsAITables.usageWallets)
        .select("metadata")
        .eq("tenant_id", scope.tenantId)
        .eq("user_id", scope.userId)
        .single();
      if (error) throw new Error(`Usage setup unavailable: ${error.message}`);
      const nextMetadata = { ...metadata(wallet as JsonObject), paidUsageEnabled: patch.paidUsageEnabled };
      const { error: updateError } = await this.db()
        .from(streamsAITables.usageWallets)
        .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
        .eq("tenant_id", scope.tenantId)
        .eq("user_id", scope.userId);
      if (updateError) throw new Error(`Usage setup unavailable: ${updateError.message}`);
      await this.notify(
        scope,
        "paid_usage_credits_turned_on",
        patch.paidUsageEnabled ? "Usage credits turned on" : "Usage credits turned off",
        patch.paidUsageEnabled
          ? "Usage credits can now keep eligible premium actions moving after included usage is exhausted."
          : "Usage credits are off. Included usage will still work until reset.",
      );
    }

    if (typeof patch.autoReloadEnabled === "boolean" || typeof patch.reloadThresholdUsd === "number" || typeof patch.reloadTopUpUsd === "number") {
      const { error } = await this.db()
        .from(streamsAITables.autoReloadSettings)
        .update({
          ...(typeof patch.autoReloadEnabled === "boolean" ? { enabled: patch.autoReloadEnabled, status: patch.autoReloadEnabled ? "on" : "off" } : {}),
          ...(typeof patch.reloadThresholdUsd === "number" ? { threshold_usd: Math.max(0, patch.reloadThresholdUsd) } : {}),
          ...(typeof patch.reloadTopUpUsd === "number" ? { top_up_usd: Math.max(0, patch.reloadTopUpUsd) } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", scope.tenantId)
        .eq("user_id", scope.userId);
      if (error) throw new Error(`Usage setup unavailable: ${error.message}`);
    }

    if ("monthlySpendLimitUsd" in patch) {
      const limit = clampSpendLimit(patch.monthlySpendLimitUsd);
      const { error } = await this.db()
        .from(streamsAITables.spendLimits)
        .update({ monthly_limit_usd: limit, updated_at: new Date().toISOString() })
        .eq("tenant_id", scope.tenantId)
        .eq("user_id", scope.userId);
      if (error) throw new Error(`Usage setup unavailable: ${error.message}`);
    }

    return this.getUsageState(scope);
  }

  async gate(scope: StreamsAIScope, input: UsageGateInput) {
    const cost = Math.max(0, asNumber(input.credits, getStreamsAIFeatureCost(input.featureKey, input.stage)));
    const state = await this.getUsageState(scope);
    const featureKey = input.featureKey || "operator_chat";
    const stage = input.stage || "final";

    if (cost <= 0) {
      return { ok: true, allowed: true, source: "free_action", credits: 0, message: STREAMS_AI_USAGE_MESSAGES.actionAllowed, state };
    }

    const canUseIncluded =
      state.session.available >= cost && state.daily.available >= cost && state.usageCredits.includedMonthlyAvailable >= cost;

    if (canUseIncluded) {
      await this.debitIncluded(scope, cost, featureKey, stage, input.relatedJobId, input.relatedSessionId);
      const nextState = await this.getUsageState(scope);
      await this.createLimitNotifications(scope, nextState);
      return { ok: true, allowed: true, source: "included_usage", credits: cost, message: STREAMS_AI_USAGE_MESSAGES.actionAllowed, state: nextState };
    }

    if (state.plan.id === "free_builder") {
      await this.notify(scope, "included_session_usage_reached", "Included usage reached", STREAMS_AI_USAGE_MESSAGES.freeLimitReached);
      return { ok: true, allowed: false, reason: "free_limit_reached", credits: cost, message: STREAMS_AI_USAGE_MESSAGES.freeLimitReached, state };
    }

    if (!state.usageCredits.enabled) {
      await this.notify(scope, "included_session_usage_reached", "Included usage reached", STREAMS_AI_USAGE_MESSAGES.paidLimitCreditsOff);
      return { ok: true, allowed: false, reason: "usage_credits_disabled", credits: cost, message: STREAMS_AI_USAGE_MESSAGES.paidLimitCreditsOff, state };
    }

    if (state.spend.status === "limit_reached") {
      await this.notify(scope, "monthly_spend_limit_reached", "Monthly spend limit reached", STREAMS_AI_USAGE_MESSAGES.spendLimitReached);
      return { ok: true, allowed: false, reason: "spend_limit_reached", credits: cost, message: STREAMS_AI_USAGE_MESSAGES.spendLimitReached, state };
    }

    if (state.usageCredits.available < cost) {
      await this.notify(scope, "paid_usage_credit_balance_low", "Usage credit balance low", STREAMS_AI_USAGE_MESSAGES.lowBalance);
      return { ok: true, allowed: false, reason: "low_usage_credit_balance", credits: cost, message: STREAMS_AI_USAGE_MESSAGES.lowBalance, state };
    }

    if (!input.confirmPaidUsage) {
      return { ok: true, allowed: false, requiresConfirmation: true, reason: "confirm_paid_usage", credits: cost, message: STREAMS_AI_USAGE_MESSAGES.paidLimitCreditsOn, state };
    }

    await this.debitPaid(scope, cost, featureKey, stage, input.relatedJobId, input.relatedSessionId);
    const nextState = await this.getUsageState(scope);
    await this.notify(scope, "paid_usage_credits_used", "Usage credits used", `${cost.toLocaleString()} usage credits were applied to keep this action moving.`);
    await this.createLimitNotifications(scope, nextState);
    return { ok: true, allowed: true, source: "paid_usage_credits", credits: cost, message: STREAMS_AI_USAGE_MESSAGES.actionAllowed, state: nextState };
  }

  private async debitIncluded(
    scope: StreamsAIScope,
    cost: number,
    featureKey: string,
    stage: string,
    relatedJobId?: string | null,
    relatedSessionId?: string | null,
  ) {
    const state = await this.getUsageState(scope);
    await Promise.all([
      this.db()
        .from(streamsAITables.usageWallets)
        .update({
          included_monthly_used: state.usageCredits.includedMonthlyUsed + cost,
          included_monthly_available: Math.max(0, state.usageCredits.includedMonthlyAvailable - cost),
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", scope.tenantId)
        .eq("user_id", scope.userId),
      this.db()
        .from(streamsAITables.usageSessions)
        .update({
          included_used: state.session.used + cost,
          included_available: Math.max(0, state.session.available - cost),
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", scope.tenantId)
        .eq("user_id", scope.userId)
        .eq("session_key", currentSessionWindow(state.plan.sessionWindowHours).key),
      this.db()
        .from(streamsAITables.dailyUsage)
        .update({
          daily_used: state.daily.used + cost,
          daily_available: Math.max(0, state.daily.available - cost),
          ...this.categoryUsagePatch(featureKey, state, cost),
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", scope.tenantId)
        .eq("user_id", scope.userId)
        .eq("usage_date", dayKey()),
    ]).then((results) => {
      const failed = results.find((result) => result.error);
      if (failed?.error) throw new Error(`Usage setup unavailable: ${failed.error.message}`);
    });

    await this.createUsageLedger(scope, {
      ledgerType: "included_debit",
      amount: -cost,
      balanceAfter: Math.max(0, state.usageCredits.includedMonthlyAvailable - cost),
      featureKey,
      stage,
      actionStatus: "allowed",
      reason: "Included usage debited",
      relatedJobId,
      relatedSessionId,
    });
  }

  private async debitPaid(
    scope: StreamsAIScope,
    cost: number,
    featureKey: string,
    stage: string,
    relatedJobId?: string | null,
    relatedSessionId?: string | null,
  ) {
    const state = await this.getUsageState(scope);
    const nextPaidAvailable = Math.max(0, state.usageCredits.available - cost);
    const { error } = await this.db()
      .from(streamsAITables.usageWallets)
      .update({
        paid_credits_used: state.usageCredits.used + cost,
        paid_credits_available: nextPaidAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId);

    if (error) throw new Error(`Usage setup unavailable: ${error.message}`);

    await Promise.all([
      this.createUsageLedger(scope, {
        ledgerType: "paid_debit",
        amount: -cost,
        balanceAfter: nextPaidAvailable,
        featureKey,
        stage,
        actionStatus: "allowed",
        reason: "Paid usage credits debited",
        relatedJobId,
        relatedSessionId,
      }),
      this.db().from(streamsAITables.creditLedger).insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        amount: -cost,
        balance_after: nextPaidAvailable,
        source: "usage_credits",
        reason: "Premium action used usage credits",
        related_job_id: relatedJobId || null,
        related_session_id: relatedSessionId || null,
        metadata: { featureKey, stage },
      }),
    ]);
  }

  private categoryUsagePatch(featureKey: string, state: Awaited<ReturnType<StreamsAIUsageRepository["getUsageState"]>>, cost: number) {
    if (featureKey.includes("video") || featureKey.includes("motion")) return { video_used: state.daily.videoUsed + cost };
    if (featureKey.includes("launch") || featureKey.includes("website")) return { launch_used: state.daily.launchUsed + cost };
    if (featureKey.includes("image") || featureKey.includes("voice") || featureKey.includes("caption") || featureKey.includes("content")) {
      return { studio_used: state.daily.studioUsed + cost };
    }
    return { operator_used: state.daily.operatorUsed + cost };
  }

  private async createUsageLedger(
    scope: StreamsAIScope,
    input: {
      ledgerType: string;
      amount: number;
      balanceAfter?: number;
      featureKey?: string | null;
      stage?: string | null;
      actionStatus?: string | null;
      reason?: string | null;
      relatedJobId?: string | null;
      relatedSessionId?: string | null;
    },
  ) {
    const { data, error } = await this.db()
      .from(streamsAITables.usageLedger)
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        ledger_type: input.ledgerType,
        amount: input.amount,
        balance_after: input.balanceAfter ?? null,
        feature_key: input.featureKey || null,
        stage: input.stage || null,
        action_status: input.actionStatus || null,
        reason: input.reason || null,
        related_job_id: input.relatedJobId || null,
        related_session_id: input.relatedSessionId || null,
      })
      .select("*")
      .single();

    if (error) throw new Error(`Usage setup unavailable: ${error.message}`);
    return data as JsonObject;
  }

  private async listUsageLedger(scope: StreamsAIScope, limit: number) {
    const { data, error } = await this.db()
      .from(streamsAITables.usageLedger)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Usage setup unavailable: ${error.message}`);
    return (data || []) as JsonObject[];
  }

  private async listNotifications(scope: StreamsAIScope, limit: number) {
    const { data, error } = await this.db()
      .from(streamsAITables.usageNotifications)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Usage setup unavailable: ${error.message}`);
    return (data || []) as JsonObject[];
  }

  private async notify(scope: StreamsAIScope, eventType: string, title: string, message: string) {
    const { error } = await this.db().from(streamsAITables.usageNotifications).insert({
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      event_type: eventType,
      title,
      message,
      action_href: "/account/usage",
      status: "unread",
    });
    if (error) throw new Error(`Usage setup unavailable: ${error.message}`);
  }

  private async createLimitNotifications(scope: StreamsAIScope, state: Awaited<ReturnType<StreamsAIUsageRepository["getUsageState"]>>) {
    const tasks: Promise<void>[] = [];
    if (state.session.status === "near_limit") {
      tasks.push(this.notify(scope, "included_session_usage_near_limit", "Included usage almost used", STREAMS_AI_USAGE_MESSAGES.approachingIncludedLimit));
    }
    if (state.session.status === "limit_reached") {
      tasks.push(this.notify(scope, "included_session_usage_reached", "Included usage reached", STREAMS_AI_USAGE_MESSAGES.paidLimitCreditsOff));
    }
    if (state.daily.status === "near_limit") {
      tasks.push(this.notify(scope, "daily_usage_near_limit", "Daily usage almost used", "You’re close to today’s usage limit. Review your Usage page before starting another premium action."));
    }
    if (state.daily.status === "limit_reached") {
      tasks.push(this.notify(scope, "daily_usage_reached", "Daily usage reached", "Today’s usage limit has been reached. You can continue after the daily reset or upgrade your plan."));
    }
    if (state.usageCredits.enabled && state.usageCredits.available > 0 && state.usageCredits.available <= 150) {
      tasks.push(this.notify(scope, "paid_usage_credit_balance_low", "Usage credit balance low", STREAMS_AI_USAGE_MESSAGES.lowBalance));
    }
    await Promise.all(tasks);
  }
}
