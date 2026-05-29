export type VideoReferenceSourceType = "youtube" | "upload" | "url" | "recording";

export type VideoReferenceBlueprint = {
  source: {
    type: VideoReferenceSourceType;
    url?: string;
    assetId?: string;
    title?: string;
    durationSec?: number | null;
  };
  summary: {
    title: string;
    conciseSummary: string;
    recreateGoal: string;
  };
  shots: Array<{
    shotIndex: number;
    startSec: number;
    endSec: number;
    durationSec: number;
    frameAssetIds: string[];
    sceneDescription: string;
    subjectDescription: string;
    environment: string;
    cameraMovement: string;
    lensComposition: string;
    lighting: string;
    motion: string;
    pacing: string;
    dialogueOrNarration?: string;
    soundDesign?: string;
  }>;
  visualLanguage: {
    style: string;
    colorPalette: string;
    productionDesign: string;
    realismLevel: string;
    lightingStyle: string;
    compositionStyle: string;
  };
  audioLanguage: {
    transcript: string;
    voiceStyle: string;
    narrationTone: string;
    musicStyle: string;
    soundDesign: string;
    pacing: string;
  };
  timingMap: Array<{
    timeSec: number;
    event: string;
  }>;
  generation: {
    providerReadyPrompt: string;
    negativePrompt: string;
    recreatePrompt: string;
    imageToVideoPrompt?: string;
    textToVideoPrompt?: string;
    recommendedProvider: string;
    recommendedMode: "text-to-video" | "image-to-video";
  };
};

export type VideoReferenceAnalysisStatus =
  | "queued"
  | "needs_worker"
  | "analyzing"
  | "completed"
  | "failed";

export type VideoReferenceAnalysisRecord = {
  id: string;
  projectId: string | null;
  jobId: string | null;
  sourceType: VideoReferenceSourceType;
  sourceUrl: string | null;
  sourceAssetId: string | null;
  status: VideoReferenceAnalysisStatus;
  blueprint: VideoReferenceBlueprint | null;
  transcript: string | null;
  summary: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export function buildProviderReadyPrompt(blueprint: VideoReferenceBlueprint) {
  const shotPlan = blueprint.shots
    .map((shot) =>
      `Shot ${shot.shotIndex} (${shot.startSec}-${shot.endSec}s): ${shot.sceneDescription}\nCamera: ${shot.cameraMovement}; ${shot.lensComposition}\nLighting: ${shot.lighting}\nMotion: ${shot.motion}\nSound: ${shot.soundDesign || "match reference pacing and mix"}`,
    )
    .join("\n\n");

  return [
    "Create a video closely matching the analyzed reference in pacing, visual tone, camera language, lighting, composition, and sound design.",
    "Do not copy logos, watermarks, protected branding, or identifiable copyrighted characters unless the user owns the rights.",
    "",
    `Reference summary: ${blueprint.summary.conciseSummary}`,
    "",
    "Shot plan:",
    shotPlan || "Use the analyzed timing map and source references to build a shot-by-shot recreation plan.",
    "",
    `Visual language: ${blueprint.visualLanguage.style}; palette ${blueprint.visualLanguage.colorPalette}; lighting ${blueprint.visualLanguage.lightingStyle}; composition ${blueprint.visualLanguage.compositionStyle}.`,
    `Audio language: ${blueprint.audioLanguage.voiceStyle}; tone ${blueprint.audioLanguage.narrationTone}; music ${blueprint.audioLanguage.musicStyle}; sound design ${blueprint.audioLanguage.soundDesign}.`,
    "",
    `Negative constraints: ${blueprint.generation.negativePrompt}`,
  ].join("\n");
}

export function emptyBlueprint(args: {
  sourceType: VideoReferenceSourceType;
  sourceUrl?: string | null;
  sourceAssetId?: string | null;
  title?: string | null;
  transcript?: string | null;
}): VideoReferenceBlueprint {
  const title = args.title || "Video reference";
  const transcript = args.transcript || "";

  return {
    source: {
      type: args.sourceType,
      url: args.sourceUrl || undefined,
      assetId: args.sourceAssetId || undefined,
      title,
      durationSec: null,
    },
    summary: {
      title,
      conciseSummary: "Full visual/audio analysis is pending real frame and audio extraction.",
      recreateGoal: "Recreate the structure only after frames, audio, shot timing, transcript, and motion analysis are available.",
    },
    shots: [],
    visualLanguage: {
      style: "pending frame analysis",
      colorPalette: "pending frame analysis",
      productionDesign: "pending frame analysis",
      realismLevel: "pending frame analysis",
      lightingStyle: "pending frame analysis",
      compositionStyle: "pending frame analysis",
    },
    audioLanguage: {
      transcript,
      voiceStyle: transcript ? "transcript available; acoustic voice analysis pending audio extraction" : "pending audio extraction",
      narrationTone: "pending audio extraction",
      musicStyle: "pending audio extraction",
      soundDesign: "pending audio extraction",
      pacing: "pending shot and audio timing analysis",
    },
    timingMap: [],
    generation: {
      providerReadyPrompt: "Blocked until full reference analysis completes with extracted frames and audio.",
      negativePrompt: "no logos, no watermarks, no distorted humans, no unreadable text, no sudden cuts unless present in reference",
      recreatePrompt: "Blocked until full reference analysis completes.",
      recommendedProvider: "runway-or-fal-after-analysis",
      recommendedMode: "image-to-video",
    },
  };
}
