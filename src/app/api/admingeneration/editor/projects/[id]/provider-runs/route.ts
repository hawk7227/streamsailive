import { NextResponse } from "next/server";
import { createProviderRun, listProviderRuns } from "@/lib/admingeneration/video-editor-control-plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;
  const result = await listProviderRuns(id);
  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-editor-provider-runs", error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, route: "admingeneration-editor-provider-runs", editorProjectId: id, providerRuns: result.providerRuns });
}

export async function POST(request: Request, context: Params) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const provider = typeof body.provider === "string" ? body.provider : "provider_router";
  const action = typeof body.action === "string" ? body.action : "segment_edit";
  const result = await createProviderRun({
    editorProjectId: id,
    provider,
    action,
    targetType: typeof body.targetType === "string" ? body.targetType : "project",
    targetId: typeof body.targetId === "string" ? body.targetId : null,
    versionId: typeof body.versionId === "string" ? body.versionId : null,
    editInstructionId: typeof body.editInstructionId === "string" ? body.editInstructionId : null,
    request: body,
  });
  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-editor-provider-runs", error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, route: "admingeneration-editor-provider-runs", providerRun: result.providerRun });
}
