import { getSupabaseServiceClient } from "@/lib/supabase/service";

type JsonObject = Record<string, unknown>;

function throwIf(error: unknown) {
  if (error) throw error;
}

function uuidOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function seedEditorProofProject(input: { title?: string; sourceUrl?: string } = {}) {
  const supabase = getSupabaseServiceClient();

  const { data: analysis, error: analysisError } = await supabase
    .from("admingeneration_analyses")
    .insert({
      source_type: "db_proof",
      source_url: input.sourceUrl || "db-proof://source-video.mp4",
      status: "analyzed",
      analyzer_profile: "editor_full",
      intelligence: {
        transcript: {
          words: [
            { word: "Proof", start: 0, end: 0.4, speaker: "speaker-1" },
            { word: "timeline", start: 0.4, end: 0.9, speaker: "speaker-1" },
            { word: "works", start: 0.9, end: 1.3, speaker: "speaker-1" }
          ]
        },
        motion_segments: [{ label: "Proof motion segment", startSec: 0, endSec: 3 }]
      },
      metadata: { proof: true }
    })
    .select("*")
    .single();

  throwIf(analysisError);

  const { data: project, error: projectError } = await supabase
    .from("admingeneration_editor_projects")
    .insert({
      analysis_id: analysis.id,
      title: input.title || "DB Proof Editor Project",
      status: "active",
      metadata: { proof: true }
    })
    .select("*")
    .single();

  throwIf(projectError);

  await supabase.from("admingeneration_analyses").update({ project_id: project.id }).eq("id", analysis.id);

  const { data: asset, error: assetError } = await supabase
    .from("admingeneration_assets")
    .insert({
      project_id: project.id,
      analysis_id: analysis.id,
      asset_kind: "source_video",
      asset_url: input.sourceUrl || "db-proof://source-video.mp4",
      mime_type: "video/mp4",
      duration_sec: 3,
      fps: 24,
      frame_count: 72,
      metadata: { proof: true }
    })
    .select("*")
    .single();

  throwIf(assetError);

  const { data: segment, error: segmentError } = await supabase
    .from("admingeneration_timeline_segments")
    .insert({
      project_id: project.id,
      analysis_id: analysis.id,
      segment_kind: "dialogue",
      label: "Proof timeline segment",
      start_sec: 0,
      end_sec: 3,
      frame_start: 0,
      frame_end: 72,
      source_asset_id: asset.id,
      metadata: { proof: true }
    })
    .select("*")
    .single();

  throwIf(segmentError);

  const { data: speaker, error: speakerError } = await supabase
    .from("admingeneration_speakers")
    .insert({
      project_id: project.id,
      label: "Speaker 1",
      metadata: { proof: true }
    })
    .select("*")
    .single();

  throwIf(speakerError);

  const { error: wordsError } = await supabase
    .from("admingeneration_transcript_words")
    .insert([
      { project_id: project.id, segment_id: segment.id, speaker_id: speaker.id, word: "Proof", start_sec: 0, end_sec: 0.4, frame_start: 0, frame_end: 10, metadata: { proof: true } },
      { project_id: project.id, segment_id: segment.id, speaker_id: speaker.id, word: "timeline", start_sec: 0.4, end_sec: 0.9, frame_start: 10, frame_end: 22, metadata: { proof: true } },
      { project_id: project.id, segment_id: segment.id, speaker_id: speaker.id, word: "works", start_sec: 0.9, end_sec: 1.3, frame_start: 22, frame_end: 32, metadata: { proof: true } }
    ]);

  throwIf(wordsError);

  const { data: version, error: versionError } = await supabase
    .from("admingeneration_versions")
    .insert({
      project_id: project.id,
      status: "source",
      change_summary: "Immutable source proof version",
      output_asset_id: asset.id,
      metadata: { proof: true }
    })
    .select("*")
    .single();

  throwIf(versionError);

  await supabase
    .from("admingeneration_editor_projects")
    .update({ source_version_id: version.id, active_version_id: version.id })
    .eq("id", project.id);

  return { analysis, project, asset, segment, speaker, version };
}

export async function getEditorProjectBundle(projectId: string) {
  const supabase = getSupabaseServiceClient();

  const [
    projectResult,
    assetsResult,
    segmentsResult,
    wordsResult,
    speakersResult,
    versionsResult,
    providerRunsResult,
    qcResult,
    exportsResult,
    stitchJobsResult,
    longVideoPlansResult,
    longVideoShotsResult,
  ] = await Promise.all([
    supabase.from("admingeneration_editor_projects").select("*").eq("id", projectId).single(),
    supabase.from("admingeneration_assets").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
    supabase.from("admingeneration_timeline_segments").select("*").eq("project_id", projectId).order("start_sec", { ascending: true }),
    supabase.from("admingeneration_transcript_words").select("*").eq("project_id", projectId).order("start_sec", { ascending: true }),
    supabase.from("admingeneration_speakers").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
    supabase.from("admingeneration_versions").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
    supabase.from("admingeneration_provider_runs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("admingeneration_qc_reports").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("admingeneration_exports").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("admingeneration_stitch_jobs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("admingeneration_long_video_plans").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("admingeneration_long_video_shots").select("*").eq("project_id", projectId).order("shot_index", { ascending: true }),
  ]);

  throwIf(projectResult.error);

  return {
    project: projectResult.data,
    assets: assetsResult.data || [],
    segments: segmentsResult.data || [],
    words: wordsResult.data || [],
    speakers: speakersResult.data || [],
    versions: versionsResult.data || [],
    providerRuns: providerRunsResult.data || [],
    qcReports: qcResult.data || [],
    exports: exportsResult.data || [],
    stitchJobs: stitchJobsResult.data || [],
    longVideoPlans: longVideoPlansResult.data || [],
    longVideoShots: longVideoShotsResult.data || [],
  };
}

export async function createEditorProjectFromAnalysis(input: { analysisId?: string; projectId?: string; title?: string }) {
  const supabase = getSupabaseServiceClient();

  if (input.projectId) {
    const existing = await supabase
      .from("admingeneration_editor_projects")
      .select("*")
      .eq("id", input.projectId)
      .maybeSingle();

    if (existing.data) return existing.data;
  }

  let analysisId = uuidOrNull(input.analysisId);

  if (!analysisId) {
    const inserted = await supabase
      .from("admingeneration_analyses")
      .insert({
        source_type: "manual",
        status: "created",
        analyzer_profile: "editor_full",
        intelligence: {},
        metadata: { createdBy: "from-analysis" },
      })
      .select("*")
      .single();

    throwIf(inserted.error);
    analysisId = inserted.data.id;
  }

  const created = await supabase
    .from("admingeneration_editor_projects")
    .insert({
      analysis_id: analysisId,
      title: input.title || "Editor Project",
      status: "active",
      metadata: { source: "from-analysis" },
    })
    .select("*")
    .single();

  throwIf(created.error);

  await supabase.from("admingeneration_analyses").update({ project_id: created.data.id }).eq("id", analysisId);

  return created.data;
}

export async function createTargetedEdit(input: {
  projectId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  instruction?: string;
  selected?: JsonObject | null;
  providerIntent?: string;
}) {
  const supabase = getSupabaseServiceClient();

  const { data: providerRun, error: providerRunError } = await supabase
    .from("admingeneration_provider_runs")
    .insert({
      project_id: input.projectId,
      provider: input.providerIntent || "provider_router",
      action: input.action,
      status: "queued",
      request: {
        instruction: input.instruction || null,
        targetType: input.targetType,
        targetId: input.targetId || null,
        selected: input.selected || null,
        preserveOriginal: true,
      },
      response: {},
    })
    .select("*")
    .single();

  throwIf(providerRunError);

  const { data: version, error: versionError } = await supabase
    .from("admingeneration_versions")
    .insert({
      project_id: input.projectId,
      status: "draft",
      change_summary: `${input.action}: ${input.instruction || "No instruction"}`,
      provider_run_id: providerRun.id,
      metadata: {
        targetType: input.targetType,
        targetId: input.targetId || null,
        selected: input.selected || null,
        preserveOriginal: true,
      },
    })
    .select("*")
    .single();

  throwIf(versionError);

  await supabase.from("admingeneration_provider_runs").update({ version_id: version.id }).eq("id", providerRun.id);

  const { data: editJob, error: editJobError } = await supabase
    .from("admingeneration_edit_jobs")
    .insert({
      project_id: input.projectId,
      target_type: input.targetType,
      target_id: input.targetId || null,
      action: input.action,
      instruction: input.instruction || null,
      status: "queued",
      provider_run_id: providerRun.id,
      version_id: version.id,
      metadata: {
        selected: input.selected || null,
        preserveOriginal: true,
      },
    })
    .select("*")
    .single();

  throwIf(editJobError);

  return { editJob, providerRun: { ...providerRun, version_id: version.id }, version };
}

export async function createTranscriptEdit(input: {
  projectId: string;
  segmentId?: string | null;
  speakerId?: string | null;
  originalText?: string;
  editedText: string;
  startSec?: number | null;
  endSec?: number | null;
  metadata?: JsonObject;
}) {
  const supabase = getSupabaseServiceClient();

  const start = Number(input.startSec || 0);
  const words = input.editedText.split(/\s+/).map((word) => word.trim()).filter(Boolean);

  if (words.length) {
    const duration = Math.max(0.25, (Number(input.endSec || start + words.length * 0.35) - start) / words.length);

    const { error: wordsError } = await supabase.from("admingeneration_transcript_words").insert(
      words.map((word, index) => ({
        project_id: input.projectId,
        segment_id: uuidOrNull(input.segmentId),
        speaker_id: uuidOrNull(input.speakerId),
        word,
        start_sec: start + index * duration,
        end_sec: start + (index + 1) * duration,
        frame_start: Math.round((start + index * duration) * 24),
        frame_end: Math.round((start + (index + 1) * duration) * 24),
        metadata: { source: "transcript_edit" },
      })),
    );

    throwIf(wordsError);
  }

  return createTargetedEdit({
    projectId: input.projectId,
    action: "transcript_edit",
    targetType: "transcript",
    targetId: input.segmentId || null,
    instruction: input.editedText,
    selected: {
      originalText: input.originalText || null,
      editedText: input.editedText,
      startSec: input.startSec || null,
      endSec: input.endSec || null,
      ...(input.metadata || {}),
    },
    providerIntent: "stt",
  });
}

export async function createQcBlockedReport(input: {
  projectId: string;
  versionId?: string | null;
  providerRunId?: string | null;
  reason?: string;
}) {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("admingeneration_qc_reports")
    .insert({
      project_id: input.projectId,
      version_id: uuidOrNull(input.versionId),
      provider_run_id: uuidOrNull(input.providerRunId),
      status: "blocked",
      checks: {
        activation: "blocked",
        reason: input.reason || "Provider output has not passed QA.",
      },
      metadata: { preservePreviousActiveVersion: true },
    })
    .select("*")
    .single();

  throwIf(error);
  return data;
}

export async function createExportJob(input: { projectId: string; exportType?: string; settings?: JsonObject }) {
  const supabase = getSupabaseServiceClient();

  const { data: stitchJob, error: stitchError } = await supabase
    .from("admingeneration_stitch_jobs")
    .insert({
      project_id: input.projectId,
      status: "queued",
      request: input.settings || {},
    })
    .select("*")
    .single();

  throwIf(stitchError);

  const { data: exportRow, error: exportError } = await supabase
    .from("admingeneration_exports")
    .insert({
      project_id: input.projectId,
      stitch_job_id: stitchJob.id,
      status: "queued",
      export_type: input.exportType || "mp4",
      metadata: {
        ...(input.settings || {}),
        requiresRealOutputAsset: true,
      },
    })
    .select("*")
    .single();

  throwIf(exportError);

  return { stitchJob, export: exportRow };
}

export async function createLongVideoPlanWithShots(input: {
  projectId: string;
  prompt: string;
  targetDurationSec?: number;
  maxShotDurationSec?: number;
  fps?: number;
  aspectRatio?: string;
  plan?: JsonObject;
}) {
  const supabase = getSupabaseServiceClient();

  const targetDuration = Number(input.targetDurationSec || 60);
  const maxShot = Number(input.maxShotDurationSec || 8);
  const shotCount = Math.ceil(targetDuration / maxShot);

  const { data: plan, error: planError } = await supabase
    .from("admingeneration_long_video_plans")
    .insert({
      project_id: input.projectId,
      prompt: input.prompt,
      target_duration_sec: targetDuration,
      max_shot_duration_sec: maxShot,
      fps: Number(input.fps || 24),
      aspect_ratio: input.aspectRatio || "16:9",
      identity_lock: true,
      stitch_required: true,
      qa_required: true,
      plan: input.plan || {},
      status: "planned",
    })
    .select("*")
    .single();

  throwIf(planError);

  const { data: shots, error: shotsError } = await supabase
    .from("admingeneration_long_video_shots")
    .insert(
      Array.from({ length: shotCount }, (_, index) => {
        const start = index * maxShot;
        const end = Math.min(targetDuration, start + maxShot);

        return {
          plan_id: plan.id,
          project_id: input.projectId,
          scene_id: `scene-${Math.floor(index / 3) + 1}`,
          shot_index: index + 1,
          prompt: `${input.prompt} Shot ${index + 1}. Preserve identity, style, lighting, camera continuity, and wardrobe.`,
          negative_prompt: "identity drift, lighting mismatch, camera jump, broken hands, flicker",
          provider_intent: "provider_router",
          status: "planned",
          start_sec: start,
          end_sec: end,
          metadata: { preserveIdentity: true },
        };
      }),
    )
    .select("*");

  throwIf(shotsError);

  return { plan, shots: shots || [] };
}


export async function persistTranscriptWordsFromAnalyzer(input: {
  projectId: string;
  words: Array<{
    word?: string;
    text?: string;
    start?: number;
    end?: number;
    startSec?: number;
    endSec?: number;
    speakerId?: string | null;
    speaker?: string | null;
  }>;
  segmentId?: string | null;
}) {
  const supabase = getSupabaseServiceClient();

  const cleanWords = input.words
    .map((item, index) => {
      const word = String(item.word || item.text || "").trim();
      const startSec = Number(item.startSec ?? item.start ?? index * 0.35);
      const endSec = Number(item.endSec ?? item.end ?? startSec + 0.35);

      return {
        project_id: input.projectId,
        segment_id: uuidOrNull(input.segmentId),
        speaker_id: uuidOrNull(item.speakerId),
        word,
        start_sec: startSec,
        end_sec: endSec,
        frame_start: Math.round(startSec * 24),
        frame_end: Math.round(endSec * 24),
        metadata: {
          source: "transcribe-source",
          speaker: item.speaker || null,
        },
      };
    })
    .filter((item) => item.word);

  if (!cleanWords.length) {
    return { insertedWords: 0 };
  }

  const { error } = await supabase
    .from("admingeneration_transcript_words")
    .insert(cleanWords);

  throwIf(error);

  return { insertedWords: cleanWords.length };
}

