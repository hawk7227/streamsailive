import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { randomUUID } from "node:crypto";

// ── Config ─────────────────────────────────────────────────────────────────
import { realtimeEnv } from "./env";

const PORT = realtimeEnv.PORT;
const HOST = realtimeEnv.HOST;
const WS_PATH = realtimeEnv.WS_PATH;
const HEALTH_PATH = realtimeEnv.HEALTH_PATH;
const UPSTREAM_URL = realtimeEnv.UPSTREAM_ASSISTANT_URL;

// ── Logger ─────────────────────────────────────────────────────────────────
type Logger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
};

function createLogger(): Logger {
  return {
    info: (msg, meta) => console.log(JSON.stringify({ level: "info", msg, ...meta })),
    warn: (msg, meta) => console.warn(JSON.stringify({ level: "warn", msg, ...meta })),
    error: (msg, meta) => console.error(JSON.stringify({ level: "error", msg, ...meta })),
  };
}

const logger = createLogger();

// ── Config validation — bind port first, degrade gracefully ────────────────
const configError =
  !UPSTREAM_URL || !isValidHttpUrl(UPSTREAM_URL)
    ? `UPSTREAM_ASSISTANT_URL missing or invalid (got: "${UPSTREAM_URL || "(not set)"}")`
    : null;

if (configError) {
  logger.error("FATAL CONFIG — service degraded, connections will be rejected", {
    configError,
  });
}

// ── Session state — one per socket ─────────────────────────────────────────
type SessionStatus = "idle" | "running" | "closed";

type SocketSession = {
  sessionId: string;
  status: SessionStatus;
  activeTurnId: string | null;
  previousResponseId: string | null;
  createdAt: string;
  activeAbort: AbortController | null;
};

function createSession(): SocketSession {
  return {
    sessionId: randomUUID(),
    status: "idle",
    activeTurnId: null,
    previousResponseId: null,
    createdAt: new Date().toISOString(),
    activeAbort: null,
  };
}

// ── Send helper ────────────────────────────────────────────────────────────
async function send(socket: WebSocket, payload: Record<string, unknown>): Promise<void> {
  if (socket.readyState !== socket.OPEN) return;
  await new Promise<void>((resolve, reject) => {
    socket.send(JSON.stringify(payload), (err?: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ── SSE stream parser ──────────────────────────────────────────────────────
// Orchestrator emits:
//   event: phase\ndata: {...}\n\n
//   event: tool_call\ndata: {...}\n\n
//   event: tool_progress\ndata: {...}\n\n
//   event: tool_result\ndata: {...}\n\n
//   event: tool_error\ndata: {...}\n\n
//   event: text\ndata: { text: "..." }\n\n   ← full response, not token stream
//   event: done\ndata: { ok: true }\n\n
//
// CLASSIFICATION: token-level streaming is Blocked — orchestrator uses
// non-streaming responses.create. text.delta carries full response as one
// delta. This is honest: real data, single delta, no simulation.

async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "message";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Split on newlines, keep partial last line in buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const raw of lines) {
        const line = raw.trimEnd();

        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const rawData = line.slice(6);
          let parsed: Record<string, unknown> = {};
          try {
            const val = JSON.parse(rawData);
            if (val && typeof val === "object") parsed = val as Record<string, unknown>;
          } catch {
            // non-JSON data line — skip
          }
          yield { event: currentEvent, data: parsed };
          currentEvent = "message";
        }
        // blank line = event boundary — reset already done above via currentEvent
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Inbound message parsing ────────────────────────────────────────────────
type InboundMessage = { type: string; [key: string]: unknown };

// ── Activity event names — must match assistant-protocol.ts ActivityEventName
// Source of truth: src/lib/assistant-core/assistant-protocol.ts
// Kept in sync manually until packages/contracts shared layer is built.
type ActivityEventName =
  | "understanding"
  | "reading_files"
  | "executing_tool"
  | "validating"
  | "completed"
  | "failed"
  | "operation_skipped";

function sendActivity(
  socket: WebSocket,
  turnId: string,
  activity: ActivityEventName,
  toolName?: string,
): Promise<void> {
  const payload: Record<string, unknown> = { type: "activity", turnId, activity };
  if (toolName) payload.toolName = toolName;
  return send(socket, payload);
}

function parseInbound(raw: RawData): InboundMessage | null {
  let text: string;
  if (typeof raw === "string") {
    text = raw;
  } else if (raw instanceof Buffer) {
    text = raw.toString("utf8");
  } else if (Array.isArray(raw)) {
    text = Buffer.concat(raw).toString("utf8");
  } else if (raw instanceof ArrayBuffer) {
    text = Buffer.from(new Uint8Array(raw)).toString("utf8");
  } else {
    text = Buffer.from(
      (raw as NodeJS.TypedArray).buffer,
      (raw as NodeJS.TypedArray).byteOffset,
      (raw as NodeJS.TypedArray).byteLength,
    ).toString("utf8");
  }

  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") return null;
    return parsed as InboundMessage;
  } catch {
    return null;
  }
}

// ── Turn execution ─────────────────────────────────────────────────────────
async function executeTurn(
  socket: WebSocket,
  session: SocketSession,
  turnId: string,
  message: string,
  context: Record<string, unknown>,
  log: Logger,
): Promise<void> {
  // Mark running
  session.status = "running";
  session.activeTurnId = turnId;
  session.activeAbort = new AbortController();

  // Emit turn.started immediately — latency mask, <50ms, no backend dependency
  await send(socket, {
    type: "turn.started",
    sessionId: session.sessionId,
    turnId,
  });

  await send(socket, {
    type: "session.state",
    sessionId: session.sessionId,
    status: "running",
    activeTurnId: turnId,
    previousResponseId: session.previousResponseId,
  });

  // Real event — maps to orchestrator routing phase
  await sendActivity(socket, turnId, "understanding");

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, messages: [], context }),
      signal: session.activeAbort.signal,
    });

    if (!upstream.ok) {
      throw new Error(`Upstream HTTP ${upstream.status}`);
    }
    if (!upstream.body) {
      throw new Error("Upstream returned no body");
    }

    let turnCompleted = false;
    let hadError = false;

    // Translate orchestrator SSE events → WS protocol messages
    for await (const { event, data } of parseSseStream(upstream.body)) {
      if (socket.readyState !== socket.OPEN) break;

      switch (event) {
        case "phase": {
          const phase = String(data.phase ?? "");
          if (phase === "routing" || phase === "building_context") {
            // Already emitted "understanding" above — no duplicate
          } else if (phase === "calling_openai") {
            await sendActivity(socket, turnId, "executing_tool", "openai");
          }
          // "finalizing", "continuing_after_tools" — no UI event needed
          break;
        }

        case "tool_call": {
          const name = typeof data.name === "string" ? data.name : "tool";
          await sendActivity(socket, turnId, "executing_tool", name);
          await send(socket, { type: "tool.call", turnId, toolName: name });
          break;
        }

        case "tool_progress": {
          await send(socket, {
            type: "tool.progress",
            turnId,
            toolName: typeof data.name === "string" ? data.name : undefined,
            text: typeof data.text === "string" ? data.text : undefined,
          });
          break;
        }

        case "tool_result": {
          // If result contains { action, payload } shape — emit as workspace.action
          const result = data.result;
          if (
            result &&
            typeof result === "object" &&
            typeof (result as Record<string, unknown>).action === "string" &&
            (result as Record<string, unknown>).ok === true
          ) {
            const r = result as Record<string, unknown>;
            await send(socket, {
              type: "workspace.action",
              action: {
                type: String(r.action),
                payload: (r.payload && typeof r.payload === "object") ? r.payload : {},
              },
            });
          }
          await send(socket, {
            type: "tool.result",
            turnId,
            toolName: typeof data.name === "string" ? data.name : undefined,
            result: data.result,
          });
          break;
        }

        case "tool_error": {
          // Orchestrator continues after tool errors — log only, do not abort turn
          log.warn("orchestrator tool error", {
            turnId,
            error: typeof data.error === "string" ? data.error : "unknown",
          });
          break;
        }

        case "text": {
          const text = typeof data.text === "string" ? data.text : "";
          if (text) {
            // CLASSIFICATION: single text.delta carrying full response.
            // Real data from OpenAI via orchestrator. Not simulated.
            // Token-level streaming: Blocked — requires orchestrator streaming mode.
            await send(socket, { type: "text.delta", turnId, delta: text });
          }
          break;
        }

        case "done": {
          if (data.ok === true) {
            turnCompleted = true;
          } else {
            hadError = true;
            const errMsg =
              typeof data.error === "string" ? data.error : "Orchestrator reported failure";
            log.error("orchestrator done with error", { turnId, error: errMsg });
            await send(socket, {
              type: "error",
              sessionId: session.sessionId,
              turnId,
              scope: "runtime",
              code: "ORCHESTRATOR_ERROR",
              message: errMsg,
            });
          }
          break;
        }

        default:
          // Unknown SSE event from orchestrator — ignore
          break;
      }
    }

    if (socket.readyState === socket.OPEN && !hadError) {
      await send(socket, { type: "turn.completed", turnId });
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      if (socket.readyState === socket.OPEN) {
        await send(socket, { type: "turn.cancelled", turnId });
      }
    } else {
      const message = err instanceof Error ? err.message : "Turn execution failed";
      log.error("turn execution failed", { turnId, error: message });
      if (socket.readyState === socket.OPEN) {
        await send(socket, {
          type: "error",
          sessionId: session.sessionId,
          turnId,
          scope: "runtime",
          code: "TURN_EXECUTION_FAILED",
          message,
        });
      }
    }
  } finally {
    session.status = "idle";
    session.activeTurnId = null;
    session.activeAbort = null;

    if (socket.readyState === socket.OPEN) {
      await send(socket, {
        type: "session.state",
        sessionId: session.sessionId,
        status: "idle",
        activeTurnId: null,
        previousResponseId: session.previousResponseId,
      });
    }
  }
}

// ── Inbound message dispatch ───────────────────────────────────────────────
async function handleMessage(
  socket: WebSocket,
  raw: RawData,
  session: SocketSession,
  log: Logger,
): Promise<void> {
  if (configError) {
    await send(socket, {
      type: "error",
      sessionId: session.sessionId,
      scope: "runtime",
      code: "SERVICE_MISCONFIGURED",
      message: configError,
    });
    return;
  }

  const msg = parseInbound(raw);

  if (!msg) {
    await send(socket, {
      type: "error",
      sessionId: session.sessionId,
      scope: "transport",
      code: "MALFORMED_PAYLOAD",
      message: "Payload must be a JSON object with a string type field",
    });
    return;
  }

  switch (msg.type) {
    case "session.start": {
      await send(socket, {
        type: "session.ready",
        sessionId: session.sessionId,
        createdAt: session.createdAt,
      });
      await send(socket, {
        type: "session.state",
        sessionId: session.sessionId,
        status: "idle",
        activeTurnId: null,
        previousResponseId: null,
      });
      break;
    }

    case "session.turn": {
      const turnId =
        typeof msg.turnId === "string" && msg.turnId ? msg.turnId : randomUUID();
      const message =
        typeof msg.message === "string" ? msg.message.trim() : "";
      const context =
        msg.context && typeof msg.context === "object"
          ? (msg.context as Record<string, unknown>)
          : {};

      if (!message) {
        await send(socket, {
          type: "error",
          sessionId: session.sessionId,
          turnId,
          scope: "transport",
          code: "EMPTY_MESSAGE",
          message: "session.turn requires a non-empty message field",
        });
        return;
      }

      if (session.status === "running") {
        await send(socket, {
          type: "error",
          sessionId: session.sessionId,
          turnId,
          scope: "runtime",
          code: "TURN_ALREADY_RUNNING",
          message: "A turn is already running. Send session.cancel first.",
        });
        return;
      }

      // Do not await — let further messages arrive (cancel support)
      void executeTurn(socket, session, turnId, message, context, log);
      break;
    }

    case "session.cancel": {
      if (session.activeAbort) {
        session.activeAbort.abort();
      }
      // turn.cancelled is emitted by executeTurn's catch block
      break;
    }

    case "session.close": {
      if (session.activeAbort) session.activeAbort.abort();
      session.status = "closed";
      await send(socket, {
        type: "session.closed",
        sessionId: session.sessionId,
        reason: typeof msg.reason === "string" ? msg.reason : "explicit_close",
      });
      socket.close(1000, "session closed");
      break;
    }

    default: {
      log.warn("unknown inbound message type", { sessionId: session.sessionId, type: msg.type });
      await send(socket, {
        type: "error",
        sessionId: session.sessionId,
        scope: "transport",
        code: "UNKNOWN_MESSAGE_TYPE",
        message: `Unknown message type: ${String(msg.type)}`,
      });
    }
  }
}

// ── HTTP server ────────────────────────────────────────────────────────────
function handleHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  log: Logger,
  cfgError: string | null,
): void {
  const url = req.url ?? "/";

  if (url === HEALTH_PATH) {
    const ok = cfgError === null;
    res.statusCode = ok ? 200 : 503;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      JSON.stringify({
        ok,
        service: "assistant-realtime",
        wsPath: WS_PATH,
        ...(cfgError ? { error: cfgError } : {}),
      }),
    );
    return;
  }

  log.warn("unexpected http request", { method: req.method ?? "GET", url });
  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ ok: false, error: "Not found" }));
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  handleHttpRequest(req, res, logger, configError);
});

const wss = new WebSocketServer({ server, path: WS_PATH });

wss.on("connection", (socket: WebSocket, request: IncomingMessage) => {
  const session = createSession();

  logger.info("connection opened", {
    sessionId: session.sessionId,
    remoteAddress: request.socket.remoteAddress ?? null,
  });

  // Keepalive: ping every 25s to prevent DO load balancer idle timeout (1006 drops).
  // Browser WebSocket responds to ping with pong automatically — no client change needed.
  const PING_INTERVAL_MS = 25_000;
  const pingTimer = setInterval(() => {
    if (socket.readyState === socket.OPEN) {
      socket.ping();
    } else {
      clearInterval(pingTimer);
    }
  }, PING_INTERVAL_MS);

  socket.on("message", async (raw: RawData) => {
    await handleMessage(socket, raw, session, logger);
  });

  socket.on("close", (code: number, reason: Buffer) => {
    clearInterval(pingTimer);
    if (session.activeAbort) session.activeAbort.abort();
    logger.info("connection closed", {
      sessionId: session.sessionId,
      code,
      reason: reason.toString("utf8"),
    });
  });

  socket.on("error", (error: Error) => {
    clearInterval(pingTimer);
    logger.error("socket error", {
      sessionId: session.sessionId,
      error: error.message,
    });
  });
});

wss.on("error", (error: Error) => {
  logger.error("wss error", { error: error.message });
});

server.on("error", (error: Error) => {
  logger.error("http server error", { error: error.message });
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  logger.info("assistant-realtime listening", {
    host: HOST,
    port: PORT,
    wsPath: WS_PATH,
    healthPath: HEALTH_PATH,
    upstream: UPSTREAM_URL || "(not set)",
    configError: configError ?? null,
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────
function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
