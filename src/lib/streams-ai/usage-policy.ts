export type StreamsAIPlanId =
  | "free_builder"
  | "plus_operator"
  | "pro_builder"
  | "creator_studio"
  | "launch_studio"
  | "agency_studio";

export type StreamsAIFeatureCostKey =
  | "operator_chat"
  | "business_builder"
  | "income_potential"
  | "content_generator"
  | "document_plan_builder"
  | "code_troubleshooting"
  | "image_studio"
  | "four_image_pack"
  | "photo_to_motion"
  | "text_to_video"
  | "voice_studio"
  | "captions_subtitles"
  | "turn_this_into_you"
  | "website_preview"
  | "launch_plan";

export type StreamsAIPlanPolicy = {
  id: StreamsAIPlanId;
  name: string;
  monthlyPriceUsd: number;
  monthlyIncludedCredits: number;
  welcomeCredits?: number;
  welcomeExpiresDays?: number;
  dailyCredits: number;
  sessionCredits: number;
  sessionWindowHours: number;
  dailyChatMessages: number;
  brands: number | "unlimited";
  projects: number | "unlimited";
  usageCreditsEnabled: boolean;
  previewAccess: string;
};

export type StreamsAIFeatureCost = {
  key: StreamsAIFeatureCostKey;
  label: string;
  draft: number;
  final: number;
};

export const STREAMS_AI_SESSION_WINDOW_HOURS = 5;
export const STREAMS_AI_DEFAULT_MONTHLY_SPEND_LIMIT_USD = 100;
export const STREAMS_AI_MAX_SELF_SERVE_MONTHLY_SPEND_LIMIT_USD = 2000;
export const STREAMS_AI_DAILY_PURCHASE_LIMIT_USD = 2000;
export const STREAMS_AI_LOW_BALANCE_WARNING_USD = 15;
export const STREAMS_AI_AUTO_RELOAD_DEFAULT_THRESHOLD_USD = 10;
export const STREAMS_AI_AUTO_RELOAD_DEFAULT_TOP_UP_USD = 50;

export const STREAMS_AI_PLAN_POLICIES: Record<StreamsAIPlanId, StreamsAIPlanPolicy> = {
  free_builder: {
    id: "free_builder",
    name: "Free Builder",
    monthlyPriceUsd: 0,
    monthlyIncludedCredits: 0,
    welcomeCredits: 10,
    welcomeExpiresDays: 7,
    dailyCredits: 5,
    sessionCredits: 3,
    sessionWindowHours: STREAMS_AI_SESSION_WINDOW_HOURS,
    dailyChatMessages: 20,
    brands: 1,
    projects: 1,
    usageCreditsEnabled: false,
    previewAccess: "Watermarked limited previews",
  },
  plus_operator: {
    id: "plus_operator",
    name: "Plus Operator",
    monthlyPriceUsd: 29,
    monthlyIncludedCredits: 300,
    dailyCredits: 35,
    sessionCredits: 20,
    sessionWindowHours: STREAMS_AI_SESSION_WINDOW_HOURS,
    dailyChatMessages: 150,
    brands: 3,
    projects: 10,
    usageCreditsEnabled: true,
    previewAccess: "Standard Streams previews",
  },
  pro_builder: {
    id: "pro_builder",
    name: "Pro Builder",
    monthlyPriceUsd: 59,
    monthlyIncludedCredits: 900,
    dailyCredits: 85,
    sessionCredits: 55,
    sessionWindowHours: STREAMS_AI_SESSION_WINDOW_HOURS,
    dailyChatMessages: 400,
    brands: "unlimited",
    projects: "unlimited",
    usageCreditsEnabled: true,
    previewAccess: "Full builder previews",
  },
  creator_studio: {
    id: "creator_studio",
    name: "Creator Studio",
    monthlyPriceUsd: 99,
    monthlyIncludedCredits: 1800,
    dailyCredits: 160,
    sessionCredits: 105,
    sessionWindowHours: STREAMS_AI_SESSION_WINDOW_HOURS,
    dailyChatMessages: 900,
    brands: "unlimited",
    projects: "unlimited",
    usageCreditsEnabled: true,
    previewAccess: "Creator studio previews",
  },
  launch_studio: {
    id: "launch_studio",
    name: "Launch Studio",
    monthlyPriceUsd: 199,
    monthlyIncludedCredits: 4500,
    dailyCredits: 350,
    sessionCredits: 240,
    sessionWindowHours: STREAMS_AI_SESSION_WINDOW_HOURS,
    dailyChatMessages: 2000,
    brands: "unlimited",
    projects: "unlimited",
    usageCreditsEnabled: true,
    previewAccess: "Launch-ready previews",
  },
  agency_studio: {
    id: "agency_studio",
    name: "Agency Studio",
    monthlyPriceUsd: 399,
    monthlyIncludedCredits: 12000,
    dailyCredits: 900,
    sessionCredits: 600,
    sessionWindowHours: STREAMS_AI_SESSION_WINDOW_HOURS,
    dailyChatMessages: 5000,
    brands: "unlimited",
    projects: "unlimited",
    usageCreditsEnabled: true,
    previewAccess: "Agency portfolio previews",
  },
};

export const STREAMS_AI_CREDIT_PACKS = [
  { credits: 500, priceUsd: 49 },
  { credits: 1200, priceUsd: 99 },
  { credits: 3000, priceUsd: 199 },
  { credits: 8000, priceUsd: 399 },
] as const;

export const STREAMS_AI_FEATURE_COSTS: StreamsAIFeatureCost[] = [
  { key: "operator_chat", label: "AI Operator Chat", draft: 0, final: 0 },
  { key: "business_builder", label: "Business Builder", draft: 2, final: 10 },
  { key: "income_potential", label: "Revenue / Income Potential", draft: 2, final: 8 },
  { key: "content_generator", label: "Content Generator", draft: 3, final: 12 },
  { key: "document_plan_builder", label: "Document / Plan Builder", draft: 6, final: 30 },
  { key: "code_troubleshooting", label: "Code / Troubleshooting", draft: 8, final: 45 },
  { key: "image_studio", label: "AI Image Studio", draft: 8, final: 25 },
  { key: "four_image_pack", label: "4-image pack", draft: 25, final: 75 },
  { key: "photo_to_motion", label: "Photo 2 Motion", draft: 60, final: 180 },
  { key: "text_to_video", label: "Text 2 Video", draft: 75, final: 220 },
  { key: "voice_studio", label: "AI Voice Studio", draft: 10, final: 35 },
  { key: "captions_subtitles", label: "Captions/Subtitles", draft: 5, final: 20 },
  { key: "turn_this_into_you", label: "Turn This Into You", draft: 80, final: 260 },
  { key: "website_preview", label: "Website Preview", draft: 15, final: 60 },
  { key: "launch_plan", label: "Launch Plan", draft: 8, final: 35 },
];

export const STREAMS_AI_USAGE_MESSAGES = {
  approachingIncludedLimit:
    "You’re close to your included usage for this session. You can keep working until reset, or enable usage credits to continue without stopping.",
  freeLimitReached: "You’ve used your free included usage. You can wait for your reset or upgrade to keep building now.",
  paidLimitCreditsOff:
    "You’ve reached your included session usage. Turn on usage credits to keep building now, or wait for your included usage to reset.",
  paidLimitCreditsOn:
    "You’ve reached your included session usage. Streams AI can continue using paid usage credits until your included usage resets.",
  lowBalance: "Your usage credit balance is running low. Add credits or turn on auto-reload to keep building without interruption.",
  autoReloadSetup:
    "Automatically add usage credits when your balance gets low. You control the threshold, top-up amount, and monthly spend limit.",
  spendLimitReached:
    "You’ve reached your monthly usage-credit spend limit. Raise your limit, wait for the next billing cycle, or use included usage after it resets.",
  paymentMethodMissing: "Add a payment method to turn on usage credits or auto-reload.",
  backendSetupUnavailable:
    "This account control is not fully set up yet. Your current work is safe, but this action cannot run until account usage is connected.",
  premiumActionBlocked: "This action uses premium generation credits. Upgrade or add usage credits to continue.",
  actionAllowed: "Usage approved. Building now.",
};

export function normalizeStreamsAIPlanId(value: unknown): StreamsAIPlanId {
  if (typeof value !== "string") return "free_builder";
  const normalized = value.trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (normalized in STREAMS_AI_PLAN_POLICIES) return normalized as StreamsAIPlanId;
  if (normalized.includes("agency")) return "agency_studio";
  if (normalized.includes("launch")) return "launch_studio";
  if (normalized.includes("creator")) return "creator_studio";
  if (normalized.includes("pro")) return "pro_builder";
  if (normalized.includes("plus")) return "plus_operator";
  return "free_builder";
}

export function getStreamsAIPlanPolicy(value: unknown) {
  return STREAMS_AI_PLAN_POLICIES[normalizeStreamsAIPlanId(value)];
}

export function getStreamsAIFeatureCost(featureKey: unknown, stage: unknown) {
  const feature = STREAMS_AI_FEATURE_COSTS.find((item) => item.key === featureKey) || STREAMS_AI_FEATURE_COSTS[0];
  return stage === "draft" ? feature.draft : feature.final;
}
