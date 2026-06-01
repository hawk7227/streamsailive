import { NextResponse } from "next/server";
import { createVideoEditorProjectFromAnalysis } from "@/lib/admingeneration/video-editor-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const analysisId = typeof body?.analysisId === "string" ? body.analysisId : "";
  const projectId = typeof body?.projectId === "string" ? body.projectId : null;

  if (!analysisId) return NextResponse.json({ ok: false, error: "analysisId is required" }, { status: 400 });

  const result = await createVideoEditorProjectFromAnalysis({ analysisId, projectId });
  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-editor-from-analysis", error: result.error }, { status: 500 });

  return NextResponse.json({ ok: true, route: "admingeneration-editor-from-analysis", editorProject: result.editorProject, activeVersion: result.activeVersion, status: result.editorProject.status });
}
