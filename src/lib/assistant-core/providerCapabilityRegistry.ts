import "server-only";

export type ProviderCapabilityStatus =
  | "native_connected"
  | "adapter_connected"
  | "adapter_needed"
  | "knowledge_only";

export type ProviderCapability = {
  id: string;
  provider: string;
  category: string;
  capabilities: string[];
  streamsStatus: ProviderCapabilityStatus;
  currentStreamsRoute: string;
  envKeys: string[];
  adapterGap: string[];
  proofRequired: string[];
};

export const PROVIDER_CAPABILITY_REGISTRY_VERSION = "2026-06-13";

export const PROVIDER_CAPABILITY_REGISTRY: ProviderCapability[] = [
  {
    id: "openai-images",
    provider: "OpenAI Images",
    category: "image generation/editing",
    capabilities: ["text-to-image", "image editing", "reference image workflows", "asset generation", "prompt-conditioned visual creation"],
    streamsStatus: "native_connected",
    currentStreamsRoute: "generate_media(type=image) -> OpenAI image runtime/admingeneration",
    envKeys: ["OPENAI_API_KEY", "OPENAI_API_KEY_IMAGES", "OPENAI_IMAGE_MODEL"],
    adapterGap: ["expand explicit inpainting/reference editing UI if requested"],
    proofRequired: ["image URL", "artifact id", "provider/model", "prompt/result metadata"],
  },
  {
    id: "fal-ai",
    provider: "fal.ai",
    category: "multi-provider image/video generation",
    capabilities: ["image generation", "model-hosted image/video workflows", "provider fallback", "experimental model access"],
    streamsStatus: "native_connected",
    currentStreamsRoute: "generate_media -> fal runtime/admingeneration",
    envKeys: ["FAL_API_KEY", "FAL_KEY"],
    adapterGap: ["map each fal model to explicit model capability cards"],
    proofRequired: ["job status", "asset URL", "model/provider", "failure reason"],
  },
  {
    id: "runway",
    provider: "Runway",
    category: "video/image-to-video generation",
    capabilities: ["text-to-video", "image-to-video", "motion generation", "commercial video generation workflow"],
    streamsStatus: "adapter_connected",
    currentStreamsRoute: "generate_media(type=video/i2v) -> Runway provider route",
    envKeys: ["RUNWAY_API_KEY"],
    adapterGap: ["provider-specific polling/finalization parity", "advanced editor parity", "long-form timeline stitching"],
    proofRequired: ["provider", "job id", "status", "video URL", "error reason"],
  },
  {
    id: "kling",
    provider: "Kling",
    category: "video/image-to-video generation",
    capabilities: ["text-to-video", "image-to-video", "character/motion video generation", "high-motion clips"],
    streamsStatus: "adapter_connected",
    currentStreamsRoute: "generate_media(type=video/i2v) -> Kling provider route",
    envKeys: ["KLING_API_KEY", "KLING_ASSESS_API_KEY"],
    adapterGap: ["provider-specific advanced controls", "final video QC loop", "scene continuity memory"],
    proofRequired: ["provider", "job id", "status", "video URL", "error reason"],
  },
  {
    id: "veo",
    provider: "Veo",
    category: "video/image-to-video generation",
    capabilities: ["text-to-video", "image-to-video", "high-quality video generation", "cinematic scene output"],
    streamsStatus: "adapter_connected",
    currentStreamsRoute: "generate_media(type=video/i2v) -> Veo provider route",
    envKeys: ["VEO_API_KEY"],
    adapterGap: ["provider-specific request schema parity", "long-form scene planning", "advanced status polling"],
    proofRequired: ["provider", "job id", "status", "video URL", "error reason"],
  },
  {
    id: "elevenlabs",
    provider: "ElevenLabs",
    category: "voice/audio generation",
    capabilities: ["text-to-speech", "voice style", "narration", "speech output"],
    streamsStatus: "adapter_connected",
    currentStreamsRoute: "generate_voice(provider=elevenlabs)",
    envKeys: ["ELEVENLABS_API_KEY"],
    adapterGap: ["voice library browsing", "voice cloning management", "full dubbing workflow"],
    proofRequired: ["audio URL", "provider", "voice", "format", "error reason"],
  },
  {
    id: "openai-voice",
    provider: "OpenAI Voice",
    category: "voice/audio generation",
    capabilities: ["text-to-speech", "voice output", "narration"],
    streamsStatus: "adapter_connected",
    currentStreamsRoute: "generate_voice(provider=openai)",
    envKeys: ["OPENAI_API_KEY", "OPENAI_API_KEY_VOICE"],
    adapterGap: ["advanced voice controls and audio editing UI"],
    proofRequired: ["audio URL", "provider", "format", "error reason"],
  },
  {
    id: "suno-udio-style",
    provider: "Suno/Udio-style audio workflows",
    category: "song/music generation",
    capabilities: ["song generation", "lyrics", "instrumental mode", "genre/mood/tempo", "stems strategy"],
    streamsStatus: "adapter_ready",
    currentStreamsRoute: "generate_song -> song-runtime provider abstraction",
    envKeys: ["song provider key when connected"],
    adapterGap: ["connect concrete commercial song provider", "return final audio assets/stems", "provider-specific status polling"],
    proofRequired: ["audio URL", "lyrics/prompt", "provider", "duration", "status"],
  },
  {
    id: "luma-pika-sora-style",
    provider: "Luma / Pika / Sora-style providers",
    category: "video generation",
    capabilities: ["text-to-video", "image-to-video", "scene generation", "style/motion control"],
    streamsStatus: "adapter_needed",
    currentStreamsRoute: "not directly connected; use Runway/Kling/Veo/fal where available",
    envKeys: ["future provider API keys/endpoints"],
    adapterGap: ["provider API connector", "schema mapping", "polling/finalization", "asset storage", "QC loop"],
    proofRequired: ["adapter implementation", "test job", "asset URL", "provider status"],
  },
  {
    id: "midjourney-firefly-stability",
    provider: "Midjourney / Adobe Firefly / Stability",
    category: "image generation/editing",
    capabilities: ["image generation", "brand/design assets", "style control", "creative image workflows"],
    streamsStatus: "adapter_needed",
    currentStreamsRoute: "not directly connected; use OpenAI Images/fal where available",
    envKeys: ["future provider keys/endpoints"],
    adapterGap: ["official provider connector", "model selection", "asset storage", "rights/commercial-use metadata"],
    proofRequired: ["adapter implementation", "image URL", "provider/model", "rights/status metadata"],
  },
  {
    id: "heygen-synthesia-descript",
    provider: "HeyGen / Synthesia / Descript",
    category: "avatar/video/audio editing",
    capabilities: ["avatar video", "dubbing", "script-to-video", "screen/audio editing", "caption workflows"],
    streamsStatus: "adapter_needed",
    currentStreamsRoute: "not directly connected; use Streams voice/video/editor primitives where available",
    envKeys: ["future provider keys/endpoints"],
    adapterGap: ["avatar/dubbing provider connector", "timeline import/export", "caption/translation sync", "asset proof"],
    proofRequired: ["adapter implementation", "video/audio URL", "script/caption metadata", "provider status"],
  },
  {
    id: "codex-cursor-devin-class",
    provider: "Codex / Claude Code / Cursor / Devin / Replit Agent / Copilot Agent",
    category: "coding agents and repo automation",
    capabilities: ["repo understanding", "file edits", "patches", "commands", "tests", "repair loop", "PR/deploy proof", "approval gates"],
    streamsStatus: "adapter_connected",
    currentStreamsRoute: "Streams Builder source truth + workspace tools + GitHub/Vercel APIs",
    envKeys: ["GITHUB_TOKEN", "GH_TOKEN", "VERCEL_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "CONNECTOR_ENCRYPTION_KEY"],
    adapterGap: ["full cloud sandbox parity", "long-running autonomous task queues", "PR review thread automation", "richer eval suite"],
    proofRequired: ["changed files", "diff", "build/test logs", "browser proof", "commit/deploy"],
  },
  {
    id: "v0-bolt-lovable-builder-class",
    provider: "v0 / Bolt / Lovable / Builder.io / Locofy / Codia / Figma / Framer / Webflow",
    category: "app builders and design-to-code systems",
    capabilities: ["prompt-to-app", "screenshot-to-code", "design-to-code", "component mapping", "visual editing", "deployment"],
    streamsStatus: "adapter_connected",
    currentStreamsRoute: "Streams Builder visual/frontend workflow + repo execution + browser proof",
    envKeys: ["GITHUB_TOKEN", "VERCEL_TOKEN", "browser verification environment"],
    adapterGap: ["Figma API import", "real DOM visual editor writeback", "component provenance graph", "pixel-diff scoring"],
    proofRequired: ["route URL", "component path", "screenshot proof", "responsive check", "deployment"],
  },
  {
    id: "mcp-zapier-n8n-class",
    provider: "MCP / Zapier / Make / n8n / workflow engines",
    category: "system builders and automation",
    capabilities: ["tool registry", "workflow automation", "triggers/actions", "queues", "workers", "approval gates", "observability"],
    streamsStatus: "adapter_connected",
    currentStreamsRoute: "assistant tools + Streams Builder APIs + Supabase jobs/events + worker routes",
    envKeys: ["SUPABASE_SERVICE_ROLE_KEY", "CONNECTOR_ENCRYPTION_KEY", "provider keys as needed"],
    adapterGap: ["external workflow provider connectors", "visual workflow graph", "retry/idempotency dashboard", "scheduled condition watches"],
    proofRequired: ["workflow definition", "job/event log", "status", "retry/failure result", "approval record"],
  },
];

export function buildProviderCapabilityPrompt(): string {
  const lines = [
    `--- Provider capability registry v${PROVIDER_CAPABILITY_REGISTRY_VERSION} ---`,
    "This registry prevents fake parity claims. Use it to decide whether Streams can execute natively, via existing adapter, needs an adapter, or can only provide knowledge.",
  ];

  for (const item of PROVIDER_CAPABILITY_REGISTRY) {
    lines.push(`Provider: ${item.provider}`);
    lines.push(`Category: ${item.category}`);
    lines.push(`Streams status: ${item.streamsStatus}`);
    lines.push(`Capabilities: ${item.capabilities.join("; ")}`);
    lines.push(`Current Streams route: ${item.currentStreamsRoute}`);
    lines.push(`Env/access: ${item.envKeys.join(", ")}`);
    lines.push(`Adapter gap: ${item.adapterGap.join("; ")}`);
    lines.push(`Proof required: ${item.proofRequired.join(", ")}`);
  }

  lines.push("--- End provider capability registry ---");
  return lines.join("\n");
}
