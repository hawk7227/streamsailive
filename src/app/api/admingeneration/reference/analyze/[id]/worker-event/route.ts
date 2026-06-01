import { NextResponse } from "next/server";
import {
  hasTrustedAnalyzerWorkerAuth,
  recordVideoAnalyzerWorkerEvent,
  videoAnalyzerIntelligenceMigrationHint,
} from "@/lib/admingeneration/video-analyzer-intelligence-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params) {
  if (!hasTrustedAnalyzerWorkerAuth(request)) {
    return NextResponse.json(
      {
        ok: false,
        route: "admingeneration-reference-worker-event",
        error: "Unauthorized analyzer worker event.",
      },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!id || !body) {
    return NextResponse.json({ ok: false, error: "analysis id and JSON body are required" }, { status: 400 });
  }

  const result = await recordVideoAnalyzerWorkerEvent(id, body);

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        route: "admingeneration-reference-worker-event",
        analysisId: id,
        error: result.error,
        requiredMigration: videoAnalyzerIntelligenceMigrationHint(),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    route: "admingeneration-reference-worker-event",
    analysisId: id,
    workerEvent: result.workerEvent,
  });
}
