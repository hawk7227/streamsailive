import { NextResponse } from "next/server";
import { getVideoEditorProject } from "@/lib/admingeneration/video-editor-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: "editor project id is required" }, { status: 400 });

  const result = await getVideoEditorProject(id);
  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-editor-project-status", error: result.error }, { status: 404 });

  const { ok, ...payload } = result;
  return NextResponse.json({ ok: true, route: "admingeneration-editor-project-status", ...payload });
}
