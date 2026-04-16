import "server-only";

import {
  type AssistantSessionInboundMessage,
  type AssistantSessionOutboundMessage,
} from "@/lib/assistant-core/assistant-protocol";
import {
  AssistantSessionControlPlane,
  type AssistantSessionTransport,
} from "@/lib/assistant-core/orchestrator";

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
  sessionId?: string;
  initialContext?: Record<string, unknown>;
  logger?: {
    info?: (message: string, meta?: Record<string, unknown>) => void;
    warn?: (message: string, meta?: Record<string, unknown>) => void;
    error?: (message: string, meta?: Record<string, unknown>) => void;
  };
};

class WebSocketTransport implements AssistantSessionTransport {
  readonly socket: RealtimeSocket;
  private closeHandler: ((code?: number, reason?: string) => Promise<void> | void) | null = null;

  constructor(socket: RealtimeSocket) {
    this.socket = socket;

    this.socket.addEventListener("close", async (event) => {
      await this.closeHandler?.(event.code, event.reason);
    });
  }

  async send(message: AssistantSessionOutboundMessage): Promise<void> {
    await this.socket.send(JSON.stringify(message));
  }

  async close(code?: number, reason?: string): Promise<void> {
    await this.socket.close(code, reason);
  }

  onClose(handler: (code?: number, reason?: string) => Promise<void> | void): void {
    this.closeHandler = handler;
  }
}

export class AssistantWebSocketAdapter {
  private readonly logger?: AssistantWebSocketAdapterOptions["logger"];
  private readonly transport: WebSocketTransport;
  private readonly controlPlane: AssistantSessionControlPlane;
  private started = false;
  private closed = false;

  constructor(options: AssistantWebSocketAdapterOptions) {
    this.logger = options.logger;
    this.transport = new WebSocketTransport(options.socket);
    this.controlPlane = new AssistantSessionControlPlane({
      transport: this.transport,
      sessionId: options.sessionId,
      initialContext: options.initialContext,
    });
  }

  async start(): Promise<void> {
    if (this.started) return;

    await this.controlPlane.start();

    this.transportSocket.addEventListener("message", async (event) => {
      await this.handleRawMessage(event.data);
    });

    this.transportSocket.addEventListener("error", async (event) => {
      this.logger?.error?.("assistant websocket transport error", {
        event: serializeUnknown(event),
      });

      const state = this.controlPlane.getState();
      await this.transport.send({
        type: "error",
        sessionId: state.sessionId,
        scope: "transport",
        message: "WebSocket transport error",
        code: "WEBSOCKET_TRANSPORT_ERROR",
      });
    });

    this.started = true;
    this.logger?.info?.("assistant websocket adapter started", {
      sessionId: this.controlPlane.getState().sessionId,
    });
  }

  getSessionId(): string {
    return this.controlPlane.getState().sessionId;
  }

  async close(code = 1000, reason = "adapter closed"): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.transport.close(code, reason);
  }

  private get transportSocket(): RealtimeSocket {
    return this.transport.socket;
  }

  private async handleRawMessage(raw: unknown): Promise<void> {
    if (this.closed) return;

    const state = this.controlPlane.getState();

    let parsed: unknown;
    try {
      parsed = parseInboundPayload(raw);
    } catch (error) {
      this.logger?.warn?.("assistant websocket invalid json payload", {
        sessionId: state.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });

      await this.transport.send({
        type: "error",
        sessionId: state.sessionId,
        scope: "transport",
        message: "Malformed websocket JSON payload",
        code: "MALFORMED_JSON_PAYLOAD",
      });
      return;
    }

    if (!isAssistantSessionInboundMessageLocal(parsed)) {
      this.logger?.warn?.("assistant websocket unsupported inbound payload", {
        sessionId: state.sessionId,
        payload: serializeUnknown(parsed),
      });

      await this.transport.send({
        type: "error",
        sessionId: state.sessionId,
        scope: "transport",
        message: "Unsupported inbound assistant protocol message",
        code: "INVALID_PROTOCOL_MESSAGE",
      });
      return;
    }

    if (
      parsed.type === "session.start" &&
      hasStringProperty(parsed, "protocolVersion") &&
      parsed.protocolVersion !== "1.0"
    ) {
      await this.transport.send(
        createLocalProtocolVersionMismatchError(state.sessionId, parsed.protocolVersion),
      );
      await this.controlPlane.close("protocol_error", "protocol version mismatch");
      return;
    }

    try {
      await this.controlPlane.receive(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "adapter receive failed";

      this.logger?.error?.("assistant websocket receive failed", {
        sessionId: state.sessionId,
        error: message,
      });

      await this.transport.send({
        type: "error",
        sessionId: state.sessionId,
        scope: "transport",
        message,
        code: "ADAPTER_RECEIVE_FAILED",
      });
    }
  }
}

function parseInboundPayload(raw: unknown): unknown {
  if (typeof raw === "string") {
    return JSON.parse(raw);
  }

  if (raw instanceof ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(new Uint8Array(raw)));
  }

  if (ArrayBuffer.isView(raw)) {
    return JSON.parse(new TextDecoder().decode(raw));
  }

  throw new Error("Unsupported websocket payload type");
}

function isAssistantSessionInboundMessageLocal(
  value: unknown,
): value is AssistantSessionInboundMessage {
  if (!isRecord(value)) return false;
  return typeof value.type === "string";
}

function hasStringProperty<K extends string>(
  value: Record<string, unknown>,
  key: K,
): value is Record<K, string> & Record<string, unknown> {
  return typeof value[key] === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createLocalProtocolVersionMismatchError(
  sessionId: string,
  protocolVersion: string,
): AssistantSessionOutboundMessage {
  return {
    type: "error",
    sessionId,
    scope: "protocol",
    message: `Unsupported assistant protocol version: ${protocolVersion}`,
    code: "PROTOCOL_VERSION_MISMATCH",
  };
}

function serializeUnknown(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
