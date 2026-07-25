export type OpenAIProviderFailure = {
  code: string;
  retryable: boolean;
  requestId?: string;
  status?: number;
  type?: string;
  detail: string;
};

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const DEFAULT_DELAYS_MS = [1_000, 2_000, 4_000] as const;

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

function parseJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") return asRecord(value);
  try { return asRecord(JSON.parse(value)); } catch { return null; }
}

function requestIdFrom(value: unknown): string | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const direct = record.request_id ?? record.requestId ?? record["x-request-id"];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const message = typeof record.message === "string" ? record.message : "";
  return message.match(/request ID\s+([a-zA-Z0-9-]+)/i)?.[1];
}

export function normalizeOpenAIProviderFailure(error: unknown): OpenAIProviderFailure {
  const record = asRecord(error);
  const statusValue = record?.status ?? record?.statusCode;
  const status = typeof statusValue === "number" ? statusValue : undefined;
  const payload = parseJson(record?.body) ?? parseJson(record?.detail) ?? parseJson(record?.message);
  const nested = asRecord(payload?.error) ?? payload;
  const type = typeof nested?.type === "string" ? nested.type : undefined;
  const providerCode = typeof nested?.code === "string" ? nested.code : undefined;
  const detail = (typeof nested?.message === "string" && nested.message) || (typeof record?.message === "string" && record.message) || String(error);
  const retryable = (status !== undefined && RETRYABLE_STATUSES.has(status)) || type === "server_error" || providerCode === "server_error" || providerCode === "rate_limit_exceeded";
  const code = type === "server_error" || providerCode === "server_error"
    ? "openai_server_error"
    : status === 429 || providerCode === "rate_limit_exceeded"
      ? "openai_rate_limit"
      : status && RETRYABLE_STATUSES.has(status)
        ? `openai_http_${status}`
        : "openai_provider_error";
  return { code, retryable, requestId: requestIdFrom(error) ?? requestIdFrom(payload), status, type, detail };
}

export async function withOpenAIRetry<T>(
  operation: () => Promise<T>,
  options: { maxAttempts?: number; delaysMs?: readonly number[]; onRetry?: (failure: OpenAIProviderFailure, nextAttempt: number, delayMs: number) => void | Promise<void> } = {},
): Promise<T> {
  const delaysMs = options.delaysMs ?? DEFAULT_DELAYS_MS;
  const maxAttempts = Math.max(1, options.maxAttempts ?? delaysMs.length + 1);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      const failure = normalizeOpenAIProviderFailure(error);
      if (!failure.retryable || attempt >= maxAttempts) {
        throw Object.assign(new Error(failure.detail), { name: "OpenAIProviderError", providerFailure: failure });
      }
      const delayMs = delaysMs[Math.min(attempt - 1, delaysMs.length - 1)] ?? 4_000;
      await options.onRetry?.(failure, attempt + 1, delayMs);
      await sleep(delayMs);
    }
  }
  throw new Error("OPENAI_RETRY_EXHAUSTED");
}
