export type StreamsCapabilityKind =
  | "chat_tool"
  | "code_audit"
  | "file_analysis"
  | "image_generation"
  | "image_to_video"
  | "text_to_video"
  | "voice_generation"
  | "music_generation"
  | "preview_action"
  | "build_audit"
  | "repository_execution";

export type StreamsCapabilityProduct = {
  kind: StreamsCapabilityKind;
  productId: string;
  displayName: string;
  estimatedCredits: number;
  entitlementRequired: boolean;
  executionStatus: "wired" | "implemented_unproven" | "blocked";
};

export const STREAMS_CAPABILITY_PRODUCTS: StreamsCapabilityProduct[] = [
  { kind: "chat_tool", productId: "streams-ai", displayName: "STREAMS AI Chat", estimatedCredits: 0, entitlementRequired: true, executionStatus: "wired" },
  { kind: "code_audit", productId: "streams-ai", displayName: "STREAMS Code Audit", estimatedCredits: 0, entitlementRequired: true, executionStatus: "wired" },
  { kind: "file_analysis", productId: "streams-ai", displayName: "STREAMS File Analysis", estimatedCredits: 0, entitlementRequired: true, executionStatus: "implemented_unproven" },
  { kind: "image_generation", productId: "text-2-image", displayName: "Text 2 Image Studio", estimatedCredits: 1, entitlementRequired: true, executionStatus: "implemented_unproven" },
  { kind: "image_to_video", productId: "photo-2-motion", displayName: "Photo 2 Motion Studio", estimatedCredits: 6, entitlementRequired: true, executionStatus: "blocked" },
  { kind: "text_to_video", productId: "text-2-video", displayName: "Text 2 Video Studio", estimatedCredits: 8, entitlementRequired: true, executionStatus: "blocked" },
  { kind: "voice_generation", productId: "voice-captions", displayName: "Voice & Captions Studio", estimatedCredits: 2, entitlementRequired: true, executionStatus: "blocked" },
  { kind: "music_generation", productId: "voice-captions", displayName: "Music / Song Studio", estimatedCredits: 4, entitlementRequired: true, executionStatus: "blocked" },
  { kind: "preview_action", productId: "streams-ai", displayName: "Preview Action", estimatedCredits: 0, entitlementRequired: true, executionStatus: "implemented_unproven" },
  { kind: "build_audit", productId: "streams-ai", displayName: "Build Audit", estimatedCredits: 0, entitlementRequired: true, executionStatus: "wired" },
  { kind: "repository_execution", productId: "streams-builder", displayName: "Streams Repository Execution", estimatedCredits: 0, entitlementRequired: true, executionStatus: "implemented_unproven" },
];

export function normalizeCapabilityKind(value: unknown): StreamsCapabilityKind {
  const text = String(value || "chat_tool").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const match = STREAMS_CAPABILITY_PRODUCTS.find((item) => item.kind === text);
  return match?.kind || "chat_tool";
}

export function getCapabilityProduct(kindOrValue: unknown) {
  const kind = normalizeCapabilityKind(kindOrValue);
  return STREAMS_CAPABILITY_PRODUCTS.find((item) => item.kind === kind) || STREAMS_CAPABILITY_PRODUCTS[0];
}

export function recommendCapabilityFromText(message = "") {
  const text = String(message || "").toLowerCase();
  if (/image\s*to\s*video|photo\s*to\s*motion|animate|motion/.test(text)) return getCapabilityProduct("image_to_video");
  if (/text\s*to\s*video|video|film|clip/.test(text)) return getCapabilityProduct("text_to_video");
  if (/image|photo|picture|visual|logo|thumbnail|banner|product photo/.test(text)) return getCapabilityProduct("image_generation");
  if (/voice|caption|audio|tts|dub|transcript/.test(text)) return getCapabilityProduct("voice_generation");
  if (/music|song|soundtrack|jingle/.test(text)) return getCapabilityProduct("music_generation");
  if (/repo|repository|clone|git|commit|pull request|push|unified diff|patch|npm run build/.test(text)) return getCapabilityProduct("repository_execution");
  if (/code|audit|debug|build/.test(text)) return getCapabilityProduct("code_audit");
  return getCapabilityProduct("chat_tool");
}
