/**
 * src/lib/song-runtime/types.ts
 *
 * Complete shared type contracts for the song runtime.
 * All layers communicate through these types exclusively.
 * No provider-specific types leak beyond the transport layer.
 */

// ── Input ─────────────────────────────────────────────────────────────────

export type GenerateSongInput = {
  prompt: string;
  lyrics?: string;
  instrumental?: boolean;
  durationSeconds?: number;
  genre?: string;
  mood?: string;
  tempo?: string;
  referenceAudioUrl?: string;
  voiceStyle?: string;
  workspaceId?: string;
  conversationId?: string;
  provider?: string;
  model?: string;
  outputFormat?: "mp3" | "wav";
  requireStems?: boolean;
};

// ── Normalized request ────────────────────────────────────────────────────

export type NormalizedSongRequest = {
  prompt: string;
  lyrics?: string;
  instrumental: boolean;
  durationSeconds: number;
  genre?: string;
  mood?: string;
  tempo?: string;
  referenceAudioUrl?: string;
  voiceStyle?: string;
  workspaceId: string;
  conversationId?: string;
  provider: string;
  model: string | null;
  outputFormat: "mp3" | "wav";
  requireStems: boolean;
};

// ── Plan ──────────────────────────────────────────────────────────────────

export type SongSectionName =
  | "intro"
  | "verse"
  | "chorus"
  | "bridge"
  | "outro";

export type SongSection = {
  section: SongSectionName;
  /** Prompt guidance for this section's content and mood. */
  prompt: string;
  durationSeconds?: number;
};

export type SongPlan = {
  mode: "instrumental" | "vocal";
  provider: string;
  model: string | null;
  durationSeconds: number;
  outputFormat: "mp3" | "wav";
  requireStems: boolean;
  styleSummary: string;
  lyrics?: string;
  sections: SongSection[];
};

// ── Provider contracts ────────────────────────────────────────────────────

export type StemKind =
  | "vocals"
  | "instrumental"
  | "drums"
  | "bass"
  | "other";

export type StemRef = {
  kind: StemKind;
  url: string;
};

export type SongProviderSubmitResult = {
  accepted: boolean;
  provider: string;
  providerJobId: string | null;
  status: "queued" | "processing" | "completed" | "failed";
  outputUrl?: string | null;
  stemUrls?: StemRef[] | null;
  raw: unknown;
};

export type SongProviderStatusResult = {
  provider: string;
  providerJobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  outputUrl?: string | null;
  stemUrls?: StemRef[] | null;
  raw: unknown;
};

// ── Storage ───────────────────────────────────────────────────────────────

export type UploadedStem = {
  kind: StemKind;
  storageUrl: string;
  mimeType: string;
};

// ── DB row shapes ─────────────────────────────────────────────────────────

export type SongJobStatus =
  | "pending"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type SongJobPhase = "submit" | "poll" | "finalize";

export type SongJobRow = {
  id: string;
  generation_id: string;
  workspace_id: string;
  media_type: "song";
  provider: string;
  model: string | null;
  provider_job_id: string | null;
  phase: SongJobPhase;
  status: SongJobStatus;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown> | null;
  output_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

// ── Output ────────────────────────────────────────────────────────────────

export type GenerateSongResult = {
  ok: boolean;
  generationId: string;
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  provider: string;
  model: string | null;
  artifactUrl?: string;
  stemUrls?: string[];
  externalJobId?: string;
  error?: string;
};

// ── Errors ────────────────────────────────────────────────────────────────

export type SongRuntimeErrorCode =
  | "MISSING_PROMPT"
  | "INVALID_DURATION"
  | "INVALID_FORMAT"
  | "UNSUPPORTED_PROVIDER"
  | "NO_PROVIDER_CONFIGURED"
  | "MISSING_WORKSPACE";

export class SongRuntimeError extends Error {
  constructor(
    public readonly code: SongRuntimeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SongRuntimeError";
  }
}

// ── Events ────────────────────────────────────────────────────────────────

export const SONG_EVENTS = {
  VALIDATING: "validating",
  SUBMITTING_PROVIDER_JOB: "submitting_provider_job",
  GENERATING_SONG: "generating_song",
  GENERATING_VOCALS: "generating_vocals",
  GENERATING_INSTRUMENTAL: "generating_instrumental",
  UPLOADING_ARTIFACT: "uploading_artifact",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type SongEventType = (typeof SONG_EVENTS)[keyof typeof SONG_EVENTS];
