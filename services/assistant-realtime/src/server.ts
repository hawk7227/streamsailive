import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { WebSocketServer, type RawData, type WebSocket } from "ws";

type Logger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

type ClientInboundMessage = {
  message?: string;
  messages?: Array<{ role?: string; content?: unknown }>;
  context?: Record<string, unknown>;
};

const PORT = Number(process.env.PORT || process.env.ASSISTANT_REALTIME_PORT || 3011);
const HOST = process.env.HOST || process.env.ASSISTANT_REALTIME_HOST || "0.0.0.0";
const WS_PATH = process.env.ASSISTANT_REALTIME_PATH || "/api/assistant/realtime";
const HEALTH_PATH = process.env.ASSISTANT_REALTIME_HEALTH_PATH || "/healthz";
const UPSTREAM_ASSISTANT_URL = process.env.UPSTREAM_ASSISTANT_URL;

if (!UPSTREAM_ASSISTANT_URL || !isValidHttpUrl(UPSTREAM_ASSISTANT_URL)) {
  process.stderr.write(
    JSON.stringify({
      level: "error",
      message: "FATAL: UPSTREAM_ASSISTANT_URL is missing or invalid",
      value: UPSTREAM_ASSISTANT_URL ?? "(not set)",
    }) + "\n",
  );
  process.exit(1);
}

const logger = createLogger();

const server = http.createServer((request, response) => {
  handleHttpRequest(request, response, logger);
});

const wss = new WebSocketServer({
  server,
  path: WS_PATH,
});

wss.on("connection", (socket, request) => {
  logger.info("assistant realtime connection opened", {
    path: request.url || WS_PATH,
    remoteAddress: request.socket.remoteAddress || null,
  });

  socket.on("message", async (data: RawData) => {
    await handleSocketMessage(socket, data, logger);
  });

  socket.on("close", (code, reason) => {
    logger.info("assistant realtime connection closed", {
      code,
      reason: reason.toString("utf8"),
    });
  });

  socket.on("error", (error) => {
    logger.error("assistant realtime socket error", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
});

wss.on("listening", () => {
  logger.info("assistant realtime websocket listening", {
    host: HOST,
    port: PORT,
    wsPath: WS_PATH,
    upstreamAssistantUrl: UPSTREAM_ASSISTANT_URL,
  });
});

wss.on("error", (error) => {
  logger.error("assistant realtime websocket server error", {
    error: error instanceof Error ? error.message : String(error),
  });
});

server.on("listening", () => {
  logger.info("assistant realtime http server listening", {
    host: HOST,
    port: PORT,
    healthPath: HEALTH_PATH,
    wsPath: WS_PATH,
  });
});

server.on("error", (error) => {
  logger.error("assistant realtime http server error", {
    error: error instanceof Error ? error.message : String(error),
  });
});

server.listen(PORT, HOST);

function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  log: Logger,
): void {
  const requestUrl = request.url || "/";

  if (requestUrl === HEALTH_PATH) {
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(
      JSON.stringify({
        ok: true,
        service: "assistant-realtime",
        wsPath: WS_PATH,
      }),
    );
    return;
  }

  log.warn("assistant realtime unexpected http request", {
    method: request.method || "GET",
    url: requestUrl,
  });

  response.statusCode = 404;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(
    JSON.stringify({
      ok: false,
      error: "Not found",
    }),
  );
}

async function handleSocketMessage(
  socket: WebSocket,
  rawData: RawData,
  log: Logger,
): Promise<void> {
  let parsed: ClientInboundMessage;

  try {
    parsed = parseInboundMessage(rawData);
  } catch (error) {
    await sendJson(socket, {
      type: "error",
      scope: "transport",
      code: "MALFORMED_JSON_PAYLOAD",
      message: error instanceof Error ? error.message : "Malformed websocket payload",
    });
    return;
  }

  if (!parsed.message || typeof parsed.message !== "string" || !parsed.message.trim()) {
    await sendJson(socket, {
      type: "error",
      scope: "transport",
      code: "INVALID_INPUT",
      message: "Inbound websocket message must include a non-empty string `message` field",
    });
    return;
  }

  const abortController = new AbortController();

  socket.once("close", () => {
    abortController.abort();
  });

  try {
    const upstreamResponse = await fetch(UPSTREAM_ASSISTANT_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: parsed.message,
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        context: parsed.context && typeof parsed.context === "object" ? parsed.context : {},
      }),
      signal: abortController.signal,
    });

    if (!upstreamResponse.ok) {
      await sendJson(socket, {
        type: "error",
        scope: "upstream",
        code: "UPSTREAM_HTTP_ERROR",
        message: `Upstream assistant returned HTTP ${upstreamResponse.status}`,
      });
      return;
    }

    if (!upstreamResponse.body) {
      await sendJson(socket, {
        type: "error",
        scope: "upstream",
        code: "UPSTREAM_EMPTY_BODY",
        message: "Upstream assistant returned no response body",
      });
      return;
    }

    const reader = upstreamResponse.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const result = await reader.read();
      if (result.done) break;

      const chunk = decoder.decode(result.value, { stream: true });

      await sendJson(socket, {
        type: "stream",
        data: chunk,
      });
    }

    await sendJson(socket, {
      type: "complete",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Assistant realtime upstream execution failed";

    log.error("assistant realtime upstream execution failed", {
      error: message,
    });

    if (socket.readyState === socket.OPEN) {
      await sendJson(socket, {
        type: "error",
        scope: "runtime",
        code: "UPSTREAM_EXECUTION_FAILED",
        message,
      });
    }
  }
}

function parseInboundMessage(rawData: RawData): ClientInboundMessage {
  const text = normalizeRawData(rawData);
  const value: unknown = JSON.parse(text);

  if (!value || typeof value !== "object") {
    throw new Error("Inbound payload must be a JSON object");
  }

  return value as ClientInboundMessage;
}

function normalizeRawData(data: RawData): string {
  if (typeof data === "string") return data;

  if (data instanceof Buffer) {
    return data.toString("utf8");
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(data)).toString("utf8");
  }

  return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
}

async function sendJson(socket: WebSocket, payload: Record<string, unknown>): Promise<void> {
  if (socket.readyState !== socket.OPEN) return;

  await new Promise<void>((resolve, reject) => {
    socket.send(JSON.stringify(payload), (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function createLogger(): Logger {
  return {
    info(message, meta) {
      console.log(JSON.stringify({ level: "info", message, ...(meta || {}) }));
    },
    warn(message, meta) {
      console.warn(JSON.stringify({ level: "warn", message, ...(meta || {}) }));
    },
    error(message, meta) {
      console.error(JSON.stringify({ level: "error", message, ...(meta || {}) }));
    },
  };
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
