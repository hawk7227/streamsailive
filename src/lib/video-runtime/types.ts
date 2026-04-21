/**
 * src/lib/video-runtime/types.ts
 *
 * Shared type contracts for the video runtime.
 * Every layer (normalize → validate → plan → persist → submit → poll → finalize)
 * communicates through these types. No provider-specific types leak out.
 */

// ── Input ─────────────────────────────────────────────────────────────────

export type GenerateVideoInput = {
  type: "video" | "i2v";
  prompt: string;
  provider?: string;
  model?: string;
  duration?: string;
  aspectRatio?: string;
  quality?: string;
  imageUrl?: string;
  workspaceId?: string;
  storyBible?: string;
  sourceKind?: "self" | "family_or_friend" | "synthetic" | "mixed";
  longVideo?: boolean;
  realismMode?: "strict" | "balanced" | "strict_everyday" | "premium_commercial";
  conversationId?: string;
};

// ── Normalized request ────────────────────────────────────────────────────

export type VideoMode = "text_to_video" | "image_to_video" | "story_to_video";

export type NormalizedVideoRequest = {
  mode: VideoMode;
  prompt: string;
  storyBible?: string;
  imageUrl?: string;
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  quality: "standard" | "high";
  realismMode: "strict_everyday" | "premium_commercial";
  longVideo: boolean;
  provider: string;
  model: string | null;
  workspaceId: string;
  conversationId?: string;
};

// ── Plan ──────────────────────────────────────────────────────────────────

export type ClipSpec = {
  clipIndex: number;
  prompt: string;
  durationSeconds: number;
  referenceImageUrl?: string;
};

export type VideoPlan = {
  mode: VideoMode;
  provider: string;
  model: string | null;
  durationSeconds: number;
  aspectRatio: string;
  clips: ClipSpec[];
  negativePrompt: string;
  requiresStitching: boolean;
};

// ── Provider contracts ────────────────────────────────────────────────────

export type VideoProviderSubmitResult = {
  accepted: boolean;
  provider: string;
  providerJobId: string | null;
  status: "queued" | "processing" | "completed" | "failed";
  outputUrl?: string | null;
  raw: unknown;
};

export type VideoProviderStatusResult = {
  provider: string;
  providerJobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress?: number;
  outputUrl?: string | null;
  raw: unknown;
};

// ── DB row shapes ─────────────────────────────────────────────────────────

export type VideoJobStatus =
  | "pending"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type VideoJobPhase = "submit" | "poll" | "finalize";

export type VideoJobRow = {
  id: string;
  generation_id: string;
  parent_job_id: string | null;
  workspace_id: string;
  provider: string;
  model: string | null;
  provider_job_id: string | null;
  clip_index: number | null;
  phase: VideoJobPhase;
  status: VideoJobStatus;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown> | null;
  output_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type ArtifactRow = {
  id: string;
  generation_id: string;
  workspace_id: string;
  type: "video" | "image" | "audio";
  storage_url: string;
  mime_type: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  thumbnail_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

// ── Output ────────────────────────────────────────────────────────────────

export type GenerateVideoResult = {
  ok: boolean;
  generationId: string;
  status: "pending" | "completed" | "failed";
  outputUrl: string | null;
  provider: string;
  model: string | null;
};

// ── Errors ────────────────────────────────────────────────────────────────

export type VideoGovernanceErrorCode =
  | "STORY_BIBLE_REQUIRED"
  | "STRUCTURAL_SCORE_BLOCKED"
  | "MISSING_IMAGE_URL"
  | "INVALID_DURATION"
  | "INVALID_ASPECT_RATIO"
  | "UNSUPPORTED_PROVIDER";

export class VideoRuntimeError extends Error {
  constructor(
    public readonly code: VideoGovernanceErrorCode,
    message: string,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "VideoRuntimeError";
  }
}

// ── Event types ───────────────────────────────────────────────────────────

export const VIDEO_EVENTS = {
  UNDERSTANDING: "understanding",
  VALIDATING: "validating",
  QUEUED: "queued",
  SUBMITTING_PROVIDER_JOB: "submitting_provider_job",
  POLLING_PROVIDER_STATUS: "polling_provider_status",
  UPLOADING_ARTIFACT: "uploading_artifact",
  STITCHING_CLIPS: "stitching_clips",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type VideoEventType = (typeof VIDEO_EVENTS)[keyof typeof VIDEO_EVENTS];
