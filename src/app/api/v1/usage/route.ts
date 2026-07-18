import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateApiKey, logApiUsage } from "@/lib/api-auth";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIUsageRepository } from "@/lib/streams-ai/repositories/usage-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const usage = new StreamsAIUsageRepository();
const formatDate = (date: Date) => date.toISOString().slice(0, 10);
const getUsagePeriod = (date = new Date()) => {
  const periodStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { periodStart: formatDate(periodStart), periodEnd: formatDate(periodEnd) };
};

async function legacyApiKeyUsage(request: Request) {
  const apiKey = await validateApiKey(request);
  if (!apiKey) return null;
  const { periodStart, periodEnd } = getUsagePeriod();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("generation_usage")
    .select("generations_used")
    .eq("workspace_id", apiKey.workspace_id)
    .eq("period_start", periodStart)
    .maybeSingle();
  await logApiUsage(request, error ? 500 : 200, apiKey);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: { period_start: periodStart, period_end: periodEnd, generations_used: data?.generations_used ?? 0 } });
}

function failure(error: unknown) {
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown usage error" }, { status: 400 });
}

export async function GET(request: NextRequest) {
  try {
    const legacy = await legacyApiKeyUsage(request);
    if (legacy) return legacy;
    const scope = await requireStreamsAIScope(request);
    return NextResponse.json({ apiVersion: "v1", ...(await usage.getUsageState(scope)) });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({})) as {
      paidUsageEnabled?: boolean;
      autoReloadEnabled?: boolean;
      reloadThresholdUsd?: number;
      reloadTopUpUsd?: number;
      monthlySpendLimitUsd?: number | null;
    };
    return NextResponse.json({ apiVersion: "v1", ...(await usage.updateSettings(scope, body)) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({})) as Parameters<StreamsAIUsageRepository["gate"]>[1];
    return NextResponse.json({ apiVersion: "v1", ...(await usage.gate(scope, body)) });
  } catch (error) {
    return failure(error);
  }
}
