export const SAME_SCENE_ACTIONS = [
  {
    id: "motivate_myself",
    label: "Motivate Myself",
    parentAction: "facetime_with_myself",
    description: "Create a FaceTime-style motivational clip from a stronger or future version of the user.",
    defaultTone: "future_me_determination",
    motionLevel: "moderate",
    requiredAssetKinds: ["image", "video"],
    recommendedDuration: 8,
    overlayPreset: "motivate_myself",
    voiceoverPreset: "motivate_myself",
    defaultAspectRatio: "9:16",
  },
  {
    id: "make_me_talk",
    label: "Make Me Talk",
    description: "Bring a captured photo or video to life as a short talking-video clip.",
    defaultTone: "natural_creator",
    motionLevel: "low",
    requiredAssetKinds: ["image", "video"],
    recommendedDuration: 8,
    overlayPreset: "talking_video",
    voiceoverPreset: "talking_video",
    defaultAspectRatio: "9:16",
  },
  {
    id: "same_scene_reaction",
    label: "Crazy Reaction",
    description: "Keep the same person and setting, then create a funny or dramatic reaction clip.",
    defaultTone: "funny_reaction",
    motionLevel: "moderate",
    requiredAssetKinds: ["image", "video"],
    recommendedDuration: 6,
    overlayPreset: "reaction",
    voiceoverPreset: "reaction",
    defaultAspectRatio: "9:16",
  },
  {
    id: "movie_entrance",
    label: "Movie Entrance",
    description: "Turn the subject into a cinematic entrance while preserving the scene style.",
    defaultTone: "cinematic",
    motionLevel: "moderate",
    requiredAssetKinds: ["image", "video"],
    recommendedDuration: 8,
    overlayPreset: "movie_entrance",
    voiceoverPreset: "none",
    defaultAspectRatio: "9:16",
  },
  {
    id: "dance_lite",
    label: "Make Me Dance",
    description: "Create a short dance-lite motion clip from a person photo/video. Best with full body visible.",
    defaultTone: "viral_fun",
    motionLevel: "high",
    requiredAssetKinds: ["image", "video"],
    recommendedDuration: 8,
    overlayPreset: "dance_lite",
    voiceoverPreset: "none",
    defaultAspectRatio: "9:16",
  },
  {
    id: "glow_up",
    label: "Glow Up",
    description: "Create a polished future/luxury transformation while preserving recognizable features and setting cues.",
    defaultTone: "future_me",
    motionLevel: "moderate",
    requiredAssetKinds: ["image", "video"],
    recommendedDuration: 8,
    overlayPreset: "glow_up",
    voiceoverPreset: "glow_up",
    defaultAspectRatio: "9:16",
  },
];

export const MOTIVATION_TONES = [
  {
    id: "future_me_determination",
    label: "Future Me + Determination",
    category: "motivation",
    safetyStyle: "firm but supportive",
    voiceoverScript: "You already know what you want. Now act like it. One focused hour today can change the whole direction of your life.",
  },
  {
    id: "dark_motivation",
    label: "Dark Motivation",
    category: "motivation",
    safetyStyle: "cinematic hard-truth discipline without shame or self-harm framing",
    voiceoverScript: "Nobody is coming to build your dream for you. That is not bad news. That means it belongs to you. Lock in and move today.",
  },
  {
    id: "survival_mode",
    label: "Survival Mode",
    category: "motivation",
    safetyStyle: "resilient and grounding",
    voiceoverScript: "You have survived days that felt impossible. Handle the next ten minutes. Then the next. You are still here, and that matters.",
  },
  {
    id: "soft_encouragement",
    label: "Soft Encouragement",
    category: "motivation",
    safetyStyle: "warm and supportive",
    voiceoverScript: "You do not have to fix everything today. Take the next honest step. You are not behind. You are rebuilding.",
  },
  {
    id: "no_excuses",
    label: "No Excuses",
    category: "motivation",
    safetyStyle: "direct but non-abusive",
    voiceoverScript: "You said you wanted a different life. This is the part where you prove it. Not tomorrow. Start now.",
  },
  {
    id: "natural_creator",
    label: "Natural Creator",
    category: "talking",
    safetyStyle: "natural and conversational",
    voiceoverScript: "Here is the message, brought to life in the same scene with a fresh new action.",
  },
  {
    id: "funny_reaction",
    label: "Funny Reaction",
    category: "reaction",
    safetyStyle: "playful and expressive",
    voiceoverScript: "That moment when everything changes and the reaction says it all.",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    category: "style",
    safetyStyle: "dramatic and polished",
    voiceoverScript: "",
  },
  {
    id: "viral_fun",
    label: "Viral Fun",
    category: "dance",
    safetyStyle: "fun and light",
    voiceoverScript: "",
  },
  {
    id: "future_me",
    label: "Future Me",
    category: "style",
    safetyStyle: "aspirational and premium",
    voiceoverScript: "This is what happens when you keep going and become the version of yourself you promised to build.",
  },
];

export const SAME_SCENE_OVERLAY_PRESETS = {
  motivate_myself: [
    { type: "text", text: "Future Me called.", start: 0.3, end: 2.0, x: "center", y: "16%", fontSize: 54, fontWeight: 800, color: "#ffffff", box: false },
    { type: "text", text: "Lock in.", start: 2.1, end: 4.4, x: "center", y: "74%", fontSize: 34, fontWeight: 900, color: "#ffffff", box: true, boxColor: "0x111827@0.72", boxBorder: 18 },
    { type: "text", text: "One focused hour.", start: 4.5, end: 6.3, x: "center", y: "74%", fontSize: 30, fontWeight: 900, color: "#ffffff", box: true, boxColor: "0x7c3aed@0.82", boxBorder: 18 },
    { type: "text", text: "You already know what to do.", start: 6.4, end: 8.0, x: "center", y: "16%", fontSize: 34, fontWeight: 900, color: "#ffffff", box: true, boxColor: "black@0.48", boxBorder: 16 },
  ],
  talking_video: [
    { type: "text", text: "Same scene. New message.", start: 0.4, end: 2.4, x: "center", y: "16%", fontSize: 38, fontWeight: 800, color: "#ffffff", box: true, boxColor: "black@0.45", boxBorder: 16 },
    { type: "text", text: "Bring the photo to life.", start: 5.2, end: 8.0, x: "center", y: "76%", fontSize: 30, fontWeight: 800, color: "#ffffff", box: true, boxColor: "0x7c3aed@0.78", boxBorder: 16 },
  ],
  reaction: [
    { type: "text", text: "When it finally clicks…", start: 0.3, end: 2.5, x: "center", y: "14%", fontSize: 34, fontWeight: 900, color: "#ffffff", box: true, boxColor: "black@0.50", boxBorder: 16 },
    { type: "text", text: "Same scene. Bigger reaction.", start: 4.5, end: 6.0, x: "center", y: "74%", fontSize: 30, fontWeight: 900, color: "#ffffff", box: true, boxColor: "0x7c3aed@0.78", boxBorder: 16 },
  ],
  movie_entrance: [
    { type: "text", text: "Movie Mode", start: 0.4, end: 2.0, x: "center", y: "16%", fontSize: 42, fontWeight: 900, color: "#ffffff", box: true, boxColor: "black@0.48", boxBorder: 16 },
    { type: "text", text: "Main Character Energy", start: 5.0, end: 8.0, x: "center", y: "76%", fontSize: 28, fontWeight: 900, color: "#ffffff", box: true, boxColor: "0x7c3aed@0.78", boxBorder: 16 },
  ],
  dance_lite: [
    { type: "text", text: "Same scene. New move.", start: 0.4, end: 2.0, x: "center", y: "16%", fontSize: 38, fontWeight: 900, color: "#ffffff", box: true, boxColor: "black@0.45", boxBorder: 16 },
    { type: "text", text: "Make Me Dance", start: 5.4, end: 8.0, x: "center", y: "76%", fontSize: 30, fontWeight: 900, color: "#ffffff", box: true, boxColor: "0x7c3aed@0.78", boxBorder: 16 },
  ],
  glow_up: [
    { type: "text", text: "Future Version", start: 0.4, end: 2.0, x: "center", y: "16%", fontSize: 40, fontWeight: 900, color: "#ffffff", box: true, boxColor: "black@0.45", boxBorder: 16 },
    { type: "text", text: "Glow Up", start: 5.4, end: 8.0, x: "center", y: "76%", fontSize: 32, fontWeight: 900, color: "#ffffff", box: true, boxColor: "0x7c3aed@0.78", boxBorder: 16 },
  ],
};

export const SAFE_FEATURE_COPY = {
  title: "Same Scene, New Action",
  subtitle: "Use a captured or uploaded photo/video of yourself or someone who gave permission.",
  description: "Keep the same person, outfit, lighting, and setting, then choose what happens next.",
  safety: "Only use your own media or media you have permission to use. Personal media reuse requires permission confirmation.",
};

export function getSameSceneActionById(actionId) {
  return SAME_SCENE_ACTIONS.find((item) => item.id === actionId) || null;
}

export function getToneById(toneId) {
  return MOTIVATION_TONES.find((item) => item.id === toneId) || null;
}

export function buildSameScenePrompt({
  action,
  tone,
  topic = "",
  preserveFace = true,
  preserveOutfit = true,
  preserveSetting = true,
  preserveCameraAngle = true,
  allowStyleChanges = false,
}) {
  const instructions = [
    "Create a short vertical social video.",
    "Preserve the same recognizable person and overall setting.",
    preserveFace ? "Keep the same facial appearance." : "",
    preserveOutfit ? "Keep the same outfit or a very similar version." : "",
    preserveSetting ? "Keep the same room, background, and lighting style." : "",
    preserveCameraAngle ? "Keep a similar camera angle and framing." : "",
    !allowStyleChanges ? "Do not drift into a completely different visual style." : "Minor cinematic styling upgrades are allowed.",
    action?.description || "",
    tone?.category === "motivation" && topic ? `The motivation topic is: ${topic}.` : "",
    tone?.label ? `Tone: ${tone.label}.` : "",
    "Do not attempt to render exact long-form text inside the base video. Leave exact wording for overlays during finalization.",
  ].filter(Boolean);

  return instructions.join(" ");
}

export function buildSameScenePlan({
  asset,
  actionId,
  toneId,
  topic = "",
  duration = 8,
  aspectRatio = "9:16",
  preserveFace = true,
  preserveOutfit = true,
  preserveSetting = true,
  preserveCameraAngle = true,
  allowStyleChanges = false,
  permissionConfirmed = false,
  useVoiceStyle = false,
}) {
  const action = getSameSceneActionById(actionId) || SAME_SCENE_ACTIONS[0];
  const tone = getToneById(toneId) || getToneById(action.defaultTone) || null;
  const overlays = SAME_SCENE_OVERLAY_PRESETS[action.overlayPreset] || SAME_SCENE_OVERLAY_PRESETS.motivate_myself;
  const voiceoverScript = action.voiceoverPreset === "none" ? "" : tone?.voiceoverScript || "";
  const assetUrl = asset?.previewUrl || asset?.storageUrl || asset?.url || "";
  const canGenerate = Boolean(assetUrl) && permissionConfirmed === true;

  return {
    ok: true,
    canGenerate,
    blockedReason: canGenerate ? "" : "Permission confirmation and a saved photo/video are required before generation.",
    asset,
    action,
    tone,
    duration: Math.max(5, Math.min(10, Number(duration || action.recommendedDuration || 8))),
    aspectRatio,
    preserve: {
      face: preserveFace,
      outfit: preserveOutfit,
      setting: preserveSetting,
      cameraAngle: preserveCameraAngle,
      allowStyleChanges,
    },
    permissionConfirmed,
    useVoiceStyle,
    topic,
    voiceoverScript,
    overlays,
    prompt: buildSameScenePrompt({ action, tone, topic, preserveFace, preserveOutfit, preserveSetting, preserveCameraAngle, allowStyleChanges }),
    nextStep: canGenerate ? "Generate base video, then open final preview drawer for overlays and voice." : "Confirm permission and choose saved media first.",
  };
}
