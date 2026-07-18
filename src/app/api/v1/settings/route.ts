import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAISettingsRepository } from "@/lib/streams-ai/repositories/settings-repository";
import type { StreamsSettingsCategory } from "@/lib/streams-ai/settings-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const settings = new StreamsAISettingsRepository();

function failure(error: unknown) {
  return NextResponse.json({
    ok: false,
    apiVersion: "v1",
    error: error instanceof Error ? error.message : "Unknown settings error",
  }, { status: 400 });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const category = request.nextUrl.searchParams.get("category") as StreamsSettingsCategory | null;
    return NextResponse.json({ apiVersion: "v1", ...(await settings.list(scope, category)) });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({})) as { category?: string; key?: string; value?: unknown };
    if (!body.category || !body.key) {
      return NextResponse.json({ ok: false, apiVersion: "v1", error: "category and key are required" }, { status: 400 });
    }
    return NextResponse.json({ apiVersion: "v1", ...(await settings.update(scope, body)) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  return PATCH(request);
}
