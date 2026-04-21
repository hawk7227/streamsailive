/**
 * src/lib/voice-runtime/types.ts
 * Shared type contracts for the voice runtime.
 * All voice entrypoints communicate through these types.
 */

export type VoiceSegment = {
  text: string;
  speaker?: string;
  startMs?: number;
};

export type GenerateVoiceInput = {
  text: string;
  voice?: string;
  style?: string;
  emotion?: string;
  speed?: number;
  referenceAudioUrl?: string;
  language?: string;
  format?: "mp3" | "wav";
  workspaceId?: string;
  provider?: string;
  model?: string;
  segments?: VoiceSegment[];
  conversationId?: string;
};

export type NormalizedVoiceRequest = {
  text: string;
  voice: string;
  style?: string;
  emotion?: string;
  speed: number;
  referenceAudioUrl?: string;
  language: string;
  format: "mp3" | "wav";
  workspaceId: string;
  conversationId?: string;
  provider: string;
  model: string | null;
  segments: VoiceSegment[];
  isMultiSegment: boolean;
};

export type VoicePlan = {
  provider: string;
  model: string | null;
  voice: string;
  text: string;
  speed: number;
  format: "mp3" | "wav";
  segments: VoiceSegment[];
  isMultiSegment: boolean;
  generateTranscript: boolean;
};

export type VoiceProviderSubmitResult = {
  accepted: boolean;
  provider: string;
  audio?: Buffer;
  providerJobId?: string | null;
  status: "completed" | "pending" | "failed";
  mimeType: string;
  raw: unknown;
};

export type GenerateVoiceResult = {
  ok: boolean;
  generationId: string;
  status: "pending" | "completed" | "failed";
  outputUrl: string | null;
  provider: string;
  model: string | null;
};

export type VoiceJobStatus = "pending" | "processing" | "completed" | "failed";
export type VoiceJobPhase = "submit" | "finalize";

export class VoiceRuntimeError extends Error {
  constructor(
    public readonly code: "MISSING_TEXT" | "TEXT_TOO_LONG" | "UNSUPPORTED_PROVIDER",
    message: string,
  ) {
    super(message);
    this.name = "VoiceRuntimeError";
  }
}

export const VOICE_EVENTS = {
  VALIDATING: "validating",
  SUBMITTING_PROVIDER_JOB: "submitting_provider_job",
  SYNTHESIZING_VOICE: "synthesizing_voice",
  ALIGNING_TRANSCRIPT: "aligning_transcript",
  UPLOADING_ARTIFACT: "uploading_artifact",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
