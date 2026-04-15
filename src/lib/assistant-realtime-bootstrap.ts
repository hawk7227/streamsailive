export const runtime = "nodejs";
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
