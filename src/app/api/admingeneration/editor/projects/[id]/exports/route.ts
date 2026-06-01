import { NextResponse } from "next/server";
import { createExportRequest, listExports } from "@/lib/admingeneration/video-editor-control-plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;
  const result = await listExports(id);
  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-editor-exports", error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, route: "admingeneration-editor-exports", editorProjectId: id, exports: result.exports });
}

export async function POST(request: Request, context: Params) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await createExportRequest({
    editorProjectId: id,
    stitchJobId: typeof body.stitchJobId === "string" ? body.stitchJobId : null,
    versionId: typeof body.versionId === "string" ? body.versionId : null,
    exportType: typeof body.exportType === "string" ? body.exportType : "mp4",
    settings: typeof body.settings === "object" && body.settings ? (body.settings as Record<string, unknown>) : {},
  });
  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-editor-exports", error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, route: "admingeneration-editor-exports", exportRequest: result.exportRequest });
}
