import { NextRequest, NextResponse } from "next/server";
import { executeNode, executePipeline } from "../../../../lib/pipeline/pipeline-execution";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { mode?: "runStep" | "runPipeline"; step?: string; payload?: Record<string, unknown> };

    if (body.mode === "runPipeline") {
      const result = await executePipeline(body.payload as never);
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
