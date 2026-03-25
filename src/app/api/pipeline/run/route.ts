/**
 * /api/pipeline/run — Production pipeline route.
 *
 * Separate from /api/pipeline/run-node (the spec route).
 * Calls runPipelineProduction which wires real Kling I2V
 * and real Satori+Sharp compositor instead of spec stubs.
 */

import { NextRequest, NextResponse } from "next/server";
import { runPipelineProduction, executeNode } from "../../../../lib/pipeline/pipeline-orchestrator";
import type { IntakeBrief } from "../../../../lib/media-realism/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      mode?: "runPipeline" | "runStep";
      step?: string;
      payload?: Record<string, unknown>;
    };

    if (body.mode === "runPipeline") {
      const result = await runPipelineProduction(body.payload as unknown as IntakeBrief);
      return NextResponse.json({ ok: true, result });
    }

    if (!body.step) {
      return NextResponse.json({ ok: false, error: "step is required" }, { status: 400 });
    }

    const result = await executeNode(body.step as never, body.payload ?? {});
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
