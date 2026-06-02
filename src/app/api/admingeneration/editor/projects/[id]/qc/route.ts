import { NextResponse } from "next/server";
import {
  createQcBlockedReport,
  getEditorProjectBundle,
} from "@/lib/admingeneration/db/editor-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const params = await context.params;
    const bundle = await getEditorProjectBundle(params.id);

    const latestReport = bundle.qcReports[0] || null;
    const hasPassingReport = bundle.qcReports.some(
      (report: any) => report.status === "pass",
    );

    return NextResponse.json({
      ok: true,
      status: "loaded",
      projectId: params.id,
      qcReports: bundle.qcReports,
      gate: {
        okToActivate: hasPassingReport,
        status: hasPassingReport ? "pass" : "blocked",
        latestReport,
        reason: hasPassingReport
          ? "A passing QC report exists."
          : "Activation requires a passing QC report attached to a real provider output.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const params = await context.params;
    const body = await request.json().catch(() => ({}));

    const report = await createQcBlockedReport({
      projectId: params.id,
      versionId: body.versionId || null,
      providerRunId: body.providerRunId || null,
      reason:
        body.reason ||
        "Activation blocked until real provider output passes QC.",
    });

    return NextResponse.json({
      ok: true,
      status: "blocked",
      projectId: params.id,
      report,
      gate: {
        okToActivate: false,
        status: "blocked",
        reason:
          report.checks?.reason ||
          body.reason ||
          "QC blocked activation.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
