export type StreamsPlanId =
  | "free_builder"
  | "plus_operator"
  | "pro_builder"
  | "creator_studio"
  | "launch_studio"
  | "agency_studio";

export type StreamsResetWindow = "daily" | "monthly" | "purchased";
export type StreamsUsageBucket = "chat" | "operator" | "studio" | "video" | "launch" | "team";

export type StreamsPlan = {
  id: StreamsPlanId;
  name: string;
  monthlyPriceUsd: number;
  positioning: string;
  bestFor: string;
  includedMonthlyCredits: number;
  dailyCredits: number;
  dailyResetsAtLocalHour: number;
  dailyMessageLimit: number;
  includedBrands: number | "unlimited";
  includedProjects: number | "unlimited";
  watermarkExports: boolean;
  priority: "standard" | "priority" | "highest";
  overage: "upgrade_required" | "credit_pack" | "usage_pack" | "sales_contact";
  buckets: Record<StreamsUsageBucket, number>;
};

export type StreamsCreditPack = {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  expiresAfterDays: number;
  recommendedFor: string;
};

export type StreamsCapabilityCost = {
  id: string;
  label: string;
  category: "chat" | "builder" | "creator" | "image" | "video" | "voice" | "launch";
  draftCredits: number;
  finalCredits: number;
  dailyBucket: StreamsUsageBucket;
  freeAllowed: boolean;
  requiresPaidPlanForFinal: boolean;
};

export const STREAMS_FREE_SIGNUP = {
  welcomeCredits: 10,
  welcomeCreditsExpireDays: 7,
  monthlyCredits: 0,
  dailyCredits: 5,
  dailyMessageLimit: 20,
  includedBrands: 1,
  includedProjects: 1,
  note: "Free signup is for activation and proof of value, not open-ended generation.",
} as const;

export const STREAMS_PLANS: Record<StreamsPlanId, StreamsPlan> = {
  free_builder: {
    id: "free_builder",
    name: "Free Builder",
    monthlyPriceUsd: 0,
    positioning: "Try Streams AI and build one idea before upgrading.",
    bestFor: "New users testing one business or creator concept.",
    includedMonthlyCredits: 0,
    dailyCredits: 5,
    dailyResetsAtLocalHour: 0,
    dailyMessageLimit: 20,
    includedBrands: 1,
    includedProjects: 1,
    watermarkExports: true,
    priority: "standard",
    overage: "upgrade_required",
    buckets: { chat: 20, operator: 5, studio: 0, video: 0, launch: 0, team: 0 },
  },
  plus_operator: {
    id: "plus_operator",
    name: "Plus Operator",
    monthlyPriceUsd: 29,
    positioning: "Entry paid plan for serious daily AI Operator use.",
    bestFor: "Entrepreneurs who want more chat, builder actions, and saved concepts.",
    includedMonthlyCredits: 300,
    dailyCredits: 35,
    dailyResetsAtLocalHour: 0,
    dailyMessageLimit: 150,
    includedBrands: 3,
    includedProjects: 10,
    watermarkExports: false,
    priority: "standard",
    overage: "credit_pack",
    buckets: { chat: 150, operator: 35, studio: 20, video: 0, launch: 5, team: 0 },
  },
  pro_builder: {
    id: "pro_builder",
    name: "Pro Builder",
    monthlyPriceUsd: 59,
    positioning: "Main conversion plan for builders who want to create and launch.",
    bestFor: "Business builders, coaches, founders, ecommerce sellers, and SaaS planners.",
    includedMonthlyCredits: 900,
    dailyCredits: 85,
    dailyResetsAtLocalHour: 0,
    dailyMessageLimit: 400,
    includedBrands: "unlimited",
    includedProjects: "unlimited",
    watermarkExports: false,
    priority: "priority",
    overage: "credit_pack",
    buckets: { chat: 400, operator: 85, studio: 65, video: 20, launch: 15, team: 0 },
  },
  creator_studio: {
    id: "creator_studio",
    name: "Creator Studio",
    monthlyPriceUsd: 99,
    positioning: "High-margin plan for content creators and marketing-heavy users.",
    bestFor: "Creators producing images, scripts, captions, social research, and samples.",
    includedMonthlyCredits: 1800,
    dailyCredits: 160,
    dailyResetsAtLocalHour: 0,
    dailyMessageLimit: 900,
    includedBrands: "unlimited",
    includedProjects: "unlimited",
    watermarkExports: false,
    priority: "priority",
    overage: "credit_pack",
    buckets: { chat: 900, operator: 160, studio: 135, video: 55, launch: 20, team: 0 },
  },
  launch_studio: {
    id: "launch_studio",
    name: "Launch Studio",
    monthlyPriceUsd: 199,
    positioning: "Power plan for website, launch, generation, and go-live workflows.",
    bestFor: "Users building multiple brands, websites, launch plans, and marketing assets.",
    includedMonthlyCredits: 4500,
    dailyCredits: 350,
    dailyResetsAtLocalHour: 0,
    dailyMessageLimit: 2000,
    includedBrands: "unlimited",
    includedProjects: "unlimited",
    watermarkExports: false,
    priority: "highest",
    overage: "usage_pack",
    buckets: { chat: 2000, operator: 350, studio: 300, video: 140, launch: 80, team: 0 },
  },
  agency_studio: {
    id: "agency_studio",
    name: "Agency Studio",
    monthlyPriceUsd: 399,
    positioning: "Highest-profit team plan for agencies and serial builders.",
    bestFor: "Teams, agencies, and power users managing many client or brand workspaces.",
    includedMonthlyCredits: 12000,
    dailyCredits: 900,
    dailyResetsAtLocalHour: 0,
    dailyMessageLimit: 5000,
    includedBrands: "unlimited",
    includedProjects: "unlimited",
    watermarkExports: false,
    priority: "highest",
    overage: "sales_contact",
    buckets: { chat: 5000, operator: 900, studio: 750, video: 350, launch: 180, team: 10 },
  },
};

export const STREAMS_CREDIT_PACKS: StreamsCreditPack[] = [
  { id: "pack_500", name: "500 Credits", credits: 500, priceUsd: 49, expiresAfterDays: 365, recommendedFor: "Small generation refill" },
  { id: "pack_1200", name: "1,200 Credits", credits: 1200, priceUsd: 99, expiresAfterDays: 365, recommendedFor: "Creator refill" },
  { id: "pack_3000", name: "3,000 Credits", credits: 3000, priceUsd: 199, expiresAfterDays: 365, recommendedFor: "Launch campaigns" },
  { id: "pack_8000", name: "8,000 Credits", credits: 8000, priceUsd: 399, expiresAfterDays: 365, recommendedFor: "Agency production" },
];

export const STREAMS_CAPABILITY_COSTS: StreamsCapabilityCost[] = [
  { id: "chat_tool", label: "AI Operator Chat", category: "chat", draftCredits: 0, finalCredits: 0, dailyBucket: "chat", freeAllowed: true, requiresPaidPlanForFinal: false },
  { id: "business_builder", label: "Business Builder", category: "builder", draftCredits: 2, finalCredits: 10, dailyBucket: "operator", freeAllowed: true, requiresPaidPlanForFinal: false },
  { id: "income_potential", label: "Revenue / Income Potential", category: "builder", draftCredits: 2, finalCredits: 8, dailyBucket: "operator", freeAllowed: true, requiresPaidPlanForFinal: false },
  { id: "content_generator", label: "Content Generator", category: "creator", draftCredits: 3, finalCredits: 12, dailyBucket: "studio", freeAllowed: true, requiresPaidPlanForFinal: false },
  { id: "image_generation", label: "AI Image Studio", category: "image", draftCredits: 8, finalCredits: 25, dailyBucket: "studio", freeAllowed: false, requiresPaidPlanForFinal: true },
  { id: "image_pack", label: "4-Image Studio Pack", category: "image", draftCredits: 25, finalCredits: 75, dailyBucket: "studio", freeAllowed: false, requiresPaidPlanForFinal: true },
  { id: "image_to_video", label: "Photo 2 Motion Studio", category: "video", draftCredits: 60, finalCredits: 180, dailyBucket: "video", freeAllowed: false, requiresPaidPlanForFinal: true },
  { id: "text_to_video", label: "Text 2 Video Studio", category: "video", draftCredits: 75, finalCredits: 220, dailyBucket: "video", freeAllowed: false, requiresPaidPlanForFinal: true },
  { id: "voice_generation", label: "AI Voice Studio", category: "voice", draftCredits: 10, finalCredits: 35, dailyBucket: "studio", freeAllowed: false, requiresPaidPlanForFinal: true },
  { id: "captions", label: "Captions & Subtitles", category: "voice", draftCredits: 5, finalCredits: 20, dailyBucket: "studio", freeAllowed: true, requiresPaidPlanForFinal: false },
  { id: "turn_this_into_you", label: "Turn This Into You", category: "video", draftCredits: 80, finalCredits: 260, dailyBucket: "video", freeAllowed: false, requiresPaidPlanForFinal: true },
  { id: "website_preview", label: "Website Preview", category: "launch", draftCredits: 15, finalCredits: 60, dailyBucket: "launch", freeAllowed: false, requiresPaidPlanForFinal: true },
  { id: "launch_plan", label: "Launch Plan", category: "launch", draftCredits: 8, finalCredits: 35, dailyBucket: "launch", freeAllowed: true, requiresPaidPlanForFinal: false },
];

export function getStreamsPlan(planId: unknown): StreamsPlan {
  return STREAMS_PLANS[String(planId) as StreamsPlanId] || STREAMS_PLANS.free_builder;
}

export function getCapabilityCost(id: unknown): StreamsCapabilityCost {
  return STREAMS_CAPABILITY_COSTS.find((item) => item.id === String(id)) || STREAMS_CAPABILITY_COSTS[0];
}

export function getDailyLimit(planId: unknown, bucket: StreamsUsageBucket): number {
  return getStreamsPlan(planId).buckets[bucket] ?? 0;
}

export function shouldHardGate(planId: unknown, capabilityId: unknown, remainingDailyCredits: number): { allowed: boolean; reason?: string } {
  const plan = getStreamsPlan(planId);
  const capability = getCapabilityCost(capabilityId);
  if (plan.id === "free_builder" && capability.requiresPaidPlanForFinal) return { allowed: false, reason: "Upgrade required for final studio generation." };
  if (remainingDailyCredits < capability.finalCredits) return { allowed: false, reason: "Daily credits used. Wait for your reset or upgrade for more usage." };
  return { allowed: true };
}
