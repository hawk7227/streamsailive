import { createClient } from "@supabase/supabase-js";
import { getVideoEditorProject } from "./video-editor-repository";

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function controlPlaneMigrationHint() {
  return "Run migration 20260601003000_create_streams_video_editor_execution_control_plane.sql";
}

async function requireProject(editorProjectId: string) {
  const project = await getVideoEditorProject(editorProjectId);
  if (!project.ok) return { ok: false as const, error: project.error };
  return { ok: true as const, project };
}

export async function createProviderRun(input: {
  editorProjectId: string;
  versionId?: string | null;
  editInstructionId?: string | null;
  provider: string;
  action: string;
  targetType?: string;
  targetId?: string | null;
  request?: Record<string, unknown>;
}) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured.", requiredMigration: controlPlaneMigrationHint() };
  const project = await requireProject(input.editorProjectId);
  if (!project.ok) return project;

  const result = await supabase.schema("streams").from("video_editor_provider_runs").insert({
    editor_project_id: input.editorProjectId,
    version_id: input.versionId || null,
    edit_instruction_id: input.editInstructionId || null,
    provider: input.provider,
    action: input.action,
    target_type: input.targetType || "project",
    target_id: input.targetId || null,
    status: "blocked_provider_not_wired",
    request: input.request || {},
    error: "Provider router execution is not wired yet. Request persisted for later execution.",
  }).select("*").single();

  if (result.error || !result.data) return { ok: false as const, error: result.error?.message || "Provider run insert failed.", requiredMigration: controlPlaneMigrationHint() };
  return { ok: true as const, providerRun: result.data };
}

export async function listProviderRuns(editorProjectId: string) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured.", requiredMigration: controlPlaneMigrationHint() };

  const result = await supabase.schema("streams").from("video_editor_provider_runs").select("*").eq("editor_project_id", editorProjectId).order("created_at", { ascending: false });
  if (result.error) return { ok: false as const, error: result.error.message, requiredMigration: controlPlaneMigrationHint() };
  return { ok: true as const, providerRuns: result.data || [] };
}

export async function createTranscriptEdit(input: {
  editorProjectId: string;
  versionId?: string | null;
  segmentId?: string | null;
  startSec?: number | null;
  endSec?: number | null;
  originalText?: string | null;
  editedText: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured.", requiredMigration: controlPlaneMigrationHint() };
  const project = await requireProject(input.editorProjectId);
  if (!project.ok) return project;

  const result = await supabase.schema("streams").from("video_editor_transcript_edits").insert({
    editor_project_id: input.editorProjectId,
    version_id: input.versionId || null,
    segment_id: input.segmentId || null,
    start_sec: input.startSec ?? null,
    end_sec: input.endSec ?? null,
    original_text: input.originalText || null,
    edited_text: input.editedText,
    status: "blocked_voice_lipsync_worker_required",
    metadata: {
      ...(input.metadata || {}),
      blockedReason: "Transcript edit persisted. Voice generation/lip-sync replacement worker is not wired yet.",
    },
  }).select("*").single();

  if (result.error || !result.data) return { ok: false as const, error: result.error?.message || "Transcript edit insert failed.", requiredMigration: controlPlaneMigrationHint() };
  return { ok: true as const, transcriptEdit: result.data };
}

export async function listTranscriptEdits(editorProjectId: string) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured.", requiredMigration: controlPlaneMigrationHint() };
  const result = await supabase.schema("streams").from("video_editor_transcript_edits").select("*").eq("editor_project_id", editorProjectId).order("created_at", { ascending: false });
  if (result.error) return { ok: false as const, error: result.error.message, requiredMigration: controlPlaneMigrationHint() };
  return { ok: true as const, transcriptEdits: result.data || [] };
}

export async function createQcReport(input: {
  editorProjectId: string;
  versionId?: string | null;
  providerRunId?: string | null;
  status?: string;
  passed?: boolean | null;
  checks?: Record<string, unknown>;
  issues?: unknown[];
  metadata?: Record<string, unknown>;
}) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured.", requiredMigration: controlPlaneMigrationHint() };
  const project = await requireProject(input.editorProjectId);
  if (!project.ok) return project;

  const result = await supabase.schema("streams").from("video_editor_qc_reports").insert({
    editor_project_id: input.editorProjectId,
    version_id: input.versionId || null,
    provider_run_id: input.providerRunId || null,
    status: input.status || "pending_model_qc",
    checks: input.checks || {},
    issues: Array.isArray(input.issues) ? input.issues : [],
    passed: input.passed ?? null,
    metadata: input.metadata || {},
  }).select("*").single();

  if (result.error || !result.data) return { ok: false as const, error: result.error?.message || "QC report insert failed.", requiredMigration: controlPlaneMigrationHint() };
  return { ok: true as const, qcReport: result.data };
}

export async function listQcReports(editorProjectId: string) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured.", requiredMigration: controlPlaneMigrationHint() };
  const result = await supabase.schema("streams").from("video_editor_qc_reports").select("*").eq("editor_project_id", editorProjectId).order("created_at", { ascending: false });
  if (result.error) return { ok: false as const, error: result.error.message, requiredMigration: controlPlaneMigrationHint() };
  return { ok: true as const, qcReports: result.data || [] };
}

export async function createStitchJob(input: {
  editorProjectId: string;
  activeVersionId?: string | null;
  timelineSnapshot?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured.", requiredMigration: controlPlaneMigrationHint() };
  const project = await requireProject(input.editorProjectId);
  if (!project.ok) return project;

  const result = await supabase.schema("streams").from("video_editor_stitch_jobs").insert({
    editor_project_id: input.editorProjectId,
    active_version_id: input.activeVersionId || project.project.project.active_version_id || null,
    status: "blocked_ffmpeg_worker_required",
    timeline_snapshot: input.timelineSnapshot || {},
    metadata: {
      ...(input.metadata || {}),
      blockedReason: "Final stitch/export worker is not wired yet.",
    },
  }).select("*").single();

  if (result.error || !result.data) return { ok: false as const, error: result.error?.message || "Stitch job insert failed.", requiredMigration: controlPlaneMigrationHint() };
  return { ok: true as const, stitchJob: result.data };
}

export async function listStitchJobs(editorProjectId: string) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured.", requiredMigration: controlPlaneMigrationHint() };
  const result = await supabase.schema("streams").from("video_editor_stitch_jobs").select("*").eq("editor_project_id", editorProjectId).order("created_at", { ascending: false });
  if (result.error) return { ok: false as const, error: result.error.message, requiredMigration: controlPlaneMigrationHint() };
  return { ok: true as const, stitchJobs: result.data || [] };
}

export async function createExportRequest(input: {
  editorProjectId: string;
  stitchJobId?: string | null;
  versionId?: string | null;
  exportType?: string;
  settings?: Record<string, unknown>;
}) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured.", requiredMigration: controlPlaneMigrationHint() };
  const project = await requireProject(input.editorProjectId);
  if (!project.ok) return project;

  const result = await supabase.schema("streams").from("video_editor_exports").insert({
    editor_project_id: input.editorProjectId,
    stitch_job_id: input.stitchJobId || null,
    version_id: input.versionId || null,
    export_type: input.exportType || "mp4",
    status: "blocked_render_worker_required",
    settings: input.settings || {},
    error: "Render/export worker is not wired yet. Export request persisted.",
  }).select("*").single();

  if (result.error || !result.data) return { ok: false as const, error: result.error?.message || "Export insert failed.", requiredMigration: controlPlaneMigrationHint() };
  return { ok: true as const, exportRequest: result.data };
}

export async function listExports(editorProjectId: string) {
  const supabase = supabaseAdmin();
  if (!supabase) return { ok: false as const, error: "Supabase admin is not configured.", requiredMigration: controlPlaneMigrationHint() };
  const result = await supabase.schema("streams").from("video_editor_exports").select("*").eq("editor_project_id", editorProjectId).order("created_at", { ascending: false });
  if (result.error) return { ok: false as const, error: result.error.message, requiredMigration: controlPlaneMigrationHint() };
  return { ok: true as const, exports: result.data || [] };
}

export async function getEditorExecutionSummary(editorProjectId: string) {
  const [providerRuns, transcriptEdits, qcReports, stitchJobs, exports] = await Promise.all([
    listProviderRuns(editorProjectId),
    listTranscriptEdits(editorProjectId),
    listQcReports(editorProjectId),
    listStitchJobs(editorProjectId),
    listExports(editorProjectId),
  ]);

  return {
    ok: true as const,
    providerRuns: providerRuns.ok ? providerRuns.providerRuns : [],
    transcriptEdits: transcriptEdits.ok ? transcriptEdits.transcriptEdits : [],
    qcReports: qcReports.ok ? qcReports.qcReports : [],
    stitchJobs: stitchJobs.ok ? stitchJobs.stitchJobs : [],
    exports: exports.ok ? exports.exports : [],
    errors: [providerRuns, transcriptEdits, qcReports, stitchJobs, exports]
      .filter((result: any) => !result.ok)
      .map((result: any) => result.error),
  };
}
