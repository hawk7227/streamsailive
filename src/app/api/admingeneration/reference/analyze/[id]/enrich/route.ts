import { NextResponse } from "next/server";
import {
  getVideoAnalyzerIntelligence,
  hasTrustedAnalyzerWorkerAuth,
  recordVideoAnalyzerWorkerEvent,
} from "@/lib/admingeneration/video-analyzer-intelligence-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: "analysis id is required" }, { status: 400 });

  const result = await getVideoAnalyzerIntelligence(id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, route: "admingeneration-reference-enrich", analysisId: id, error: result.error },
      { status: 500 },
    );
  }

  const assets = result.intelligence.assets || [];
  const segments = result.intelligence.segments || [];
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_IMAGES);
  const frameAssets = assets.filter((asset: any) => String(asset.asset_kind || "").includes("frame")).length;
  const audioAssets = assets.filter((asset: any) => String(asset.asset_kind || "").includes("audio")).length;

  return NextResponse.json({
    ok: true,
    route: "admingeneration-reference-enrich",
    analysisId: id,
    ready: assets.length > 0 && segments.length > 0 && hasOpenAI,
    requirements: {
      openaiKey: hasOpenAI,
      assets: assets.length,
      frameAssets,
      audioAssets,
      segments: segments.length,
      command: `python scripts/enrich-analyzer-intelligence-worker.py ${id}`,
    },
  });
}

export async function POST(request: Request, context: Params) {
  if (!hasTrustedAnalyzerWorkerAuth(request)) {
    return NextResponse.json(
      { ok: false, route: "admingeneration-reference-enrich", error: "Unauthorized enrichment request." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: "analysis id is required" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const event = await recordVideoAnalyzerWorkerEvent(id, {
    eventType: "enrichment_requested",
    status: "queued",
    message: "Analyzer intelligence enrichment was requested.",
    requestedBy: "admingeneration-reference-enrich-route",
    options: body,
    analysisStatus: "analyzing",
  });

  if (!event.ok) {
    return NextResponse.json(
      { ok: false, route: "admingeneration-reference-enrich", analysisId: id, error: event.error },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    route: "admingeneration-reference-enrich",
    analysisId: id,
    status: "queued",
    command: `python scripts/enrich-analyzer-intelligence-worker.py ${id}`,
    workerEvent: event.workerEvent,
  });
}
