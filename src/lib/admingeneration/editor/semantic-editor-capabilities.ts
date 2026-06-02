export type SemanticEditorCapabilityStatus =
  | "wired"
  | "blocked_provider_required"
  | "blocked_worker_required"
  | "blocked_output_required"
  | "missing";

export type SemanticEditorCapability = {
  id: string;
  label: string;
  category:
    | "ingest"
    | "timeline"
    | "transcript"
    | "voice"
    | "motion"
    | "identity"
    | "object"
    | "audio"
    | "qa"
    | "versioning"
    | "export"
    | "full_regeneration";
  frontendRequired: boolean;
  backendRoute?: string;
  provider?: "ffmpeg" | "fal" | "runway" | "kling" | "veo" | "elevenlabs" | "stt" | "internal";
  status: SemanticEditorCapabilityStatus;
  noFakeRule: string;
};

export const SEMANTIC_EDITOR_CAPABILITIES: SemanticEditorCapability[] = [
  {
    id: "analyze_video_once",
    label: "Analyze video once",
    category: "ingest",
    frontendRequired: true,
    backendRoute: "/api/admingeneration/reference/analyze",
    provider: "internal",
    status: "wired",
    noFakeRule: "Must load saved analysis intelligence. Do not simulate analysis.",
  },
  {
    id: "upload_and_analyze",
    label: "Upload and analyze video",
    category: "ingest",
    frontendRequired: true,
    backendRoute: "/api/admingeneration/reference/upload-and-analyze",
    provider: "ffmpeg",
    status: "wired",
    noFakeRule: "Must create persisted analysis or return blocked/error.",
  },
  {
    id: "load_intelligence",
    label: "Load stored intelligence",
    category: "ingest",
    frontendRequired: true,
    backendRoute: "/api/admingeneration/reference/analyze/[id]/intelligence",
    provider: "internal",
    status: "wired",
    noFakeRule: "Must return real stored frames/audio/timeline/intelligence.",
  },
  {
    id: "create_editor_project",
    label: "Create editor project from analysis",
    category: "versioning",
    frontendRequired: true,
    backendRoute: "/api/admingeneration/editor/from-analysis",
    provider: "internal",
    status: "wired",
    noFakeRule: "Must create or load a real editor project.",
  },
  {
    id: "timeline_sync",
    label: "Master timeline sync",
    category: "timeline",
    frontendRequired: true,
    backendRoute: "/api/admingeneration/editor/projects/[id]/timeline",
    provider: "internal",
    status: "wired",
    noFakeRule: "Timeline must come from real editor/intelligence data.",
  },
  {
    id: "inline_transcript_edit",
    label: "Inline transcript edit",
    category: "transcript",
    frontendRequired: true,
    backendRoute: "/api/admingeneration/editor/projects/[id]/transcript-edits",
    provider: "stt",
    status: "wired",
    noFakeRule: "Must persist transcript edit. Voice/lip-sync may be blocked until providers configured.",
  },
  {
    id: "word_timestamps",
    label: "Word timestamp editing",
    category: "transcript",
    frontendRequired: true,
    backendRoute: "/api/pipeline-test/transcript/transcribe",
    provider: "stt",
    status: "blocked_provider_required",
    noFakeRule: "Show words only from real transcript/word timestamp data or mark unavailable.",
  },
  {
    id: "voice_replacement",
    label: "Voice replacement",
    category: "voice",
    frontendRequired: true,
    backendRoute: "/api/streams/video/edit-voice",
    provider: "elevenlabs",
    status: "blocked_provider_required",
    noFakeRule: "Must call ElevenLabs/voice provider or save blocked provider request.",
  },
  {
    id: "lip_sync",
    label: "Lip sync",
    category: "voice",
    frontendRequired: true,
    backendRoute: "/api/admingeneration/editor/projects/[id]/execute-edit",
    provider: "runway",
    status: "blocked_provider_required",
    noFakeRule: "Must not claim mouth sync unless provider output exists.",
  },
  {
    id: "motion_edit",
    label: "Motion/body/gesture edit",
    category: "motion",
    frontendRequired: true,
    backendRoute: "/api/streams/video/edit-motion",
    provider: "runway",
    status: "blocked_provider_required",
    noFakeRule: "Must preserve selected target and return new version/output or blocked state.",
  },
  {
    id: "emotion_body_edit",
    label: "Emotion/body edit",
    category: "motion",
    frontendRequired: true,
    backendRoute: "/api/streams/video/edit-emotion",
    provider: "runway",
    status: "blocked_provider_required",
    noFakeRule: "Must not fake facial/body edits.",
  },
  {
    id: "identity_lock",
    label: "Person identity lock",
    category: "identity",
    frontendRequired: true,
    backendRoute: "/api/admingeneration/editor/projects/[id]/execute-edit",
    provider: "fal",
    status: "blocked_provider_required",
    noFakeRule: "Must use real face/person reference data or block.",
  },
  {
    id: "object_background_cleanup",
    label: "Object/background cleanup",
    category: "object",
    frontendRequired: true,
    backendRoute: "/api/admingeneration/editor/projects/[id]/execute-edit",
    provider: "runway",
    status: "blocked_provider_required",
    noFakeRule: "Must use real mask/video edit output or block.",
  },
  {
    id: "audio_separation",
    label: "Separate voice/music/ambient",
    category: "audio",
    frontendRequired: true,
    backendRoute: "/api/pipeline-test/audio/separate",
    provider: "ffmpeg",
    status: "wired",
    noFakeRule: "Must return real separated audio assets or blocked worker state.",
  },
  {
    id: "targeted_segment_regeneration",
    label: "Regenerate selected segment only",
    category: "timeline",
    frontendRequired: true,
    backendRoute: "/api/admingeneration/editor/projects/[id]/execute-edit",
    provider: "runway",
    status: "blocked_provider_required",
    noFakeRule: "Must create a new segment version only. Do not overwrite original.",
  },
  {
    id: "full_video_regeneration",
    label: "Regenerate entire video as new version",
    category: "full_regeneration",
    frontendRequired: true,
    backendRoute: "/api/admingeneration/editor/projects/[id]/execute-edit",
    provider: "runway",
    status: "blocked_provider_required",
    noFakeRule: "Must be separate from targeted edits and preserve original.",
  },
  {
    id: "qa_gate",
    label: "QA gate before activation",
    category: "qa",
    frontendRequired: true,
    backendRoute: "/api/admingeneration/editor/projects/[id]/qc",
    provider: "fal",
    status: "wired",
    noFakeRule: "Must show real QA or blocked/insufficient-data status.",
  },
  {
    id: "versions",
    label: "Version history",
    category: "versioning",
    frontendRequired: true,
    backendRoute: "/api/admingeneration/editor/projects/[id]/versions",
    provider: "internal",
    status: "wired",
    noFakeRule: "Every edit must preserve original and create/refer to a version.",
  },
  {
    id: "version_actions",
    label: "Compare / approve / revert / branch",
    category: "versioning",
    frontendRequired: true,
    backendRoute: "/api/admingeneration/editor/projects/[id]/version-actions",
    provider: "internal",
    status: "wired",
    noFakeRule: "Must persist action or return blocked. Do not fake active versions.",
  },
  {
    id: "stitch_export",
    label: "Final stitch/export",
    category: "export",
    frontendRequired: true,
    backendRoute: "/api/admingeneration/editor/projects/[id]/export-final",
    provider: "ffmpeg",
    status: "blocked_worker_required",
    noFakeRule: "Must return real MP4/export asset or blocked render worker state.",
  },
];

export function getSemanticEditorCapability(id: string) {
  return SEMANTIC_EDITOR_CAPABILITIES.find((capability) => capability.id === id) || null;
}
