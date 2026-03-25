import { NextRequest, NextResponse } from "next/server";
import { executeNode, executePipeline } from "../../../../lib/pipeline/pipeline-execution";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      mode?: "runStep" | "runPipeline";
      step?: string;
      type?: string;
      data?: Record<string, unknown>;
      context?: Record<string, unknown>;
      payload?: Record<string, unknown>;
    };

    if (body.mode === "runPipeline") {
      const result = await executePipeline(body.payload as never);
      return NextResponse.json({ ok: true, result });
    }

    // Support both legacy { step } and current { type, data, context } shapes
    const nodeType = body.type ?? body.step;
    if (!nodeType) {
      return NextResponse.json({ ok: false, error: "type (or step) is required" }, { status: 400 });
    }

    // executeNode expects node = { type, data } and context as second arg
    const node = { type: nodeType, data: body.data ?? body.payload ?? {} };
    const context = body.context ?? {};

    const result = await executeNode(node as never, context);
    // executeNode already returns { success, output, generationId } — pass through directly
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
