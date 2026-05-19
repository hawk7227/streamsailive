import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAICreditsRepository } from "@/lib/streams-ai/repositories/credits-repository";

const credits = new StreamsAICreditsRepository();

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const limitParam = Number(request.nextUrl.searchParams.get("limit") || "50");
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;
    const balance = await credits.balance(scope);
    const ledger = await credits.list(scope, limit);
    return streamsAIJson({ ok: true, balance, ledger });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      amount?: number;
      source?: string;
      reason?: string | null;
      relatedJobId?: string | null;
      relatedSessionId?: string | null;
      metadata?: Record<string, unknown>;
    }>(request);

    if (typeof body.amount !== "number" || !Number.isFinite(body.amount)) {
      return streamsAIJson({ ok: false, error: "amount must be a finite number" }, 400);
    }

    const ledgerEntry = await credits.create(scope, {
      amount: body.amount,
      source: body.source,
      reason: body.reason,
      relatedJobId: body.relatedJobId,
      relatedSessionId: body.relatedSessionId,
      metadata: body.metadata,
    });

    const balance = await credits.balance(scope);
    return streamsAIJson({ ok: true, balance, ledgerEntry }, 201);
  } catch (error) {
    return streamsAIError(error);
  }
}
