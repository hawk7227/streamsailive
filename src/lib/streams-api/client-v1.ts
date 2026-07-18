import type { StreamsV1ErrorEnvelope, StreamsV1Route } from "./v1-contract";

export class StreamsV1ClientError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "StreamsV1ClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type StreamsV1ClientOptions = {
  baseUrl?: string;
  accessToken?: string | null;
  fetcher?: typeof fetch;
};

export type StreamsV1RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | null | undefined | Array<string | number>>;
  body?: unknown;
  idempotencyKey?: string | null;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

function appendQuery(url: URL, query: StreamsV1RequestOptions["query"]) {
  for (const [key, raw] of Object.entries(query || {})) {
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (value === undefined || value === null) continue;
      url.searchParams.append(key, String(value));
    }
  }
}

export class StreamsV1Client {
  private baseUrl: string;
  private accessToken: string | null;
  private fetcher: typeof fetch;

  constructor(options: StreamsV1ClientOptions = {}) {
    this.baseUrl = (options.baseUrl || "").replace(/\/$/, "");
    this.accessToken = options.accessToken || null;
    this.fetcher = options.fetcher || fetch;
  }

  setAccessToken(accessToken: string | null) {
    this.accessToken = accessToken;
  }

  async request<T>(route: StreamsV1Route | string, options: StreamsV1RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${route}`, this.baseUrl || "http://localhost");
    appendQuery(url, options.query);
    const headers: Record<string, string> = { Accept: "application/json", ...(options.headers || {}) };
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
    if (options.body !== undefined && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";

    const response = await this.fetcher(url.toString(), {
      method: options.method || (options.body === undefined ? "GET" : "POST"),
      headers,
      body: options.body === undefined ? undefined : options.body instanceof FormData ? options.body : JSON.stringify(options.body),
      signal: options.signal,
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({ ok: false, apiVersion: "v1", error: response.statusText })) as T | StreamsV1ErrorEnvelope;
    if (!response.ok || (payload as StreamsV1ErrorEnvelope)?.ok === false) {
      const error = payload as StreamsV1ErrorEnvelope;
      throw new StreamsV1ClientError(error.error || response.statusText, response.status, error.code, error.details);
    }
    return payload as T;
  }

  auth() { return this.request("/api/v1/auth"); }
  devices(query?: StreamsV1RequestOptions["query"]) { return this.request("/api/v1/devices", { query }); }
  projects(query?: StreamsV1RequestOptions["query"]) { return this.request("/api/v1/projects", { query }); }
  conversations(query?: StreamsV1RequestOptions["query"]) { return this.request("/api/v1/conversations", { query }); }
  messages(query?: StreamsV1RequestOptions["query"]) { return this.request("/api/v1/messages", { query }); }
  jobs(query?: StreamsV1RequestOptions["query"]) { return this.request("/api/v1/jobs", { query }); }
  jobEvents(query?: StreamsV1RequestOptions["query"]) { return this.request("/api/v1/job-events", { query }); }
  assets(query?: StreamsV1RequestOptions["query"]) { return this.request("/api/v1/assets", { query }); }
  uploads(query?: StreamsV1RequestOptions["query"]) { return this.request("/api/v1/uploads", { query }); }
  memory(query?: StreamsV1RequestOptions["query"]) { return this.request("/api/v1/memory", { query }); }
  settings(query?: StreamsV1RequestOptions["query"]) { return this.request("/api/v1/settings", { query }); }
  subscriptions(query?: StreamsV1RequestOptions["query"]) { return this.request("/api/v1/subscriptions", { query }); }
  entitlements(query?: StreamsV1RequestOptions["query"]) { return this.request("/api/v1/entitlements", { query }); }
  usage(query?: StreamsV1RequestOptions["query"]) { return this.request("/api/v1/usage", { query }); }
  notifications(query?: StreamsV1RequestOptions["query"]) { return this.request("/api/v1/notifications", { query }); }
  featureFlags(query?: StreamsV1RequestOptions["query"]) { return this.request("/api/v1/feature-flags", { query }); }

  createUpload(body: unknown, idempotencyKey?: string) {
    return this.request("/api/v1/uploads", { method: "POST", body, idempotencyKey });
  }

  uploadChunk(input: { uploadId: string; chunkIndex: number; byteOffset: number; chunk: Blob; checksum?: string }) {
    const form = new FormData();
    form.set("uploadId", input.uploadId);
    form.set("chunkIndex", String(input.chunkIndex));
    form.set("byteOffset", String(input.byteOffset));
    if (input.checksum) form.set("checksum", input.checksum);
    form.set("chunk", input.chunk, `chunk-${input.chunkIndex}`);
    return this.request("/api/v1/uploads", { method: "POST", body: form });
  }
}

export type StreamsSseEvent = { event: string; data: string; id?: string; retry?: number };

export function parseStreamsSseChunk(chunk: string, carry = "") {
  const text = carry + chunk.replace(/\r\n/g, "\n");
  const blocks = text.split("\n\n");
  const remainder = blocks.pop() || "";
  const events: StreamsSseEvent[] = [];
  for (const block of blocks) {
    let event = "message";
    let id: string | undefined;
    let retry: number | undefined;
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue;
      const separator = line.indexOf(":");
      const field = separator >= 0 ? line.slice(0, separator) : line;
      const value = separator >= 0 ? line.slice(separator + 1).replace(/^ /, "") : "";
      if (field === "event") event = value;
      if (field === "data") data.push(value);
      if (field === "id") id = value;
      if (field === "retry" && Number.isFinite(Number(value))) retry = Number(value);
    }
    events.push({ event, data: data.join("\n"), ...(id !== undefined ? { id } : {}), ...(retry !== undefined ? { retry } : {}) });
  }
  return { events, carry: remainder };
}
