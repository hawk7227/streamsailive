import "server-only";

export const runtime = "nodejs";

import type { IncomingMessage, Server as HttpServer } from "http";
import { WebSocketServer } from "ws";
import type { RawData, WebSocket } from "ws";

import {
  AssistantWebSocketAdapter,
  type RealtimeSocket,
} from "@/lib/server/assistant/assistant-websocket-adapter";

type Logger = {
  info?: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
  error?: (message: string, meta?: Record<string, unknown>) => void;
};

export type AssistantRealtimeServerOptions = {
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
};

class NodeWebSocketAdapter implements RealtimeSocket {
  private readonly socket: WebSocket;

  constructor(socket: WebSocket) {
    this.socket = socket;
  }

  async send(data: string): Promise<void> {
    if (this.socket.readyState !== this.socket.OPEN) {
      throw new Error("WebSocket is not open");
    }

    await new Promise<void>((resolve, reject) => {
      this.socket.send(data, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  async close(code?: number, reason?: string): Promise<void> {
    if (
      this.socket.readyState === this.socket.CLOSED ||
      this.socket.readyState === this.socket.CLOSING
    ) {
      return;
    }

    this.socket.close(code, reason);
  }

  addEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void | Promise<void>,
  ): void;
  addEventListener(
    type: "close",
    listener: (event: { code?: number; reason?: string }) => void | Promise<void>,
  ): void;
  addEventListener(
    type: "error",
    listener: (event: unknown) => void | Promise<void>,
  ): void;
  addEventListener(
    type: "message" | "close" | "error",
    listener:
      | ((event: { data: unknown }) => void | Promise<void>)
      | ((event: { code?: number; reason?: string }) => void | Promise<void>)
      | ((event: unknown) => void | Promise<void>),
  ): void {
    if (type === "message") {
      this.socket.on("message", async (data: RawData) => {
        await (listener as (event: { data: unknown }) => void | Promise<void>)({
          data: normalizeRawData(data),
        });
      });
      return;
    }

    if (type === "close") {
      this.socket.on("close", async (code, reason) => {
        await (listener as (event: {
          code?: number;
          reason?: string;
        }) => void | Promise<void>)({
          code,
          reason: reason.toString("utf8"),
        });
      });
      return;
    }

    this.socket.on("error", async (error) => {
      await (listener as (event: unknown) => void | Promise<void>)(error);
    });
  }
}

export function attachAssistantRealtimeServer(
  server: HttpServer,
  options: AssistantRealtimeServerOptions = {},
): WebSocketServer {
  const { path = "/api/assistant/realtime", logger, getInitialContext, authorize } = options;

  const wss = new WebSocketServer({
    server,
    path,
  });

  wss.on("connection", async (socket, request) => {
    try {
      const authResult = authorize ? await authorize(request) : { ok: true as const };

      if (!authResult.ok) {
        logger?.warn?.("assistant realtime authorization rejected", {
          path,
          code: authResult.code ?? 4401,
          reason: authResult.reason,
        });
        socket.close(authResult.code ?? 4401, authResult.reason);
        return;
      }

      const initialContext = getInitialContext ? await getInitialContext(request) : {};

      const adapter = new AssistantWebSocketAdapter({
        socket: new NodeWebSocketAdapter(socket),
        sessionId: authResult.sessionId,
        initialContext,
        logger,
      });

      await adapter.start();

      logger?.info?.("assistant realtime connection opened", {
        path,
        sessionId: adapter.getSessionId(),
      });
    } catch (error) {
      logger?.error?.("assistant realtime connection bootstrap failed", {
        path,
        error: error instanceof Error ? error.message : String(error),
      });

      socket.close(1011, "assistant realtime bootstrap failed");
    }
  });

  wss.on("listening", () => {
    logger?.info?.("assistant realtime server listening", { path });
  });

  wss.on("error", (error) => {
    logger?.error?.("assistant realtime server error", {
      path,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return wss;
}

function normalizeRawData(data: RawData): string {
  if (typeof data === "string") return data;
  if (data instanceof Buffer) return data.toString("utf8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return Buffer.from(data).toString("utf8");
}
