import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const DEFAULT_TRACKS = [
  ["video", "Video", 10],
  ["shot", "Shots", 20],
  ["scene", "Scenes", 30],
  ["audio", "Audio", 40],
  ["voice", "Voice", 50],
  ["music", "Music", 60],
  ["ambient", "Ambient", 70],
  ["captions", "Captions", 80],
  ["transcript", "Transcript", 90],
  ["effects", "Effects", 100],
  ["motion", "Motion", 110],
  ["versions", "Versions", 120],
] as const;

export async function createVideoEditorProjectFromAnalysis(input: { analysisId: string; projectId?: string | null }) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured." };

  const analysisResult = await supabase.schema("streams").from("reference_analyses").select("*").eq("id", input.analysisId).single();
  if (analysisResult.error || !analysisResult.data) return { ok: false as const, error: analysisResult.error?.message || "Reference analysis not found." };

  const analysis = analysisResult.data as any;
  const blueprint = analysis.blueprint || {};
  const title = String(blueprint?.summary?.title || analysis.summary || analysis.source_url || "Untitled video editor project");
  const projectId = input.projectId || analysis.project_id || null;

  const projectResult = await supabase.schema("streams").from("video_editor_projects").insert({
    project_id: projectId,
    source_analysis_id: input.analysisId,
    source_asset_id: analysis.source_asset_id || null,
    title,
    status: analysis.status === "completed" ? "ready" : "needs_worker",
    metadata: {
      source: "admingeneration-editor-from-analysis",
      sourceType: analysis.source_type,
      sourceUrl: analysis.source_url,
      analyzerStatus: analysis.status,
      needsWorker: analysis.status !== "completed",
      blueprintSummary: blueprint?.summary || null,
    },
  }).select("*").single();

  if (projectResult.error || !projectResult.data) return { ok: false as const, error: projectResult.error?.message || "Editor project insert failed." };

  const editorProject = projectResult.data as any;

  await supabase.schema("streams").from("video_editor_tracks").insert(
    DEFAULT_TRACKS.map(([track_type, label, sort_order]) => ({
      editor_project_id: editorProject.id,
      track_type,
      label,
      sort_order,
      metadata: { source: "default-editor-track" },
    })),
  );

  const shots = Array.isArray(blueprint.shots) ? blueprint.shots : [];
  if (shots.length) {
    await supabase.schema("streams").from("video_editor_segments").insert(
      shots.map((shot: any, index: number) => ({
        editor_project_id: editorProject.id,
        segment_type: "shot",
        segment_index: Number(shot.shotIndex || index + 1),
        start_sec: typeof shot.startSec === "number" ? shot.startSec : null,
        end_sec: typeof shot.endSec === "number" ? shot.endSec : null,
        label: shot.sceneDescription || `Shot ${index + 1}`,
        source_frame_asset_ids: Array.isArray(shot.frameAssetIds) ? shot.frameAssetIds : [],
        metadata: shot,
      })),
    );
  }

  const versionResult = await supabase.schema("streams").from("video_editor_versions").insert({
    editor_project_id: editorProject.id,
    source_asset_id: analysis.source_asset_id || null,
    status: "source",
    change_summary: "Immutable source version created from reference analysis.",
    metadata: { sourceAnalysisId: input.analysisId, sourceUrl: analysis.source_url, sourceType: analysis.source_type },
  }).select("*").single();

  if (versionResult.data?.id) {
    await supabase.schema("streams").from("video_editor_projects").update({ active_version_id: versionResult.data.id }).eq("id", editorProject.id);
    editorProject.active_version_id = versionResult.data.id;
  }

  return { ok: true as const, editorProject, activeVersion: versionResult.data || null };
}

export async function getVideoEditorProject(id: string) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured." };

  const projectResult = await supabase.schema("streams").from("video_editor_projects").select("*").eq("id", id).single();
  if (projectResult.error || !projectResult.data) return { ok: false as const, error: projectResult.error?.message || "Editor project not found." };

  const [tracks, segments, versions, editInstructions] = await Promise.all([
    supabase.schema("streams").from("video_editor_tracks").select("*").eq("editor_project_id", id).order("sort_order"),
    supabase.schema("streams").from("video_editor_segments").select("*").eq("editor_project_id", id).order("segment_index"),
    supabase.schema("streams").from("video_editor_versions").select("*").eq("editor_project_id", id).order("created_at", { ascending: false }),
    supabase.schema("streams").from("video_editor_edit_instructions").select("*").eq("editor_project_id", id).order("created_at", { ascending: false }),
  ]);

  return {
    ok: true as const,
    project: projectResult.data,
    tracks: tracks.data || [],
    segments: segments.data || [],
    versions: versions.data || [],
    editInstructions: editInstructions.data || [],
  };
}

export async function createBlockedEditInstruction(input: {
  editorProjectId: string;
  versionId?: string | null;
  targetType: string;
  targetId?: string | null;
  instruction: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured." };

  const result = await supabase.schema("streams").from("video_editor_edit_instructions").insert({
    editor_project_id: input.editorProjectId,
    version_id: input.versionId || null,
    target_type: input.targetType,
    target_id: input.targetId || null,
    instruction: input.instruction,
    status: "blocked_worker_required",
    metadata: {
      ...(input.metadata || {}),
      blockedReason: "Provider router and segment worker are not wired yet. Instruction is persisted but not executed.",
    },
  }).select("*").single();

  if (result.error || !result.data) return { ok: false as const, error: result.error?.message || "Edit instruction insert failed." };
  return { ok: true as const, editInstruction: result.data };
}
