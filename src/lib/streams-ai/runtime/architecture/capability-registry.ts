import { getDurableWorkerCapability } from "@/lib/streams-builder/durable-worker-capability";
import { getProviderGatewayAvailability, STREAMS_PROVIDER_GATEWAY_CAPABILITY } from "@/lib/provider-gateway/capability";

export type RuntimeCapability = {
  name: string;
  available: boolean;
  actions: string[];
  authoritative: boolean;
  featureKey?: string;
  upsellEligible?: boolean;
  blockers?: string[];
};

export function getRuntimeCapabilityManifest() {
  const previewAvailable = true;
  const builderAvailable = Boolean(process.env.OPENAI_API_KEY);
  const durableWorker = getDurableWorkerCapability();
  const providerGateway = getProviderGatewayAvailability();

  return {
    version: "streams-runtime-capabilities-v3",
    generatedAt: new Date().toISOString(),
    architecture: {
      controlPlane: ["authentication", "conversation", "orchestration", "routing", "billing", "approvals", "session_state"],
      builderWorker: ["git", "browser", "builds", "testing", "repair", "filesystem", "deployment_verification"],
      providerGateway: ["provider_brokerage", "rate_limits", "audit_logs", "failover", "usage_metering", "secret_isolation"],
    },
    capabilities: {
      conversation: { name: "conversation", available: true, actions: ["respond", "explain_failure", "retry"], authoritative: true },
      websiteBuilder: { name: "websiteBuilder", available: builderAvailable, actions: ["create_frontend", "persist_source", "validate_html"], authoritative: true },
      durableBuilderWorker: {
        name: "durableBuilderWorker",
        available: durableWorker.execution.available,
        actions: [
          "workspace.ensure",
          "files.read",
          "files.write",
          "files.patch",
          "commands.run",
          "builds.run",
          "git.status",
          "git.commit",
          "git.push",
          "browser.verify",
          "deployment.verify",
          "repair.run",
          "commission.run",
        ],
        authoritative: true,
        featureKey: durableWorker.featureKey,
        upsellEligible: durableWorker.monetization.upsellEligible,
        blockers: durableWorker.execution.blockers,
      },
      providerGateway: {
        name: "providerGateway",
        available: providerGateway.available,
        actions: ["providers.health", "generation.submit", "generation.failover", "usage.record", "rate_limit.enforce"],
        authoritative: true,
        featureKey: STREAMS_PROVIDER_GATEWAY_CAPABILITY.featureKey,
        upsellEligible: STREAMS_PROVIDER_GATEWAY_CAPABILITY.upsellEligible,
        blockers: providerGateway.missing,
      },
      preview: { name: "preview", available: previewAvailable, actions: ["create", "open", "read_status"], authoritative: true },
      workspace: {
        name: "workspace",
        available: durableWorker.execution.available,
        actions: ["read", "write", "checkpoint"],
        authoritative: true,
        blockers: durableWorker.execution.blockers,
      },
      webSearch: { name: "webSearch", available: true, actions: ["search"], authoritative: false },
    } satisfies Record<string, RuntimeCapability>,
    productCapabilities: {
      streamsBuilderDurableExecution: durableWorker,
      streamsProviderGateway: {
        ...STREAMS_PROVIDER_GATEWAY_CAPABILITY,
        runtime: providerGateway,
      },
    },
  };
}
