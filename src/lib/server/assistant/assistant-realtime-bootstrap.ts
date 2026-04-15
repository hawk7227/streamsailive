import "server-only";

export const runtime = "nodejs";

import http, { type IncomingMessage, type ServerResponse } from "http";

import { attachAssistantRealtimeServer } from "@/lib/server/assistant/assistant-realtime-server";

type Logger = {
  info?: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
  error?: (message: string, meta?: Record<string, unknown>) => void;
};

export type AssistantRealtimeBootstrapOptions = {
  port?: number;
  host?: string;
  path?: string;
  logger?: Logger;
  getInitialContext?: (
    request: IncomingMessage,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  authorize?:
    | ((
        request: IncomingMessage,
      ) =>
        | Promise<{ ok: true; sessionId?: string } | { ok: false; code?: number; reason: string }>
        | { ok: true; sessionId?: string }
        | { ok: false; code?: number; reason: string })
    | undefined;
  healthcheckPath?: string;
};

function createDefaultLogger(): Logger {
  return {
    info: (message, meta) => {
      console.log(JSON.stringify({ level: "info", message, ...(meta || {}) }));
    },
    warn: (message, meta) => {
      console.warn(JSON.stringify({ level: "warn", message, ...(meta || {}) }));
    },
    error: (message, meta) => {
      console.error(JSON.stringify({ level: "error", message, ...(meta || {}) }));
    },
  };
}

function handleHttpRequest(healthcheckPath: string, logger: Logger) {
  return (request: IncomingMessage, response: ServerResponse) => {
    const requestUrl = request.url || "/";

    if (requestUrl === healthcheckPath) {
      response.statusCode = 200;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.end(
        JSON.stringify({
          ok: true,
          service: "assistant-realtime",
        }),
      );
      return;
    }

    logger.warn?.("assistant realtime unexpected http request", {
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
  };
}

export function startAssistantRealtimeServer(
  options: AssistantRealtimeBootstrapOptions = {},
): http.Server {
  const port = options.port ?? Number(process.env.ASSISTANT_REALTIME_PORT || 3011);
  const host = options.host ?? process.env.ASSISTANT_REALTIME_HOST ?? "0.0.0.0";
  const path = options.path ?? process.env.ASSISTANT_REALTIME_PATH ?? "/api/assistant/realtime";
  const healthcheckPath = options.healthcheckPath ?? "/healthz";
  const logger = options.logger ?? createDefaultLogger();

  const server = http.createServer(handleHttpRequest(healthcheckPath, logger));

  attachAssistantRealtimeServer(server, {
    path,
    logger,
    authorize: options.authorize,
    getInitialContext: options.getInitialContext,
  });

  server.on("listening", () => {
    logger.info?.("assistant realtime bootstrap listening", {
      host,
      port,
      path,
      healthcheckPath,
    });
  });

  server.on("error", (error) => {
    logger.error?.("assistant realtime bootstrap server error", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  server.listen(port, host);

  return server;
}

if (require.main === module) {
  startAssistantRealtimeServer({
    authorize: async () => ({ ok: true }),
    getInitialContext: async () => ({}),
  });
}
