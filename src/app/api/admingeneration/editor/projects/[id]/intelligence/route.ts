import { NextResponse } from "next/server";
import { getVideoEditorProject } from "@/lib/admingeneration/video-editor-repository";
import { getVideoAnalyzerIntelligence } from "@/lib/admingeneration/video-analyzer-intelligence-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ ok: false, error: "editor project id is required" }, { status: 400 });
  }

  const projectResult = await getVideoEditorProject(id);

  if (!projectResult.ok) {
    return NextResponse.json(
      { ok: false, route: "admingeneration-editor-intelligence", error: projectResult.error },
      { status: 404 },
    );
  }

  const sourceAnalysisId = String(projectResult.project?.source_analysis_id || "");

  if (!sourceAnalysisId) {
    return NextResponse.json({
      ok: true,
      route: "admingeneration-editor-intelligence",
      editorProjectId: id,
      editor: projectResult,
      analysisId: null,
      intelligence: null,
      status: "no_source_analysis",
    });
  }

  const intelligenceResult = await getVideoAnalyzerIntelligence(sourceAnalysisId);

  if (!intelligenceResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        route: "admingeneration-editor-intelligence",
        editorProjectId: id,
        analysisId: sourceAnalysisId,
        error: intelligenceResult.error,
      },
      { status: 500 },
    );
  }

  const { ok, ...intelligencePayload } = intelligenceResult;

  return NextResponse.json({
    ok: true,
    route: "admingeneration-editor-intelligence",
    editorProjectId: id,
    analysisId: sourceAnalysisId,
    editor: projectResult,
    ...intelligencePayload,
  });
}
