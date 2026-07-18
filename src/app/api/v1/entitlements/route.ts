import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIEntitlementsRepository } from "@/lib/streams-ai/repositories/entitlements-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const entitlements = new StreamsAIEntitlementsRepository();

function failure(error: unknown) {
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown entitlements error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const productId = request.nextUrl.searchParams.get("productId");
    if (productId) {
      return NextResponse.json({ ok: true, apiVersion: "v1", entitlement: await entitlements.check(scope, productId) });
    }
    return NextResponse.json({ ok: true, apiVersion: "v1", entitlements: await entitlements.list(scope) });
  } catch (error) {
    return failure(error);
  }
}
