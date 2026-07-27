import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.PORT || process.env.STREAMS_PROVIDER_GATEWAY_PORT || 8090);
const AUTH_TOKEN = String(process.env.STREAMS_PROVIDER_GATEWAY_AUTH_TOKEN || "").trim();
const WINDOW_MS = Number(process.env.STREAMS_PROVIDER_GATEWAY_RATE_WINDOW_MS || 60_000);
const DEFAULT_LIMIT = Number(process.env.STREAMS_PROVIDER_GATEWAY_RATE_LIMIT || 60);
const BODY_LIMIT = 2 * 1024 * 1024;

if (!AUTH_TOKEN) {
  console.error(JSON.stringify({ level: "error", event: "GATEWAY_STARTUP_FAILED", reason: "STREAMS_PROVIDER_GATEWAY_AUTH_TOKEN is required" }));
  process.exit(1);
}

const rateWindows = new Map();
const idempotency = new Map();
const providerDefinitions = {
  openai: { key: "OPENAI_API_KEY", adapterUrl: "STREAMS_OPENAI_ADAPTER_URL", native: true },
  fal: { key: "FAL_API_KEY", adapterUrl: "STREAMS_FAL_ADAPTER_URL" },
  runway: { key: "RUNWAY_API_KEY", adapterUrl: "STREAMS_RUNWAY_ADAPTER_URL" },
  kling: { key: "KLING_API_KEY", adapterUrl: "STREAMS_KLING_ADAPTER_URL" },
  veo: { key: "VEO_API_KEY", adapterUrl: "STREAMS_VEO_ADAPTER_URL" },
  elevenlabs: { key: "ELEVENLABS_API_KEY", adapterUrl: "STREAMS_ELEVENLABS_ADAPTER_URL" },
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
}

function requestId(req) {
  return String(req.headers["x-streams-request-id"] || crypto.randomUUID());
}

function authorized(req) {
  const value = String(req.headers.authorization || "");
  if (!value.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(value.slice(7));
  const expected = Buffer.from(AUTH_TOKEN);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > BODY_LIMIT) throw new Error("REQUEST_BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function providerStatus(name) {
  const definition = providerDefinitions[name];
  const hasKey = Boolean(process.env[definition.key]?.trim());
  const adapterUrl = process.env[definition.adapterUrl]?.trim() || null;
  return {
    provider: name,
    configured: hasKey,
    transport: name === "openai" && hasKey ? "native" : adapterUrl && hasKey ? "adapter" : "unavailable",
    adapterConfigured: Boolean(adapterUrl),
  };
}

function applyRateLimit(body) {
  const identity = String(body.tenantId || body.workspaceId || body.userId || "anonymous");
  const planLimit = Number(body.rateLimit || DEFAULT_LIMIT);
  const now = Date.now();
  const current = rateWindows.get(identity);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    rateWindows.set(identity, { startedAt: now, count: 1 });
    return { allowed: true, remaining: Math.max(planLimit - 1, 0), resetAt: now + WINDOW_MS };
  }
  current.count += 1;
  return {
    allowed: current.count <= planLimit,
    remaining: Math.max(planLimit - current.count, 0),
    resetAt: current.startedAt + WINDOW_MS,
  };
}

function candidates(body) {
  const defaults = {
    image: ["openai", "fal"],
    video: ["runway", "kling", "veo", "fal"],
    image_to_video: ["runway", "kling", "veo", "fal"],
    voice: ["elevenlabs", "openai"],
    music: ["fal"],
    text: ["openai"],
  };
  const preferred = Array.isArray(body.preferredProviders) ? body.preferredProviders : [];
  const ordered = [...preferred, ...(defaults[body.capability] || [])];
  return [...new Set(ordered)].filter((name) => providerDefinitions[name]);
}

async function nativeOpenAI(body, rid) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw Object.assign(new Error("OpenAI is not configured"), { code: "PROVIDER_NOT_CONFIGURED", retryable: false });
  if (body.capability !== "image") {
    throw Object.assign(new Error("Native OpenAI transport currently supports image generation only"), { code: "CAPABILITY_NOT_IMPLEMENTED", retryable: false });
  }
  const prompt = String(body.prompt || body.input?.prompt || "").trim();
  if (!prompt) throw Object.assign(new Error("A prompt is required"), { code: "INVALID_REQUEST", retryable: false });
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-client-request-id": rid },
    body: JSON.stringify({
      model: String(body.input?.model || process.env.OPENAI_IMAGE_MODEL || "gpt-image-1"),
      prompt,
      size: String(body.input?.size || "1536x1024"),
      quality: String(body.input?.quality || "high"),
      output_format: "png",
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `OpenAI request failed with ${response.status}`);
    error.code = payload?.error?.code || "PROVIDER_REQUEST_FAILED";
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }
  const item = Array.isArray(payload.data) ? payload.data[0] : null;
  const outputUrl = item?.url || null;
  const base64 = item?.b64_json || null;
  if (!outputUrl && !base64) throw Object.assign(new Error("Provider returned no image"), { code: "EMPTY_PROVIDER_OUTPUT", retryable: true });
  return {
    status: "completed",
    outputUrl,
    inlineBase64: base64,
    mimeType: "image/png",
    externalId: payload.id || rid,
    model: payload.model || body.input?.model || process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
    usage: payload.usage || {},
  };
}

async function adapterRequest(provider, body, rid) {
  const definition = providerDefinitions[provider];
  const key = process.env[definition.key]?.trim();
  const url = process.env[definition.adapterUrl]?.trim();
  if (!key || !url) throw Object.assign(new Error(`${provider} adapter is not configured`), { code: "PROVIDER_NOT_CONFIGURED", retryable: false });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "x-streams-request-id": rid,
    },
    body: JSON.stringify({ ...body, provider, requestId: rid }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `${provider} adapter failed with ${response.status}`);
    error.code = payload?.error?.code || "PROVIDER_REQUEST_FAILED";
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }
  return payload;
}

async function executeProvider(provider, body, rid) {
  if (provider === "openai" && providerStatus(provider).transport === "native") return nativeOpenAI(body, rid);
  return adapterRequest(provider, body, rid);
}

async function handleGenerate(req, res, rid) {
  const body = await readBody(req);
  const startedAt = Date.now();
  const limit = applyRateLimit(body);
  if (!limit.allowed) {
    return json(res, 429, { ok: false, requestId: rid, status: "failed", error: { code: "RATE_LIMITED", message: "Provider gateway rate limit exceeded", retryable: true }, rateLimit: limit });
  }

  const key = String(body.idempotencyKey || "").trim();
  if (key && idempotency.has(key)) return json(res, 200, idempotency.get(key));

  if (!body.capability) return json(res, 400, { ok: false, requestId: rid, status: "failed", error: { code: "INVALID_REQUEST", message: "capability is required", retryable: false } });

  const attempts = [];
  const providerList = candidates(body);
  const allowFailover = body.allowFailover !== false;
  for (const provider of providerList) {
    if (!providerStatus(provider).configured) {
      attempts.push({ provider, ok: false, code: "PROVIDER_NOT_CONFIGURED" });
      continue;
    }
    try {
      const result = await executeProvider(provider, body, rid);
      const response = {
        ok: true,
        requestId: rid,
        provider,
        model: result.model || null,
        status: result.status || "completed",
        outputUrl: result.outputUrl || null,
        inlineBase64: result.inlineBase64 || null,
        externalId: result.externalId || null,
        mimeType: result.mimeType || null,
        usage: result.usage || {},
        attempts: [...attempts, { provider, ok: true }],
        elapsedMs: Date.now() - startedAt,
      };
      if (key) idempotency.set(key, response);
      console.log(JSON.stringify({ level: "info", event: "PROVIDER_GATEWAY_COMPLETED", requestId: rid, provider, capability: body.capability, elapsedMs: response.elapsedMs }));
      return json(res, 200, response);
    } catch (error) {
      const code = error?.code || "PROVIDER_REQUEST_FAILED";
      attempts.push({ provider, ok: false, code });
      console.error(JSON.stringify({ level: "error", event: "PROVIDER_GATEWAY_ATTEMPT_FAILED", requestId: rid, provider, capability: body.capability, code, message: error?.message }));
      if (!allowFailover || error?.retryable === false) break;
    }
  }

  const response = { ok: false, requestId: rid, status: "failed", attempts, error: { code: "ALL_PROVIDERS_FAILED", message: "No configured provider completed the request", retryable: true }, elapsedMs: Date.now() - startedAt };
  if (key) idempotency.set(key, response);
  return json(res, 502, response);
}

const server = http.createServer(async (req, res) => {
  const rid = requestId(req);
  if (!authorized(req)) return json(res, 401, { ok: false, requestId: rid, error: { code: "UNAUTHORIZED", message: "Authentication required", retryable: false } });
  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, { ok: true, service: "streams-provider-gateway", version: "v1", requestId: rid, providers: Object.keys(providerDefinitions).map(providerStatus), rateLimit: { windowMs: WINDOW_MS, defaultLimit: DEFAULT_LIMIT } });
    }
    if (req.method === "GET" && req.url === "/v1/providers") {
      return json(res, 200, { ok: true, requestId: rid, providers: Object.keys(providerDefinitions).map(providerStatus) });
    }
    if (req.method === "POST" && req.url === "/v1/generate") return await handleGenerate(req, res, rid);
    return json(res, 404, { ok: false, requestId: rid, error: { code: "NOT_FOUND", message: "Route not found", retryable: false } });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "PROVIDER_GATEWAY_UNHANDLED", requestId: rid, message: error instanceof Error ? error.message : String(error) }));
    return json(res, 500, { ok: false, requestId: rid, status: "failed", error: { code: "INTERNAL_ERROR", message: "Provider gateway could not complete the request", retryable: true } });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({ level: "info", event: "PROVIDER_GATEWAY_STARTED", port: PORT, providers: Object.keys(providerDefinitions).map(providerStatus) }));
});
