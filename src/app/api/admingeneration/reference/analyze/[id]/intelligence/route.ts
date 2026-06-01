import { NextResponse } from "next/server";
import {
  getVideoAnalyzerIntelligence,
  hasTrustedAnalyzerWorkerAuth,
  videoAnalyzerIntelligenceMigrationHint,
  writeVideoAnalyzerIntelligence,
} from "@/lib/admingeneration/video-analyzer-intelligence-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ ok: false, error: "analysis id is required" }, { status: 400 });
  }

  const result = await getVideoAnalyzerIntelligence(id);

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        route: "admingeneration-reference-intelligence",
        analysisId: id,
        error: result.error,
        requiredMigration: "requiredMigration" in result ? result.requiredMigration : videoAnalyzerIntelligenceMigrationHint(),
      },
      { status: 500 },
    );
  }

  const { ok, ...payload } = result;

  return NextResponse.json({
    ok: true,
    route: "admingeneration-reference-intelligence",
    analysisId: id,
    ...payload,
  });
}

export async function POST(request: Request, context: Params) {
  if (!hasTrustedAnalyzerWorkerAuth(request)) {
    return NextResponse.json(
      {
        ok: false,
        route: "admingeneration-reference-intelligence",
        error: "Unauthorized analyzer intelligence write.",
      },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!id || !body) {
    return NextResponse.json({ ok: false, error: "analysis id and JSON body are required" }, { status: 400 });
  }

  const result = await writeVideoAnalyzerIntelligence(id, body);

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        route: "admingeneration-reference-intelligence",
        analysisId: id,
        error: result.error,
        requiredMigration: "requiredMigration" in result ? result.requiredMigration : videoAnalyzerIntelligenceMigrationHint(),
      },
      { status: 500 },
    );
  }

  const { ok, ...payload } = result;

  return NextResponse.json({
    ok: true,
    route: "admingeneration-reference-intelligence",
    analysisId: id,
    ...payload,
  });
}
