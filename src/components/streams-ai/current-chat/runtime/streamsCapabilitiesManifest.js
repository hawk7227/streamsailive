export const STREAMS_CAPABILITIES = [
  {
    id: "same_scene_new_action",
    title: "Same Scene, New Action",
    status: "implemented_ui_and_planning_slice",
    summary: "Use permission-confirmed personal media to preserve the same person, outfit, lighting, and setting while generating a new short action video.",
    userOptions: ["Motivate Myself", "Make Me Talk", "Crazy Reaction", "Movie Entrance", "Make Me Dance", "Glow Up", "Future Version", "Younger Version", "Older Version"],
    limits: ["Requires permission confirmation", "Builds a safe action plan first", "Exact long text should be added during final overlays, not inside the base video"],
  },
  {
    id: "snap_pic_click_capture",
    title: "Snap Pic Click Capture",
    status: "implemented_ui_slice",
    summary: "Camera photo, camera video recording, and mic voice recording for Snap Pic Click personal media capture.",
    userOptions: ["Use Me", "Current Me", "Future Me", "Younger Me", "Older Me", "Use My Voice", "Record New Voice", "Motivate Myself"],
    limits: ["Browser camera/mic permission required", "Personal identity/voice reuse still requires analyzer approval and consent phrase"],
  },
  {
    id: "motivate_myself",
    title: "Motivate Myself",
    status: "implemented_prompt_logic_slice",
    summary: "Snap Pic Click action for FaceTime-style motivational videos from a future/stronger version of the user, with safe tone options and editable voiceover/overlay text.",
    userOptions: ["Future Me", "Determination", "Dark Motivation", "Survival Mode", "Soft Encouragement", "No Excuses"],
    limits: ["Dark motivation is treated as hard-truth discipline without self-harm, shame, or abuse content"],
  },
  {
    id: "capture_analyzer",
    title: "Capture Analyzer",
    status: "implemented_truthful_heuristic",
    summary: "Scores captured image/video/audio assets with guidance for retake/use-this decisions.",
    limits: ["Current analyzer uses metadata and consent/transcript signals; deep face/voice biometric model is not claimed"],
  },
  {
    id: "video_generation",
    title: "Video Generation",
    status: "implemented_provider_path",
    summary: "FAL/Kling video generation path with default 5 seconds and backend clamp up to 10 seconds.",
  },
  {
    id: "finalize_preview",
    title: "Finalize Preview Drawer",
    status: "implemented_ui_slice",
    summary: "Preview overlays, prehear voiceover, edit script/text, then finalize MP4 with FFmpeg.",
  },
  {
    id: "voiceover_generation",
    title: "Voiceover Generation",
    status: "implemented_backend_route",
    summary: "ElevenLabs primary with OpenAI TTS fallback for voiceover audio generation.",
  },
  {
    id: "video_overlay_render",
    title: "FFmpeg Overlay and Audio Mix",
    status: "implemented_backend_route",
    summary: "Burns exact text overlays into MP4 and mixes source audio, voiceover, music, and SFX.",
  },
  {
    id: "upload_file_reading",
    title: "Upload and File Reading",
    status: "implemented_partial",
    summary: "Durable upload route with PDF, DOCX, text, audio transcription, video frame extraction, and chunked text context.",
  },
  {
    id: "video_studio_grid",
    title: "Video Studio Grid",
    status: "implemented_ui_slice",
    summary: "Generated/uploaded videos appear in workflow folders including Uploaded Videos, Text to Video, Image to Video, and Snap Pic Click.",
  },
  {
    id: "durable_media_queue",
    title: "Durable Media Queue",
    status: "implemented_backend_routes",
    summary: "Supabase-storage-backed media job enqueue/read/list/claim/complete/fail lifecycle.",
    limits: ["Not unlimited; processing limits depend on configured worker/runtime/provider limits"],
  },
];

export function formatCapabilitiesForChat() {
  return [
    "STREAMS capabilities currently known to Chat:",
    "",
    ...STREAMS_CAPABILITIES.map((capability) => {
      const lines = [`- ${capability.title} (${capability.id}) — ${String(capability.status || "unknown").replace(/_/g, " ").toUpperCase()}`];
      if (capability.summary) lines.push(`  ${capability.summary}`);
      if (capability.userOptions?.length) lines.push(`  Options: ${capability.userOptions.join(", ")}`);
      if (capability.limits?.length) lines.push(`  Limits: ${capability.limits.join("; ")}`);
      return lines.join("\n");
    }),
    "",
    "Chat must not claim a capability is fully production-complete unless it has runtime, storage/output, and verification proof.",
  ].join("\n");
}
