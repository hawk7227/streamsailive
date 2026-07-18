import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAISubscriptionsRepository } from "@/lib/streams-ai/repositories/subscriptions-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const subscriptions = new StreamsAISubscriptionsRepository();

function failure(error: unknown) {
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown subscriptions error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const rows = request.nextUrl.searchParams.get("active") === "true"
      ? await subscriptions.active(scope)
      : await subscriptions.list(scope);
    return NextResponse.json({ ok: true, apiVersion: "v1", subscriptions: rows });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({})) as {
      planId?: string;
      status?: string;
      billingProvider?: string | null;
      billingCustomerId?: string | null;
      billingSubscriptionId?: string | null;
      currentPeriodEnd?: string | null;
      metadata?: Record<string, unknown>;
    };
    if (!body.planId?.trim()) return NextResponse.json({ ok: false, apiVersion: "v1", error: "planId is required" }, { status: 400 });
    const subscription = await subscriptions.upsert(scope, { ...body, planId: body.planId.trim() });
    return NextResponse.json({ ok: true, apiVersion: "v1", subscription });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  return PATCH(request);
}
