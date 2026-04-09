export type ToolMode = "auto" | "cheapest" | "quality" | "manual";

export type ToolSelection = {
  tool: "flux" | "runway" | "kling" | "seedream";
  purpose: "image" | "video" | "audio" | "stitch";
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
