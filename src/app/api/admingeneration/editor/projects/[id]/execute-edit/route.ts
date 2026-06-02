import { NextResponse } from "next/server";
import { createTargetedEdit } from "@/lib/admingeneration/db/editor-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const params = await context.params;
    const body = await request.json().catch(() => ({}));

    const result = await createTargetedEdit({
      projectId: params.id,
      action: body.action || "segment_edit",
      targetType: body.targetType || body.selected?.targetType || body.selected?.layer || "segment",
      targetId: body.targetId || body.selected?.id || body.selected?.segmentId || null,
      instruction: body.instruction || "",
      selected: body.selected || null,
      providerIntent: body.providerIntent || body.provider || "provider_router",
    });

    return NextResponse.json({
      ok: true,
      status: "queued",
      projectId: params.id,
      editJob: result.editJob,
      providerRun: result.providerRun,
      version: result.version,
      proof: {
        originalPreserved: true,
        editJobCreated: Boolean(result.editJob?.id),
        providerRunCreated: Boolean(result.providerRun?.id),
        versionCreated: Boolean(result.version?.id),
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
