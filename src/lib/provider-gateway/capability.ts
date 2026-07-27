export type ProviderGatewayProvider = "openai" | "fal" | "runway" | "kling" | "veo" | "elevenlabs";

export const STREAMS_PROVIDER_GATEWAY_CAPABILITY = {
  featureKey: "streams_provider_gateway",
  productArea: "streams-platform",
  name: "Streams Provider Gateway",
  description:
    "Central provider brokerage for AI generation with tenant-aware rate limits, audit logs, provider selection, failover, and secret isolation.",
  defaultEntitlement: "internal",
  upsellEligible: true,
  responsibilities: [
    "provider credential isolation",
    "tenant and plan rate limiting",
    "provider readiness and health",
    "request idempotency",
    "centralized request and outcome logging",
    "provider selection and ordered failover",
    "cost and usage metering",
    "safe error normalization",
  ],
  capabilities: ["image", "video", "image_to_video", "voice", "music", "text"],
  providers: ["openai", "fal", "runway", "kling", "veo", "elevenlabs"] as ProviderGatewayProvider[],
  meteringDimensions: [
    "gateway_requests",
    "provider_requests",
    "generated_images",
    "generated_video_seconds",
    "generated_audio_seconds",
    "provider_cost_usd",
    "failover_attempts",
  ],
  requiredControlPlaneEnvironment: [
    "STREAMS_PROVIDER_GATEWAY_URL",
    "STREAMS_PROVIDER_GATEWAY_TOKEN",
  ],
  requiredGatewayEnvironment: ["STREAMS_PROVIDER_GATEWAY_AUTH_TOKEN"],
  secretBoundary:
    "Provider API credentials belong in the Provider Gateway service. They must not be exposed to the browser or copied into project workspaces.",
} as const;

export function getProviderGatewayAvailability() {
  const missing = STREAMS_PROVIDER_GATEWAY_CAPABILITY.requiredControlPlaneEnvironment.filter(
    (name) => !process.env[name]?.trim(),
  );
  return {
    available: missing.length === 0,
    missing,
    mode: missing.length === 0 ? "remote-gateway" : "local-provider-runtime",
  } as const;
}
