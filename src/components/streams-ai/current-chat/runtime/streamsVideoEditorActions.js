export const VIDEO_EDITOR_ACTIONS = Object.freeze([
  {
    id: "video_ingest",
    label: "Ingest Video",
    target: "video",
    capability: "ingestion",
    route: "/api/streams/video/ingest",
    method: "POST",
    requires: ["assetId", "videoUrl"],
    output: "ingestionJob",
    enabled: true,
  },
  {
    id: "video_extract_frames",
    label: "Extract Frames",
    target: "video",
    capability: "frame_extraction",
    route: "/api/streams/extract-video-frames",
    method: "POST",
    requires: ["videoUrl"],
    output: "frames",
    enabled: true,
  },
  {
    id: "video_transcribe",
    label: "Transcribe",
    target: "audio",
    capability: "transcription",
    route: "/api/pipeline-test/transcript/transcribe",
    method: "POST",
    requires: ["audioUrl"],
    output: "transcript",
    enabled: true,
  },
  {
    id: "video_edit_voice",
    label: "Replace Voice",
    target: "audioSegment",
    capability: "voice_edit",
    route: "/api/streams/video/edit-voice",
    method: "POST",
    requires: ["assetId", "segmentId", "voiceId"],
    output: "video",
    enabled: true,
  },
  {
    id: "video_translate_segment",
    label: "Translate Segment",
    target: "transcriptSegment",
    capability: "dub",
    route: "/api/streams/video/dub",
    method: "POST",
    requires: ["assetId", "segmentId", "language"],
    output: "video",
    enabled: true,
  },
  {
    id: "video_change_emotion",
    label: "Change Emotion",
    target: "emotionSegment",
    capability: "emotion_edit",
    route: "/api/streams/video/edit-emotion",
    method: "POST",
    requires: ["assetId", "segmentId", "emotionPrompt"],
    output: "video",
    enabled: true,
  },
  {
    id: "video_change_motion",
    label: "Change Motion",
    target: "motionSegment",
    capability: "motion_edit",
    route: "/api/streams/video/edit-motion",
    method: "POST",
    requires: ["assetId", "segmentId", "motionPrompt"],
    output: "video",
    enabled: true,
  },
  {
    id: "video_change_body",
    label: "Change Body Motion",
    target: "bodySegment",
    capability: "body_motion",
    route: "/api/streams/video/edit-body",
    method: "POST",
    requires: ["assetId", "segmentId", "bodyPrompt"],
    output: "video",
    enabled: true,
  },
  {
    id: "video_extract_frame",
    label: "Create Image From Frame",
    target: "frame",
    capability: "frame_to_image",
    route: "/api/streams/extract-video-frames",
    method: "POST",
    requires: ["assetId", "timestamp"],
    output: "image",
    enabled: true,
  },
  {
    id: "video_regenerate_shot",
    label: "Regenerate Shot",
    target: "shot",
    capability: "shot_regeneration",
    route: "/api/streams/media/create",
    method: "POST",
    requires: ["assetId", "shotId", "prompt"],
    output: "video",
    enabled: true,
  },
  {
    id: "video_lip_sync",
    label: "Sync Mouth",
    target: "audioSegment",
    capability: "lip_sync",
    route: "",
    method: "POST",
    requires: ["assetId", "segmentId", "audioUrl"],
    output: "video",
    enabled: false,
    blockedReason: "Lip sync requires a confirmed editor-safe route contract.",
  },
  {
    id: "video_save_version",
    label: "Save Version",
    target: "video",
    capability: "versioning",
    route: "",
    method: "POST",
    requires: ["artifactId"],
    output: "version",
    enabled: false,
    blockedReason: "Version save requires an artifactId-backed version route.",
  },
]);

export function getVideoEditorAction(id) {
  return VIDEO_EDITOR_ACTIONS.find((action) => action.id === id) || null;
}

export function getEnabledVideoEditorActions() {
  return VIDEO_EDITOR_ACTIONS.filter((action) => action.enabled);
}

export function getBlockedVideoEditorActions() {
  return VIDEO_EDITOR_ACTIONS.filter((action) => !action.enabled);
}

export function buildVideoEditorSelection(selection = {}) {
  return {
    type: selection.type || "shot",
    id: selection.id || "",
    startTime: Number(selection.startTime || 0),
    endTime: Number(selection.endTime || selection.startTime || 0),
    trackType: selection.trackType || "video",
  };
}

export function buildVideoEditorState(asset = {}) {
  return {
    asset,
    selectedRange: buildVideoEditorSelection(),
    selectedActionId: "",
    timelineZoom: 1,
    timelineOffset: 0,
    compareMode: "current",
    actions: VIDEO_EDITOR_ACTIONS,
  };
}
