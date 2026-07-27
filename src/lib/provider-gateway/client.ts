import type { ProviderGatewayProvider } from "./capability";

export type GatewayCapability = "image" | "video" | "image_to_video" | "voice" | "music" | "text";

export type ProviderGatewayRequest = {
  capability: GatewayCapability;
  prompt?: string;
  input?: Record<string, unknown>;
  tenantId?: string;
  userId?: string;
  workspaceId?: string;
  conversationId?: string;
  operationId?: string;
  idempotencyKey?: string;
  preferredProviders?: ProviderGatewayProvider[];
  allowFailover?: boolean;
};

export type ProviderGatewayResponse = {
  ok: boolean;
  requestId: string;
  provider?: ProviderGatewayProvider;
  model?: string | null;
  status: "completed" | "queued" | "processing" | "failed";
  outputUrl?: string | null;
  externalId?: string | null;
  mimeType?: string | null;
  usage?: Record<string, number>;
  attempts?: Array<{ provider: string; ok: boolean; code?: string }>;
  error?: { code: string; message: string; retryable: boolean };
};

function gatewayConfig() {
  const url = process.env.STREAMS_PROVIDER_GATEWAY_URL?.trim().replace(/\/$/, "");
  const token = process.env.STREAMS_PROVIDER_GATEWAY_TOKEN?.trim();
  return { url, token, configured: Boolean(url && token) };
}

export function isProviderGatewayConfigured() {
  return gatewayConfig().configured;
}

export async function executeThroughProviderGateway(
  request: ProviderGatewayRequest,
  signal?: AbortSignal,
): Promise<ProviderGatewayResponse> {
  const config = gatewayConfig();
  if (!config.configured || !config.url || !config.token) {
    throw new Error("PROVIDER_GATEWAY_NOT_CONFIGURED");
  }

  const response = await fetch(`${config.url}/v1/generate`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
      "x-streams-request-id": request.operationId || crypto.randomUUID(),
    },
    body: JSON.stringify(request),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as ProviderGatewayResponse | null;
  if (!response.ok || !payload) {
    throw new Error(`PROVIDER_GATEWAY_REQUEST_FAILED:${response.status}`);
  }
  return payload;
}

export async function getProviderGatewayHealth(signal?: AbortSignal) {
  const config = gatewayConfig();
  if (!config.configured || !config.url || !config.token) {
    return { configured: false, operational: false, providers: [] as unknown[] };
  }
  const response = await fetch(`${config.url}/health`, {
    headers: { authorization: `Bearer ${config.token}` },
    signal,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  return { configured: true, operational: response.ok, ...payload };
}
