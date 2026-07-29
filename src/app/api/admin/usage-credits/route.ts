import { NextResponse } from "next/server";
import { isAdminAuthorizationError, requireAdminSession } from "@/lib/admin/require-admin-session";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";

export const dynamic = "force-dynamic";

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  try {
    await requireAdminSession();
    const db = streamsAISchema(createStreamsAIServiceClient());
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);

    const [accountsResult, walletsResult, dailyResult, spendResult, ledgerResult, purchasesResult] = await Promise.all([
      db.from(streamsAITables.accounts).select("user_id,plan_id,account_status,created_at,updated_at"),
      db.from(streamsAITables.usageWallets).select("user_id,plan_id,included_monthly_granted,included_monthly_used,included_monthly_available,paid_credits_received,paid_credits_used,paid_credits_available,monthly_reset_at,updated_at"),
      db.from(streamsAITables.dailyUsage).select("user_id,daily_limit,daily_used,daily_available,operator_used,studio_used,video_used,launch_used,usage_date").eq("usage_date", today),
      db.from(streamsAITables.spendLimits).select("user_id,monthly_limit_usd,current_month_spend_usd,current_month_key,status,updated_at").eq("current_month_key", month),
      db.from(streamsAITables.usageLedger).select("user_id,ledger_type,amount,balance_after,reason,feature_key,stage,created_at").order("created_at", { ascending: false }).limit(100),
      db.from(streamsAITables.usageCreditPurchases).select("user_id,credits,amount_usd,status,created_at").order("created_at", { ascending: false }).limit(100),
    ]);

    const failed = [accountsResult, walletsResult, dailyResult, spendResult, ledgerResult, purchasesResult].find((result) => result.error);
    if (failed?.error) throw failed.error;

    const accounts = accountsResult.data || [];
    const wallets = walletsResult.data || [];
    const daily = dailyResult.data || [];
    const spend = spendResult.data || [];
    const ledger = ledgerResult.data || [];
    const purchases = purchasesResult.data || [];

    const walletByUser = new Map(wallets.map((row) => [String(row.user_id), row]));
    const dailyByUser = new Map(daily.map((row) => [String(row.user_id), row]));
    const spendByUser = new Map(spend.map((row) => [String(row.user_id), row]));

    const users = accounts.map((account) => {
      const userId = String(account.user_id);
      const wallet = walletByUser.get(userId);
      const todayUsage = dailyByUser.get(userId);
      const monthlySpend = spendByUser.get(userId);
      return {
        userId,
        planId: account.plan_id || wallet?.plan_id || "free_builder",
        status: account.account_status || "unknown",
        dailyUsed: number(todayUsage?.daily_used),
        dailyLimit: number(todayUsage?.daily_limit),
        dailyAvailable: number(todayUsage?.daily_available),
        includedAvailable: number(wallet?.included_monthly_available),
        paidAvailable: number(wallet?.paid_credits_available),
        paidReceived: number(wallet?.paid_credits_received),
        paidUsed: number(wallet?.paid_credits_used),
        monthlySpendUsd: number(monthlySpend?.current_month_spend_usd),
        monthlySpendLimitUsd: monthlySpend?.monthly_limit_usd ?? null,
        updatedAt: wallet?.updated_at || account.updated_at || account.created_at,
      };
    });

    const totals = {
      users: users.length,
      activeUsersToday: daily.filter((row) => number(row.daily_used) > 0).length,
      dailyCreditsUsed: daily.reduce((sum, row) => sum + number(row.daily_used), 0),
      includedCreditsAvailable: wallets.reduce((sum, row) => sum + number(row.included_monthly_available), 0),
      paidCreditsAvailable: wallets.reduce((sum, row) => sum + number(row.paid_credits_available), 0),
      monthlySpendUsd: spend.reduce((sum, row) => sum + number(row.current_month_spend_usd), 0),
      purchaseRevenueUsd: purchases.filter((row) => row.status === "paid" || row.status === "succeeded").reduce((sum, row) => sum + number(row.amount_usd), 0),
    };

    const highestUsage = [...users].sort((left, right) => right.dailyUsed - left.dailyUsed).slice(0, 25);
    const highestSpend = [...users].sort((left, right) => right.monthlySpendUsd - left.monthlySpendUsd).slice(0, 25);

    return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), totals, users, highestUsage, highestSpend, ledger, purchases });
  } catch (error) {
    if (isAdminAuthorizationError(error)) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[admin-usage-credits]", error);
    return NextResponse.json({ ok: false, error: "Usage and credits data is temporarily unavailable." }, { status: 500 });
  }
}
