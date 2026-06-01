import { NextResponse } from "next/server";
import { getEditorExecutionSummary } from "@/lib/admingeneration/video-editor-control-plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;
  const summary = await getEditorExecutionSummary(id);
  const { ok, ...payload } = summary;
  return NextResponse.json({
    ok: true,
    route: "admingeneration-editor-version-actions",
    editorProjectId: id,
    ...payload,
  });
}
