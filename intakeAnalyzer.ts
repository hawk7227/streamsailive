export type ToolMode = "auto" | "cheapest" | "quality" | "manual";

export type ToolSelection = {
  tool: "flux" | "runway" | "kling" | "seedream" | "demucs" | "speech-to-text";
  purpose: "image" | "video" | "audio" | "stitch" | "transcript";
};

export type CostEstimate = {
  low: number;
  high: number;
};

export type GenerationPlan = {
  intent: "PLAN_IMAGE" | "PLAN_VIDEO" | "PLAN_BULK" | "PLAN_STORY";
  duration?: number;
  buildStrategy: "image_to_video" | "full_video" | "image_only" | "bulk";
  tools: ToolSelection[];
  steps: string[];
  costEstimate: CostEstimate;
  prompt: string;
  analysis?: unknown;
};

export type ExecutionResult = {
  images?: { type: "image"; url: string }[];
  video?: { type: "video"; url: string };
  audio?: { type: "audio"; url: string };
};

export type TranscriptWord = {
  word: string;
  start: number;
  end: number;
};

export type TranscriptSegment = {
  id: string;
  text: string;
  start: number;
  end: number;
  words?: TranscriptWord[];
};

export type TranscriptResult = {
  text: string;
  language?: string;
  segments: TranscriptSegment[];
};

export type AudioExtractionResult = {
  audioUrl: string;
  silentVideoUrl?: string;
};

export type AudioSeparationResult = {
  vocalsUrl?: string;
  drumsUrl?: string;
  bassUrl?: string;
  otherUrl?: string;
};

export type StitchRequest = {
  videoUrls: string[];
  outputFileName?: string;
};

export type StitchResult = {
  stitchedVideoUrl: string;
};
