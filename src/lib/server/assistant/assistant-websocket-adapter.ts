import "server-only";

import type { NextRequest } from "next/server";
import {
  type AssistantSessionOutboundMessage,
} from "@/lib/assistant-core/assistant-protocol";
import { runOrchestrator } from "@/lib/assistant-core/orchestrator";

export interface RealtimeSocket {
  send(data: string): void | Promise<void>;
  close(code?: number, reason?: string): void | Promise<void>;
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
}

export type AssistantWebSocketAdapterOptions = {
  socket: RealtimeSocket;
  logger?: {
    info?: (message: string, meta?: Record<string, unknown>) => void;
    warn?: (message: string, meta?: Record<string, unknown>) => void;
    error?: (message: string, meta?: Record<string, unknown>) => void;
  };
};

export class AssistantWebSocketAdapter {
  private readonly socket: RealtimeSocket;
  private readonly logger?: AssistantWebSocketAdapterOptions["logger"];
  private closed = false;

  constructor(options: AssistantWebSocketAdapterOptions) {
    this.socket = options.socket;
    this.logger = options.logger;
  }

  async start(): Promise<void> {
    this.socket.addEventListener("message", async (event) => {
      await this.handleMessage(event.data);
    });

    this.socket.addEventListener("error", async (event) => {
      this.logger?.error?.("websocket error", {
        event: serializeUnknown(event),
      });
    });

    this.logger?.info?.("assistant websocket adapter started");
  }

  async close(code = 1000, reason = "closed"): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.socket.close(code, reason);
  }

  private async handleMessage(raw: unknown): Promise<void> {
    if (this.closed) return;

    let parsed: any;

    try {
      parsed = parseInboundPayload(raw);
    } catch {
      await this.sendError("Malformed JSON", "MALFORMED_JSON");
      return;
    }

    if (!parsed?.message) {
      await this.sendError("Missing message", "INVALID_INPUT");
      return;
    }

    try {
      const req = new Request("http://localhost/api/ai-assistant", {
        method: "POST",
        body: JSON.stringify({
          message: parsed.message,
          messages: parsed.messages || [],
          context: parsed.context || {},
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }) as unknown as NextRequest;

      const res = await runOrchestrator(req);

      if (!res.body) {
        await this.sendError("No response body", "EMPTY_RESPONSE");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);

        await this.socket.send(
          JSON.stringify({
            type: "stream",
            data: chunk,
          }),
        );
      }

      await this.socket.send(JSON.stringify({ type: "complete" }));
    } catch (error) {
      await this.sendError(
        error instanceof Error ? error.message : "Execution failed",
        "EXECUTION_ERROR",
      );
    }
  }

  private async sendError(message: string, code: string) {
    const payload: AssistantSessionOutboundMessage = {
      type: "error",
      sessionId: "realtime",
      scope: "runtime",
      message,
      code,
    };

    await this.socket.send(JSON.stringify(payload));
  }
}

function parseInboundPayload(raw: unknown): any {
  if (typeof raw === "string") return JSON.parse(raw);

  if (raw instanceof ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(new Uint8Array(raw)));
  }

  if (ArrayBuffer.isView(raw)) {
    return JSON.parse(new TextDecoder().decode(raw));
  }

  throw new Error("Unsupported payload");
}

function serializeUnknown(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
