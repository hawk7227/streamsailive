import { NextResponse } from "next/server";
import { getVideoEditorProject } from "@/lib/admingeneration/video-editor-repository";
import { getVideoAnalyzerIntelligence } from "@/lib/admingeneration/video-analyzer-intelligence-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function buildTimeline(editor: any, intelligence: any) {
  const tracks = Array.isArray(editor.tracks) ? editor.tracks : [];
  const editorSegments = Array.isArray(editor.segments) ? editor.segments : [];
  const intelligenceSegments = Array.isArray(intelligence?.segments) ? intelligence.segments : [];
  const assets = Array.isArray(intelligence?.assets) ? intelligence.assets : [];

  const lanes = tracks.map((track: any) => {
    const trackType = track.track_type || track.trackType;
    let items: any[] = [];

    if (trackType === "video" || trackType === "shot" || trackType === "scene") {
      items = [
        ...editorSegments.filter((segment: any) => !trackType || segment.segment_type === trackType || trackType === "video"),
        ...intelligenceSegments.filter((segment: any) => !trackType || segment.segment_type === trackType || trackType === "video"),
      ];
    }

    if (trackType === "audio" || trackType === "voice" || trackType === "music" || trackType === "ambient") {
      items = assets.filter((asset: any) => {
        const kind = String(asset.asset_kind || "");
        return kind === trackType || (trackType === "audio" && kind.includes("audio"));
      });
    }

    if (trackType === "versions") {
      items = Array.isArray(editor.versions) ? editor.versions : [];
    }

    return {
      id: track.id,
      type: trackType,
      label: track.label,
      sortOrder: track.sort_order,
      items,
    };
  });

  return {
    lanes,
    counts: {
      tracks: tracks.length,
      editorSegments: editorSegments.length,
      intelligenceSegments: intelligenceSegments.length,
      assets: assets.length,
      versions: Array.isArray(editor.versions) ? editor.versions.length : 0,
      editInstructions: Array.isArray(editor.editInstructions) ? editor.editInstructions.length : 0,
    },
  };
}

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ ok: false, error: "editor project id is required" }, { status: 400 });
  }

  const projectResult = await getVideoEditorProject(id);

  if (!projectResult.ok) {
    return NextResponse.json(
      { ok: false, route: "admingeneration-editor-timeline", error: projectResult.error },
      { status: 404 },
    );
  }

  const sourceAnalysisId = String(projectResult.project?.source_analysis_id || "");
  let intelligence = null;
  let intelligenceStatus = "not_loaded";

  if (sourceAnalysisId) {
    const intelligenceResult = await getVideoAnalyzerIntelligence(sourceAnalysisId);
    if (intelligenceResult.ok) {
      intelligence = intelligenceResult.intelligence;
      intelligenceStatus = "loaded";
    } else {
      intelligenceStatus = intelligenceResult.error || "failed";
    }
  }

  return NextResponse.json({
    ok: true,
    route: "admingeneration-editor-timeline",
    editorProjectId: id,
    analysisId: sourceAnalysisId || null,
    project: projectResult.project,
    timeline: buildTimeline(projectResult, intelligence),
    editor: projectResult,
    intelligenceStatus,
    intelligence,
  });
}
