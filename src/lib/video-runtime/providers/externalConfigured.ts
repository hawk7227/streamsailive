import type {
  ClipSpec,
  VideoMode,
  VideoProviderStatusResult,
  VideoProviderSubmitResult,
} from "../types";

export type ExternalVideoProviderId =
  | "luma"
  | "pika"
  | "sora"
  | "heygen"
  | "synthesia"
  | "descript";

type ExternalProviderConfig = {
  provider: ExternalVideoProviderId;
  submitEndpointEnv: string;
  pollEndpointEnv: string;
  apiKeyEnv: string;
  defaultModel: string;
};

const CONFIGS: Record<ExternalVideoProviderId, ExternalProviderConfig> = {
  luma: {
    provider: "luma",
    submitEndpointEnv: "LUMA_GENERATION_ENDPOINT",
    pollEndpointEnv: "LUMA_POLL_ENDPOINT",
    apiKeyEnv: "LUMA_API_KEY",
    defaultModel: "luma-default",
  },
  pika: {
    provider: "pika",
    submitEndpointEnv: "PIKA_GENERATION_ENDPOINT",
    pollEndpointEnv: "PIKA_POLL_ENDPOINT",
    apiKeyEnv: "PIKA_API_KEY",
    defaultModel: "pika-default",
  },
  sora: {
    provider: "sora",
    submitEndpointEnv: "SORA_GENERATION_ENDPOINT",
    pollEndpointEnv: "SORA_POLL_ENDPOINT",
    apiKeyEnv: "SORA_API_KEY",
    defaultModel: "sora-style-default",
  },
  heygen: {
    provider: "heygen",
    submitEndpointEnv: "HEYGEN_GENERATION_ENDPOINT",
    pollEndpointEnv: "HEYGEN_POLL_ENDPOINT",
    apiKeyEnv: "HEYGEN_API_KEY",
    defaultModel: "heygen-default",
  },
  synthesia: {
    provider: "synthesia",
    submitEndpointEnv: "SYNTHESIA_GENERATION_ENDPOINT",
    pollEndpointEnv: "SYNTHESIA_POLL_ENDPOINT",
    apiKeyEnv: "SYNTHESIA_API_KEY",
    defaultModel: "synthesia-default",
  },
  descript: {
    provider: "descript",
    submitEndpointEnv: "DESCRIPT_GENERATION_ENDPOINT",
    pollEndpointEnv: "DESCRIPT_POLL_ENDPOINT",
    apiKeyEnv: "DESCRIPT_API_KEY",
    defaultModel: "descript-default",
  },
};

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function getConfig(provider: string): ExternalProviderConfig | null {
  return CONFIGS[provider as ExternalVideoProviderId] ?? null;
}

function resolveOutputUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const candidates = [
    record.outputUrl,
    record.output_url,
    record.videoUrl,
    record.video_url,
    record.url,
    (record.data as Record<string, unknown> | undefined)?.outputUrl,
    (record.data as Record<string, unknown> | undefined)?.videoUrl,
    (record.result as Record<string, unknown> | undefined)?.outputUrl,
    (record.result as Record<string, unknown> | undefined)?.videoUrl,
  ];

  const found = candidates.find((value) => typeof value === "string" && value.trim());
  return typeof found === "string" ? found.trim() : null;
}

function resolveProviderJobId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const candidates = [
    record.id,
    record.jobId,
    record.job_id,
    record.taskId,
    record.task_id,
    record.generationId,
    record.generation_id,
    (record.data as Record<string, unknown> | undefined)?.id,
    (record.data as Record<string, unknown> | undefined)?.jobId,
    (record.result as Record<string, unknown> | undefined)?.id,
  ];

  const found = candidates.find((value) => typeof value === "string" && value.trim());
  return typeof found === "string" ? found.trim() : null;
}

function resolveStatus(data: unknown): VideoProviderStatusResult["status"] {
  if (!data || typeof data !== "object") return "processing";
  const record = data as Record<string, unknown>;
  const raw = String(
    record.status ??
    record.state ??
    (record.data as Record<string, unknown> | undefined)?.status ??
    (record.result as Record<string, unknown> | undefined)?.status ??
    "",
  ).toLowerCase();

  if (["completed", "complete", "succeeded", "success", "done", "finished"].includes(raw)) return "completed";
  if (["queued", "pending", "waiting"].includes(raw)) return "queued";
  if (["failed", "error", "cancelled", "canceled", "rejected"].includes(raw)) return "failed";
  return "processing";
}

export function getExternalVideoProviderIds(): ExternalVideoProviderId[] {
  return Object.keys(CONFIGS) as ExternalVideoProviderId[];
}

export function getDefaultExternalVideoModel(provider: string): string | null {
  return getConfig(provider)?.defaultModel ?? null;
}

export function isExternalVideoProvider(provider: string): provider is ExternalVideoProviderId {
  return !!getConfig(provider);
}

export function getExternalVideoProviderReadiness(provider: string) {
  const config = getConfig(provider);
  if (!config) return { ok: false, missing: ["UNKNOWN_PROVIDER"], provider };
  const missing = [config.apiKeyEnv, config.submitEndpointEnv].filter((name) => !readEnv(name));
  return { ok: missing.length === 0, missing, provider };
}

export async function submitExternalConfiguredVideo(args: {
  provider: string;
  clip: ClipSpec;
  model: string | null;
  mode: VideoMode;
  aspectRatio: string;
}): Promise<VideoProviderSubmitResult> {
  const config = getConfig(args.provider);
  if (!config) {
    return { accepted: false, provider: args.provider, providerJobId: null, status: "failed", raw: "unknown external provider" };
  }

  const apiKey = readEnv(config.apiKeyEnv);
  const endpoint = readEnv(config.submitEndpointEnv);
  if (!apiKey || !endpoint) {
    return {
      accepted: false,
      provider: args.provider,
      providerJobId: null,
      status: "failed",
      raw: {
        error: "external provider adapter is configured but missing env",
        missing: [config.apiKeyEnv, config.submitEndpointEnv].filter((name) => !readEnv(name)),
      },
    };
  }

  const body = {
    provider: args.provider,
    model: args.model || config.defaultModel,
    mode: args.mode,
    prompt: args.clip.prompt,
    imageUrl: args.clip.referenceImageUrl,
    durationSeconds: args.clip.durationSeconds,
    aspectRatio: args.aspectRatio,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const raw = await response.json().catch(() => ({ status: response.status, statusText: response.statusText }));
  if (!response.ok) {
    return { accepted: false, provider: args.provider, providerJobId: null, status: "failed", raw };
  }

  const outputUrl = resolveOutputUrl(raw);
  const providerJobId = resolveProviderJobId(raw) || outputUrl || crypto.randomUUID();
  const status = outputUrl ? "completed" : resolveStatus(raw);

  return {
    accepted: true,
    provider: args.provider,
    providerJobId,
    status,
    outputUrl,
    raw,
  };
}

export async function pollExternalConfiguredVideo(
  provider: string,
  providerJobId: string,
): Promise<VideoProviderStatusResult> {
  const config = getConfig(provider);
  if (!config) {
    return { provider, providerJobId, status: "failed", raw: "unknown external provider" };
  }

  const apiKey = readEnv(config.apiKeyEnv);
  const endpoint = readEnv(config.pollEndpointEnv);

  if (!endpoint) {
    // If submit returned a URL as the providerJobId, the job can finalize immediately.
    if (/^https?:\/\//.test(providerJobId)) {
      return { provider, providerJobId, status: "completed", outputUrl: providerJobId, raw: { directOutputUrl: providerJobId } };
    }
    return {
      provider,
      providerJobId,
      status: "failed",
      raw: { error: "missing poll endpoint", missing: [config.pollEndpointEnv] },
    };
  }

  const url = endpoint.replace("{jobId}", encodeURIComponent(providerJobId));
  const response = await fetch(url, {
    headers: {
      authorization: apiKey ? `Bearer ${apiKey}` : "",
      "x-api-key": apiKey,
    },
  });

  const raw = await response.json().catch(() => ({ status: response.status, statusText: response.statusText }));
  if (!response.ok) {
    return { provider, providerJobId, status: "failed", raw };
  }

  const outputUrl = resolveOutputUrl(raw);
  return {
    provider,
    providerJobId,
    status: outputUrl ? "completed" : resolveStatus(raw),
    outputUrl,
    raw,
  };
}
