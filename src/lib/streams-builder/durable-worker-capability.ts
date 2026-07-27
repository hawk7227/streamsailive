export const STREAMS_DURABLE_WORKER_FEATURE_KEY = "streams_builder_durable_worker" as const;

export type DurableWorkerCapability = {
  featureKey: typeof STREAMS_DURABLE_WORKER_FEATURE_KEY;
  productArea: "streams-builder";
  displayName: string;
  description: string;
  monetization: {
    upsellEligible: true;
    defaultEntitlement: "internal" | "premium";
    meterableDimensions: string[];
  };
  execution: {
    backend: "remote-worker";
    durable: true;
    tenantIsolated: true;
    approvalGated: true;
    evidenceRequired: true;
    available: boolean;
    blockers: string[];
  };
  responsibilities: string[];
};

function hasEnv(name: string): boolean {
  return typeof process.env[name] === "string" && process.env[name]!.trim().length > 0;
}

export function getDurableWorkerCapability(): DurableWorkerCapability {
  const blockers: string[] = [];
  if (!hasEnv("STREAMS_BUILDER_WORKER_URL")) blockers.push("STREAMS_BUILDER_WORKER_URL");
  if (!hasEnv("STREAMS_BUILDER_WORKER_TOKEN")) blockers.push("STREAMS_BUILDER_WORKER_TOKEN");

  return {
    featureKey: STREAMS_DURABLE_WORKER_FEATURE_KEY,
    productArea: "streams-builder",
    displayName: "Streams Builder Durable Execution",
    description:
      "A persistent, source-aware execution environment for long-running engineering work outside Vercel's ephemeral serverless runtime.",
    monetization: {
      upsellEligible: true,
      defaultEntitlement: "internal",
      meterableDimensions: [
        "worker_minutes",
        "workspace_storage_gb_hours",
        "build_minutes",
        "browser_verification_minutes",
        "repository_operations",
      ],
    },
    execution: {
      backend: "remote-worker",
      durable: true,
      tenantIsolated: true,
      approvalGated: true,
      evidenceRequired: true,
      available: blockers.length === 0,
      blockers,
    },
    responsibilities: [
      "persistent project workspaces",
      "repository cloning and synchronization",
      "branch and working-tree management",
      "source-truth file discovery",
      "safe file reads, writes, and exact patches",
      "dependency installation and controlled command execution",
      "type checking, linting, tests, and production builds",
      "browser and preview verification",
      "Git status, commit, push, and deployment verification",
      "bounded repair loops with execution logs and proof",
      "tenant and project isolation",
      "health checks and commissioning tests",
    ],
  };
}
