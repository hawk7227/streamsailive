import { NextResponse } from "next/server";
import { createQcReport, listQcReports } from "@/lib/admingeneration/video-editor-control-plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;
  const result = await listQcReports(id);
  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-editor-qc", error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, route: "admingeneration-editor-qc", editorProjectId: id, qcReports: result.qcReports });
}

export async function POST(request: Request, context: Params) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await createQcReport({
    editorProjectId: id,
    versionId: typeof body.versionId === "string" ? body.versionId : null,
    providerRunId: typeof body.providerRunId === "string" ? body.providerRunId : null,
    status: typeof body.status === "string" ? body.status : "pending_model_qc",
    passed: typeof body.passed === "boolean" ? body.passed : null,
    checks: typeof body.checks === "object" && body.checks ? (body.checks as Record<string, unknown>) : {},
    issues: Array.isArray(body.issues) ? body.issues : [],
    metadata: { source: "admingeneration-editor-qc", request: body },
  });
  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-editor-qc", error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, route: "admingeneration-editor-qc", qcReport: result.qcReport });
}
