import { NextResponse } from "next/server";
import { updateReferenceAnalysis } from "@/lib/admingeneration/video-reference-repository";
import type { VideoReferenceAnalysisStatus } from "@/lib/admingeneration/video-reference-blueprint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

function allowed(request: Request) {
  const expected = [
    process.env.ADMIN_GENERATION_KEY,
    process.env.STREAMS_INTAKE_KEY,
    process.env.INTAKE_API_KEY,
  ].filter(Boolean);

  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";

  const provided = [
    request.headers.get("x-admin-generation-key"),
    request.headers.get("x-streams-intake-key"),
    request.headers.get("x-intake-api-key"),
    bearer,
  ].filter(Boolean);

  return provided.some((value) => expected.includes(value || ""));
}

function normalizeStatus(value: unknown): VideoReferenceAnalysisStatus {
  const status = String(value || "completed");
  if (["queued", "needs_worker", "analyzing", "completed", "failed"].includes(status)) {
    return status as VideoReferenceAnalysisStatus;
  }
  return "completed";
}

export async function POST(request: Request, context: Params) {
  if (!allowed(request)) {
    return NextResponse.json(
      { ok: false, route: "admingeneration-reference-worker-complete", error: "Unauthorized worker request." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!id || !body) {
    return NextResponse.json({ ok: false, error: "analysis id and JSON body are required" }, { status: 400 });
  }

  const result = await updateReferenceAnalysis(id, {
    status: normalizeStatus(body.status),
    blueprint: (body.blueprint as never) || undefined,
    transcript: typeof body.transcript === "string" ? body.transcript : undefined,
    summary: typeof body.summary === "string" ? body.summary : undefined,
    error: typeof body.error === "string" ? body.error : undefined,
    metadata: typeof body.metadata === "object" && body.metadata ? (body.metadata as Record<string, unknown>) : undefined,
  });

  if (!result.record) {
    return NextResponse.json(
      { ok: false, route: "admingeneration-reference-worker-complete", analysisId: id, error: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    route: "admingeneration-reference-worker-complete",
    analysisId: id,
    analysis: result.record,
  });
}
