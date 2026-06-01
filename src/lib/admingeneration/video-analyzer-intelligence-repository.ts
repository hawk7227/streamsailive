import { createClient } from "@supabase/supabase-js";
import { getReferenceAnalysis, updateReferenceAnalysis } from "./video-reference-repository";

type JsonRecord = Record<string, unknown>;

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function videoAnalyzerIntelligenceMigrationHint() {
  return "Run migration 20260601001000_create_streams_video_analyzer_intelligence_graph.sql";
}

export function hasTrustedAnalyzerWorkerAuth(request: Request) {
  const expected = [
    process.env.ADMIN_GENERATION_KEY,
    process.env.STREAMS_INTAKE_KEY,
    process.env.INTAKE_API_KEY,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (expected.length === 0) return false;

  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";

  const provided = [
    request.headers.get("x-admin-generation-key") || "",
    request.headers.get("x-streams-intake-key") || "",
    request.headers.get("x-intake-api-key") || "",
    bearer,
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  return provided.some((candidate) => expected.includes(candidate));
}

function rows(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as JsonRecord[]) : [];
}

async function deleteExistingIntelligence(analysisId: string) {
  const supabase = supabaseAdmin();
  if (!supabase) return;
  const tables = [
    "video_analysis_assets",
    "video_analysis_segments",
    "video_analysis_subjects",
    "video_analysis_speakers",
    "video_analysis_motion_profiles",
    "video_analysis_quality_reports",
    "video_analysis_media_graphs",
  ];

  await Promise.all(
    tables.map((table) =>
      supabase.schema("streams").from(table).delete().eq("analysis_id", analysisId),
    ),
  );
}

export async function getVideoAnalyzerIntelligence(analysisId: string) {
  const supabase = supabaseAdmin();
  if (!supabase) {
    return {
      ok: false as const,
      error: "Supabase admin is not configured.",
      requiredMigration: videoAnalyzerIntelligenceMigrationHint(),
    };
  }

  const reference = await getReferenceAnalysis(analysisId);
  if (!reference.record) {
    return {
      ok: false as const,
      error: reference.error || "Reference analysis not found.",
      requiredMigration: videoAnalyzerIntelligenceMigrationHint(),
    };
  }

  const [
    assets,
    segments,
    subjects,
    speakers,
    motionProfiles,
    qualityReports,
    mediaGraphs,
    workerEvents,
  ] = await Promise.all([
    supabase.schema("streams").from("video_analysis_assets").select("*").eq("analysis_id", analysisId).order("created_at"),
    supabase.schema("streams").from("video_analysis_segments").select("*").eq("analysis_id", analysisId).order("segment_index"),
    supabase.schema("streams").from("video_analysis_subjects").select("*").eq("analysis_id", analysisId).order("subject_index"),
    supabase.schema("streams").from("video_analysis_speakers").select("*").eq("analysis_id", analysisId).order("speaker_index"),
    supabase.schema("streams").from("video_analysis_motion_profiles").select("*").eq("analysis_id", analysisId).order("created_at"),
    supabase.schema("streams").from("video_analysis_quality_reports").select("*").eq("analysis_id", analysisId).order("created_at", { ascending: false }),
    supabase.schema("streams").from("video_analysis_media_graphs").select("*").eq("analysis_id", analysisId).order("created_at", { ascending: false }),
    supabase.schema("streams").from("video_analysis_worker_events").select("*").eq("analysis_id", analysisId).order("created_at", { ascending: false }).limit(50),
  ]);

  const anyError =
    assets.error ||
    segments.error ||
    subjects.error ||
    speakers.error ||
    motionProfiles.error ||
    qualityReports.error ||
    mediaGraphs.error ||
    workerEvents.error;

  if (anyError) {
    return {
      ok: false as const,
      error: anyError.message,
      requiredMigration: videoAnalyzerIntelligenceMigrationHint(),
    };
  }

  return {
    ok: true as const,
    analysis: reference.record,
    intelligence: {
      assets: assets.data || [],
      segments: segments.data || [],
      subjects: subjects.data || [],
      speakers: speakers.data || [],
      motionProfiles: motionProfiles.data || [],
      qualityReports: qualityReports.data || [],
      mediaGraphs: mediaGraphs.data || [],
      workerEvents: workerEvents.data || [],
    },
  };
}

export async function writeVideoAnalyzerIntelligence(
  analysisId: string,
  payload: JsonRecord,
) {
  const supabase = supabaseAdmin();
  if (!supabase) {
    return {
      ok: false as const,
      error: "Supabase admin is not configured.",
      requiredMigration: videoAnalyzerIntelligenceMigrationHint(),
    };
  }

  const reference = await getReferenceAnalysis(analysisId);
  if (!reference.record) {
    return {
      ok: false as const,
      error: reference.error || "Reference analysis not found.",
      requiredMigration: videoAnalyzerIntelligenceMigrationHint(),
    };
  }

  await deleteExistingIntelligence(analysisId);

  const assets = rows(payload.assets).map((asset) => ({
    analysis_id: analysisId,
    asset_kind: String(asset.assetKind || asset.kind || "reference"),
    asset_url: typeof asset.assetUrl === "string" ? asset.assetUrl : typeof asset.url === "string" ? asset.url : null,
    storage_bucket: typeof asset.storageBucket === "string" ? asset.storageBucket : null,
    storage_path: typeof asset.storagePath === "string" ? asset.storagePath : null,
    start_sec: typeof asset.startSec === "number" ? asset.startSec : null,
    end_sec: typeof asset.endSec === "number" ? asset.endSec : null,
    mime_type: typeof asset.mimeType === "string" ? asset.mimeType : null,
    metadata: (asset.metadata && typeof asset.metadata === "object" ? asset.metadata : asset) as JsonRecord,
  }));

  const segments = rows(payload.segments).map((segment, index) => ({
    analysis_id: analysisId,
    segment_type: String(segment.segmentType || segment.type || "shot"),
    segment_index: Number(segment.segmentIndex || segment.index || index + 1),
    start_sec: typeof segment.startSec === "number" ? segment.startSec : null,
    end_sec: typeof segment.endSec === "number" ? segment.endSec : null,
    label: typeof segment.label === "string" ? segment.label : null,
    transcript: typeof segment.transcript === "string" ? segment.transcript : null,
    frame_asset_ids: Array.isArray(segment.frameAssetIds) ? segment.frameAssetIds.map(String) : [],
    metadata: (segment.metadata && typeof segment.metadata === "object" ? segment.metadata : segment) as JsonRecord,
  }));

  const subjects = rows(payload.subjects).map((subject, index) => ({
    analysis_id: analysisId,
    subject_index: Number(subject.subjectIndex || subject.index || index + 1),
    subject_type: String(subject.subjectType || subject.type || "person"),
    display_name: typeof subject.displayName === "string" ? subject.displayName : null,
    face_asset_id: typeof subject.faceAssetId === "string" ? subject.faceAssetId : null,
    appearance_description:
      typeof subject.appearanceDescription === "string" ? subject.appearanceDescription : null,
    clothing_description:
      typeof subject.clothingDescription === "string" ? subject.clothingDescription : null,
    identity_profile:
      subject.identityProfile && typeof subject.identityProfile === "object"
        ? subject.identityProfile
        : {},
    metadata: (subject.metadata && typeof subject.metadata === "object" ? subject.metadata : subject) as JsonRecord,
  }));

  const speakers = rows(payload.speakers).map((speaker, index) => ({
    analysis_id: analysisId,
    speaker_index: Number(speaker.speakerIndex || speaker.index || index + 1),
    display_name: typeof speaker.displayName === "string" ? speaker.displayName : null,
    voice_asset_id: typeof speaker.voiceAssetId === "string" ? speaker.voiceAssetId : null,
    voice_profile:
      speaker.voiceProfile && typeof speaker.voiceProfile === "object" ? speaker.voiceProfile : {},
    speaking_segments: Array.isArray(speaker.speakingSegments) ? speaker.speakingSegments : [],
    metadata: (speaker.metadata && typeof speaker.metadata === "object" ? speaker.metadata : speaker) as JsonRecord,
  }));

  const motionProfiles = rows(payload.motionProfiles).map((profile) => ({
    analysis_id: analysisId,
    target_type: String(profile.targetType || "project"),
    target_id: typeof profile.targetId === "string" ? profile.targetId : null,
    motion_profile:
      profile.motionProfile && typeof profile.motionProfile === "object" ? profile.motionProfile : {},
    camera_motion_profile:
      profile.cameraMotionProfile && typeof profile.cameraMotionProfile === "object"
        ? profile.cameraMotionProfile
        : {},
    gesture_profile:
      profile.gestureProfile && typeof profile.gestureProfile === "object" ? profile.gestureProfile : {},
    expression_profile:
      profile.expressionProfile && typeof profile.expressionProfile === "object"
        ? profile.expressionProfile
        : {},
    metadata: (profile.metadata && typeof profile.metadata === "object" ? profile.metadata : profile) as JsonRecord,
  }));

  const qualityReports = rows(payload.qualityReports).map((report) => ({
    analysis_id: analysisId,
    status: String(report.status || "pending"),
    report: report.report && typeof report.report === "object" ? report.report : report,
    issues: Array.isArray(report.issues) ? report.issues : [],
    metadata: (report.metadata && typeof report.metadata === "object" ? report.metadata : {}) as JsonRecord,
  }));

  const mediaGraphs = rows(payload.mediaGraphs).map((graph) => ({
    analysis_id: analysisId,
    graph: graph.graph && typeof graph.graph === "object" ? graph.graph : graph,
    metadata: (graph.metadata && typeof graph.metadata === "object" ? graph.metadata : {}) as JsonRecord,
  }));

  const inserts = [
    assets.length ? supabase.schema("streams").from("video_analysis_assets").insert(assets) : null,
    segments.length ? supabase.schema("streams").from("video_analysis_segments").insert(segments) : null,
    subjects.length ? supabase.schema("streams").from("video_analysis_subjects").insert(subjects) : null,
    speakers.length ? supabase.schema("streams").from("video_analysis_speakers").insert(speakers) : null,
    motionProfiles.length ? supabase.schema("streams").from("video_analysis_motion_profiles").insert(motionProfiles) : null,
    qualityReports.length ? supabase.schema("streams").from("video_analysis_quality_reports").insert(qualityReports) : null,
    mediaGraphs.length ? supabase.schema("streams").from("video_analysis_media_graphs").insert(mediaGraphs) : null,
  ].filter(Boolean);

  const results = await Promise.all(inserts as PromiseLike<{ error: { message: string } | null }>[]);
  const insertError = results.find((result) => result.error)?.error;
  if (insertError) {
    return {
      ok: false as const,
      error: insertError.message,
      requiredMigration: videoAnalyzerIntelligenceMigrationHint(),
    };
  }

  const status = typeof payload.status === "string" ? payload.status : "analyzing";
  const summary = typeof payload.summary === "string" ? payload.summary : undefined;
  const blueprint = payload.blueprint && typeof payload.blueprint === "object" ? (payload.blueprint as never) : undefined;
  const transcript = typeof payload.transcript === "string" ? payload.transcript : undefined;

  await updateReferenceAnalysis(analysisId, {
    status: status as never,
    summary,
    transcript,
    blueprint,
    metadata: {
      ...(reference.record.metadata || {}),
      intelligenceGraph: {
        assets: assets.length,
        segments: segments.length,
        subjects: subjects.length,
        speakers: speakers.length,
        motionProfiles: motionProfiles.length,
        qualityReports: qualityReports.length,
        mediaGraphs: mediaGraphs.length,
        lastUpdatedAt: new Date().toISOString(),
      },
    },
  });

  return getVideoAnalyzerIntelligence(analysisId);
}

export async function recordVideoAnalyzerWorkerEvent(
  analysisId: string,
  payload: JsonRecord,
) {
  const supabase = supabaseAdmin();
  if (!supabase) {
    return { ok: false as const, error: "Supabase admin is not configured." };
  }

  const result = await supabase
    .schema("streams")
    .from("video_analysis_worker_events")
    .insert({
      analysis_id: analysisId,
      event_type: String(payload.eventType || payload.type || "worker_event"),
      status: typeof payload.status === "string" ? payload.status : null,
      message: typeof payload.message === "string" ? payload.message : null,
      payload,
    })
    .select("*")
    .single();

  if (result.error || !result.data) {
    return { ok: false as const, error: result.error?.message || "Worker event insert failed." };
  }

  if (typeof payload.analysisStatus === "string" || typeof payload.summary === "string") {
    const reference = await getReferenceAnalysis(analysisId);
    await updateReferenceAnalysis(analysisId, {
      status: (payload.analysisStatus as never) || reference.record?.status || "analyzing",
      summary: typeof payload.summary === "string" ? payload.summary : reference.record?.summary || undefined,
      metadata: {
        ...(reference.record?.metadata || {}),
        lastWorkerEvent: {
          eventType: result.data.event_type,
          status: result.data.status,
          message: result.data.message,
          createdAt: result.data.created_at,
        },
      },
    });
  }

  return { ok: true as const, workerEvent: result.data };
}
