export type ToolMode = "auto" | "cheapest" | "quality" | "manual";

export type ToolSelection = {
  tool: "flux" | "runway" | "kling" | "seedream" | "speech-to-text" | "demucs";
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
  analysis?: any;
};

export type AudioSeparationResult = {
  vocalsUrl?: string | null;
  instrumentalUrl?: string | null;
  drumsUrl?: string | null;
  bassUrl?: string | null;
  otherUrl?: string | null;
};

export type TranscriptWord = {
  word: string;
  start: number;
  end: number;
};

export type TranscriptSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
  words?: TranscriptWord[];
};

export type TranscriptResult = {
  text: string;
  language?: string;
  segments: TranscriptSegment[];
};

export type StitchRequest = {
  inputUrls: string[];
  outputFileName?: string;
};

export type StitchResult = {
  success: boolean;
  outputUrl: string | null;
  error?: string | null;
};
