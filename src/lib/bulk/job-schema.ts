export type BulkWorkspaceTab = "bulk_jobs" | "products" | "collections" | "seo" | "landing" | "library" | "campaigns";
export type BulkDesignTab = "templates" | "text" | "fonts" | "graphics" | "layouts" | "brand_kits" | "offers";

export type BulkJobStatus = "pending" | "claimed" | "running" | "completed" | "failed" | "cancelled";
export type BulkAspectRatio = "1:1" | "4:5" | "9:16" | "16:9";
export type CreativeLayoutFamily = "hero" | "split" | "stacked" | "comparison" | "collection";
export type CreativeTone = "clean" | "bold" | "minimal" | "premium";
export type CreativeAngle = "feature" | "benefit" | "lifestyle" | "conversion";
export type CreativeCtaIntent = "shop_now" | "learn_more" | "limited_offer" | "book_now";
export type CreativeKind = "ad" | "banner" | "landing_visual" | "seo_image" | "email_graphic" | "comparison_graphic" | "promo_block" | "product_image" | "lifestyle";
export type BulkProvider = "fal" | "openai" | "runway" | "kling" | "veo3";

export interface SafeZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextZone extends SafeZone {
  role: "headline" | "subheadline" | "cta" | "price" | "badge";
}

export interface CreativePlan {
  variantIndex: number;
  kind: CreativeKind;
  aspectRatio: BulkAspectRatio;
  layoutFamily: CreativeLayoutFamily;
  tone: CreativeTone;
  angle: CreativeAngle;
  ctaIntent: CreativeCtaIntent;
  headlineTone: "direct" | "curious" | "premium" | "urgent";
  safeZones: SafeZone[];
  textZones: TextZone[];
  templateId: string;
  score: number;
}

export interface BulkTask {
  id: string;
  kind: CreativeKind;
  provider: BulkProvider;
  size: string;
  aspectRatio: BulkAspectRatio;
  basePrompt: string;
  finalPrompt: string;
  plan: CreativePlan;
}

export interface BulkOutput {
  taskId: string;
  url: string;
  provider: BulkProvider;
  generationId?: string | null;
  storagePath?: string | null;
  bucket?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  createdAt: string;
  plan: CreativePlan;
}

export interface BulkManifest {
  jobId: string;
  prompt: string;
  sourceType: "prompt" | "document";
  total: number;
  completed: number;
  failed: number;
  outputs: BulkOutput[];
  errors: Array<{ taskId: string; message: string }>;
  exportedAt?: string | null;
  exportFileName?: string | null;
}

export interface BulkJobPayload {
  prompt: string;
  sourceType: "prompt" | "document";
  tasks: BulkTask[];
  manifest: BulkManifest;
  options: {
    requestedCount: number;
    requestedSize: string;
    selectedKinds: CreativeKind[];
    selectedAspects: BulkAspectRatio[];
  };
}

export interface PsdHeaderMetadata {
  signature: string;
  version: number;
  channels: number;
  height: number;
  width: number;
  depth: number;
  colorMode: number;
}
