import { NextRequest, NextResponse } from "next/server";
import { executeInternalCapabilityEngine } from "@/lib/assistant-core/internalCapabilityExecutor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CapabilityEngineRequestBody = {
  request?: string;
  engineId?: string;
  intent?: string;
  context?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CapabilityEngineRequestBody;
    const request = typeof body.request === "string" ? body.request : "";
    const engineId = typeof body.engineId === "string" ? body.engineId : undefined;
    const intent = typeof body.intent === "string" ? body.intent : undefined;
    const context = body.context && typeof body.context === "object" ? body.context : undefined;

    const plan = executeInternalCapabilityEngine({ request, engineId, intent, context });

    return NextResponse.json({ ok: plan.ok, plan });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "capability engine failed",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Use POST with { request, engineId?, intent?, context? } to generate a practical Streams capability execution plan.",
    engines: [
      "creation-engine",
      "movie-engine",
      "song-audio-engine",
      "builder-engine",
      "repair-engine",
      "system-orchestration-engine",
      "industry-execution-engine",
    ],
  });
}
