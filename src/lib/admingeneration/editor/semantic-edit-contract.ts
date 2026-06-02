export type SemanticEditScope =
  | "selected_target"
  | "scene"
  | "shot"
  | "frame"
  | "transcript"
  | "word"
  | "speaker"
  | "voice"
  | "motion"
  | "emotion"
  | "body"
  | "camera"
  | "object"
  | "background"
  | "audio"
  | "caption"
  | "full_video";

export type SemanticEditAction =
  | "segment_edit"
  | "regenerate_segment"
  | "replace_clip"
  | "transcript_edit"
  | "voice_edit"
  | "motion_edit"
  | "emotion_body_edit"
  | "mouth_sync"
  | "restore_upscale_stabilize"
  | "object_background_cleanup"
  | "frame_to_video"
  | "audio_separation"
  | "transcription"
  | "color_grade"
  | "qa_status"
  | "export_final"
  | "version_compare"
  | "version_approve"
  | "version_revert"
  | "version_branch"
  | "regenerate_entire_video";

export type ProviderIntent =
  | "internal"
  | "ffmpeg"
  | "stt"
  | "elevenlabs"
  | "runway"
  | "fal"
  | "kling"
  | "veo"
  | "provider_router";

export type SemanticEditTarget = {
  id?: string | null;
  targetType?: string | null;
  layer?: string | null;
  label?: string | null;
  segmentId?: string | null;
  sceneId?: string | null;
  shotId?: string | null;
  frameId?: string | null;
  speakerId?: string | null;
  startSec?: number | null;
  endSec?: number | null;
  frameStart?: number | null;
  frameEnd?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type SemanticEditPlan = {
  action: SemanticEditAction;
  scope: SemanticEditScope;
  routeKind: "execute_edit" | "transcript_edit" | "version_action" | "qa" | "export";
  backendPath: string;
  requiresSelectedTarget: boolean;
  preservesOriginal: true;
  createsVersion: boolean;
  fullVideoRegeneration: boolean;
  providerIntent: ProviderIntent;
};

type SemanticPlanBase = Omit<SemanticEditPlan, "backendPath">;

export const SEMANTIC_EDIT_ACTIONS: Record<SemanticEditAction, SemanticPlanBase> = {
  segment_edit: {
    action: "segment_edit",
    scope: "selected_target",
    routeKind: "execute_edit",
    requiresSelectedTarget: true,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: false,
    providerIntent: "provider_router",
  },
  regenerate_segment: {
    action: "regenerate_segment",
    scope: "selected_target",
    routeKind: "execute_edit",
    requiresSelectedTarget: true,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: false,
    providerIntent: "runway",
  },
  replace_clip: {
    action: "replace_clip",
    scope: "shot",
    routeKind: "execute_edit",
    requiresSelectedTarget: true,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: false,
    providerIntent: "provider_router",
  },
  transcript_edit: {
    action: "transcript_edit",
    scope: "transcript",
    routeKind: "transcript_edit",
    requiresSelectedTarget: true,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: false,
    providerIntent: "stt",
  },
  voice_edit: {
    action: "voice_edit",
    scope: "voice",
    routeKind: "execute_edit",
    requiresSelectedTarget: true,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: false,
    providerIntent: "elevenlabs",
  },
  motion_edit: {
    action: "motion_edit",
    scope: "motion",
    routeKind: "execute_edit",
    requiresSelectedTarget: true,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: false,
    providerIntent: "runway",
  },
  emotion_body_edit: {
    action: "emotion_body_edit",
    scope: "emotion",
    routeKind: "execute_edit",
    requiresSelectedTarget: true,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: false,
    providerIntent: "runway",
  },
  mouth_sync: {
    action: "mouth_sync",
    scope: "voice",
    routeKind: "execute_edit",
    requiresSelectedTarget: true,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: false,
    providerIntent: "provider_router",
  },
  restore_upscale_stabilize: {
    action: "restore_upscale_stabilize",
    scope: "shot",
    routeKind: "execute_edit",
    requiresSelectedTarget: true,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: false,
    providerIntent: "ffmpeg",
  },
  object_background_cleanup: {
    action: "object_background_cleanup",
    scope: "object",
    routeKind: "execute_edit",
    requiresSelectedTarget: true,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: false,
    providerIntent: "runway",
  },
  frame_to_video: {
    action: "frame_to_video",
    scope: "frame",
    routeKind: "execute_edit",
    requiresSelectedTarget: true,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: false,
    providerIntent: "kling",
  },
  audio_separation: {
    action: "audio_separation",
    scope: "audio",
    routeKind: "execute_edit",
    requiresSelectedTarget: false,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: false,
    providerIntent: "ffmpeg",
  },
  transcription: {
    action: "transcription",
    scope: "transcript",
    routeKind: "execute_edit",
    requiresSelectedTarget: false,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: false,
    providerIntent: "stt",
  },
  color_grade: {
    action: "color_grade",
    scope: "shot",
    routeKind: "execute_edit",
    requiresSelectedTarget: true,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: false,
    providerIntent: "ffmpeg",
  },
  qa_status: {
    action: "qa_status",
    scope: "selected_target",
    routeKind: "qa",
    requiresSelectedTarget: false,
    preservesOriginal: true,
    createsVersion: false,
    fullVideoRegeneration: false,
    providerIntent: "fal",
  },
  export_final: {
    action: "export_final",
    scope: "full_video",
    routeKind: "export",
    requiresSelectedTarget: false,
    preservesOriginal: true,
    createsVersion: false,
    fullVideoRegeneration: false,
    providerIntent: "ffmpeg",
  },
  version_compare: {
    action: "version_compare",
    scope: "full_video",
    routeKind: "version_action",
    requiresSelectedTarget: false,
    preservesOriginal: true,
    createsVersion: false,
    fullVideoRegeneration: false,
    providerIntent: "internal",
  },
  version_approve: {
    action: "version_approve",
    scope: "full_video",
    routeKind: "version_action",
    requiresSelectedTarget: false,
    preservesOriginal: true,
    createsVersion: false,
    fullVideoRegeneration: false,
    providerIntent: "internal",
  },
  version_revert: {
    action: "version_revert",
    scope: "full_video",
    routeKind: "version_action",
    requiresSelectedTarget: false,
    preservesOriginal: true,
    createsVersion: false,
    fullVideoRegeneration: false,
    providerIntent: "internal",
  },
  version_branch: {
    action: "version_branch",
    scope: "full_video",
    routeKind: "version_action",
    requiresSelectedTarget: false,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: false,
    providerIntent: "internal",
  },
  regenerate_entire_video: {
    action: "regenerate_entire_video",
    scope: "full_video",
    routeKind: "execute_edit",
    requiresSelectedTarget: false,
    preservesOriginal: true,
    createsVersion: true,
    fullVideoRegeneration: true,
    providerIntent: "provider_router",
  },
};

export function resolveSemanticEditPlan(projectId: string, action: SemanticEditAction): SemanticEditPlan {
  const base = SEMANTIC_EDIT_ACTIONS[action];

  if (!base) {
    throw new Error(`Unsupported semantic edit action: ${action}`);
  }

  const pathBase = `/api/admingeneration/editor/projects/${projectId}`;

  const backendPath =
    base.routeKind === "transcript_edit"
      ? `${pathBase}/transcript-edits`
      : base.routeKind === "version_action"
        ? `${pathBase}/version-actions`
        : base.routeKind === "qa"
          ? `${pathBase}/qc`
          : base.routeKind === "export"
            ? `${pathBase}/export-final`
            : `${pathBase}/execute-edit`;

  return { ...base, backendPath };
}
