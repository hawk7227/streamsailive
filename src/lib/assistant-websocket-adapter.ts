import { randomUUID } from "crypto";
import { NextRequest } from "next/server";

import {
  ASSISTANT_PROTOCOL_VERSION,
  type AssistantActivityType,
  type AssistantCloseReason,
  type AssistantSessionInboundMessage,
  type AssistantSessionOutboundMessage,
  type AssistantSessionStatus,
  type AssistantSessionTurnMessage,
} from "./assistant-protocol";
import { routeRequest } from "./router";
import { buildContext } from "./context";
import { buildAssistantTools, executeAssistantTool } from "./tools";
import type {
  AssistantMode,
  ChatMessage,
  NormalizedAssistantRequest,
} from "./contracts";

export type AssistantSessionState = {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  previousResponseId: string | null;
  baseContext: Record<string, unknown>;
  status: AssistantSessionStatus;
  activeTurnId: string | null;
};

export interface AssistantSessionTransport {
  send(message: AssistantSessionOutboundMessage): Promise<void> | void;
  close(code?: number, reason?: string): Promise<void> | void;
  onClose(handler: (code?: number, reason?: string) => Promise<void> | void): void;
}

type RequestBody = {
  message?: string;
  messages?: Array<{ role?: string; content?: unknown }>;
  context?: Record<string, unknown>;
};

type TurnInputMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ToolOutputItem = {
  type: "function_call_output";
  call_id: string;
  output: string;
};

type FunctionCallAccumulator = {
  itemId: string;
  callId: string;
  name: string;
  argumentsJson: string;
};

type StreamTurnResult = {
  responseId: string;
  functionCalls: FunctionCallAccumulator[];
  sawText: boolean;
};

type AssistantSessionControlPlaneOptions = {
  transport: AssistantSessionTransport;
  sessionId?: string;
  initialContext?: Record<string, unknown>;
};

type TurnExecutionMetrics = {
  startedAt: number;
  providerStartedAt?: number;
  firstTextAt?: number;
  completedAt?: number;
  failedAt?: number;
  cancelledAt?: number;
};

const OPENAI_LIMITS = {
  maxToolContinuationLoops: 12,
  providerStartTimeoutMs: 15_000,
  providerStallTimeoutMs: 20_000,
  toolTimeoutMs: 30_000,
  totalTurnTimeoutMs: 120_000,
} as const;

function nowIso(): string {
  return new Date().toISOString();
}

function nowMs(): number {
  return Date.now();
}

function getOpenAIBaseUrl(): string {
  return (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
}

function getOpenAIKey(): string {
  const value = process.env.OPENAI_API_KEY?.trim();
  if (!value) {
    throw new Error("OPENAI_API_KEY is missing");
  }
  return value;
}

function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4.1";
}

function normalizeMessages(value: RequestBody["messages"]): ChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is { role: string; content: unknown } =>
        !!item && typeof item.role === "string",
    )
    .map((item) => {
      const role =
        item.role === "system" || item.role === "assistant" || item.role === "user"
          ? item.role
          : "user";

      let content = "";
      if (typeof item.content === "string") {
        content = item.content;
      } else if (Array.isArray(item.content)) {
        content = item.content
          .map((part) => {
            if (typeof part === "string") return part;
            if (
              part &&
              typeof part === "object" &&
              "text" in part &&
              typeof (part as { text?: unknown }).text === "string"
            ) {
              return String((part as { text: string }).text);
            }
            return "";
          })
          .join("\n");
      }

      return { role, content };
    })
    .filter((item) => item.content.trim().length > 0) as ChatMessage[];
}

function normalizeTurnRequest(
  message: AssistantSessionTurnMessage,
): {
  turnId: string;
  normalized: NormalizedAssistantRequest;
} {
  const messages = normalizeMessages(message.messages);
  const latestUserMessage =
    messages
      .slice()
      .reverse()
      .find((item) => item.role === "user")?.content ?? "";

  const userText =
    typeof message.message === "string" && message.message.trim()
      ? message.message.trim()
      : latestUserMessage;

  return {
    turnId: message.turnId?.trim() || randomUUID(),
    normalized: {
      userText,
      messages,
      context:
        message.context && typeof message.context === "object" ? message.context : {},
    },
  };
}

function buildInitialInputMessages(
  systemPrompt: string,
  messages: ChatMessage[],
  userText: string,
): TurnInputMessage[] {
  const base = messages.length
    ? messages
    : userText
      ? [{ role: "user" as const, content: userText }]
      : [];

  if (!systemPrompt.trim()) {
    return base;
  }

  return [{ role: "system", content: systemPrompt }, ...base];
}

function buildContinuationInput(userText: string): TurnInputMessage[] {
  return [{ role: "user", content: userText }];
}

function parseJsonObjectSafe(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseSseFrames(buffer: string): { frames: string[]; rest: string } {
  const frames: string[] = [];
  let rest = buffer;

  while (true) {
    const boundary = rest.indexOf("\n\n");
    if (boundary === -1) break;
    frames.push(rest.slice(0, boundary));
    rest = rest.slice(boundary + 2);
  }

  return { frames, rest };
}

function parseSseFrame(frame: string): { event: string; data: string } | null {
  const lines = frame.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return null;

  return {
    event,
    data: dataLines.join("\n"),
  };
}

function upsertFunctionCall(
  calls: Map<string, FunctionCallAccumulator>,
  patch: Partial<FunctionCallAccumulator> & { itemId: string },
): void {
  const current = calls.get(patch.itemId) ?? {
    itemId: patch.itemId,
    callId: "",
    name: "",
    argumentsJson: "",
  };

  if (typeof patch.callId === "string" && patch.callId) {
    current.callId = patch.callId;
  }

  if (typeof patch.name === "string" && patch.name) {
    current.name = patch.name;
  }

  if (typeof patch.argumentsJson === "string" && patch.argumentsJson) {
    current.argumentsJson += patch.argumentsJson;
  }

  calls.set(patch.itemId, current);
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    const abortHandler = () => {
      clearTimeout(timer);
      reject(new Error(`${label} aborted`));
    };

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new Error(`${label} aborted`));
        return;
      }
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    promise.then(
      (value) => {
        clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", abortHandler);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", abortHandler);
        reject(error);
      },
    );
  });
}

function assertRemainingBudget(startedAtMs: number, label: string): void {
  const elapsed = nowMs() - startedAtMs;
  if (elapsed > OPENAI_LIMITS.totalTurnTimeoutMs) {
    throw new Error(`${label} exceeded total turn timeout`);
  }
}

async function openResponsesStream(params: {
  model: string;
  input: unknown;
  tools?: unknown;
  previousResponseId?: string | null;
  signal: AbortSignal;
  metrics: TurnExecutionMetrics;
}): Promise<Response> {
  params.metrics.providerStartedAt ??= nowMs();

  return withTimeout(
    fetch(`${getOpenAIBaseUrl()}/responses`, {
      method: "POST",
      signal: params.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getOpenAIKey()}`,
      },
      body: JSON.stringify({
        model: params.model,
        input: params.input,
        tools: params.tools,
        previous_response_id: params.previousResponseId ?? undefined,
        stream: true,
      }),
    }),
    OPENAI_LIMITS.providerStartTimeoutMs,
    "provider stream start",
    params.signal,
  );
}

async function streamOneResponsesTurn(params: {
  model: string;
  input: unknown;
  tools?: unknown;
  previousResponseId?: string | null;
  signal: AbortSignal;
  metrics: TurnExecutionMetrics;
  onTextDelta: (delta: string) => Promise<void>;
}): Promise<StreamTurnResult> {
  const response = await openResponsesStream({
    model: params.model,
    input: params.input,
    tools: params.tools,
    previousResponseId: params.previousResponseId,
    signal: params.signal,
    metrics: params.metrics,
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `OpenAI streaming request failed (${response.status}): ${errorText || response.statusText}`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const functionCalls = new Map<string, FunctionCallAccumulator>();
  let buffer = "";
  let responseId = "";
  let sawText = false;

  while (true) {
    if (params.signal.aborted) {
      throw new Error("provider stream aborted");
    }

    const readResult = await withTimeout(
      reader.read(),
      OPENAI_LIMITS.providerStallTimeoutMs,
      "provider stream stall",
      params.signal,
    );

    if (readResult.done) break;

    buffer += decoder.decode(readResult.value, { stream: true });
    const parsed = parseSseFrames(buffer);
    buffer = parsed.rest;

    for (const frame of parsed.frames) {
      const parsedFrame = parseSseFrame(frame);
      if (!parsedFrame) continue;
      if (parsedFrame.data === "[DONE]") continue;

      let payload: unknown;
      try {
        payload = JSON.parse(parsedFrame.data);
      } catch {
        throw new Error("Malformed OpenAI SSE payload");
      }

      if (!payload || typeof payload !== "object") continue;
      const data = payload as Record<string, unknown>;

      const responseObj =
        data.response && typeof data.response === "object"
          ? (data.response as Record<string, unknown>)
          : null;

      if (responseObj && typeof responseObj.id === "string") {
        responseId = responseObj.id;
      }

      if (typeof data.id === "string" && parsedFrame.event.startsWith("response.")) {
        responseId = data.id;
      }

      if (
        parsedFrame.event === "response.output_text.delta" &&
        typeof data.delta === "string"
      ) {
        if (data.delta) {
          sawText = true;
          params.metrics.firstTextAt ??= nowMs();
          await params.onTextDelta(data.delta);
        }
        continue;
      }

      if (
        parsedFrame.event === "response.output_item.added" &&
        data.item &&
        typeof data.item === "object"
      ) {
        const item = data.item as Record<string, unknown>;
        if (item.type === "function_call" && typeof item.id === "string") {
          upsertFunctionCall(functionCalls, {
            itemId: item.id,
            callId: typeof item.call_id === "string" ? item.call_id : "",
            name: typeof item.name === "string" ? item.name : "",
            argumentsJson: typeof item.arguments === "string" ? item.arguments : "",
          });
        }
        continue;
      }

      if (
        parsedFrame.event === "response.function_call_arguments.delta" &&
        typeof data.item_id === "string"
      ) {
        upsertFunctionCall(functionCalls, {
          itemId: data.item_id,
          argumentsJson: typeof data.delta === "string" ? data.delta : "",
        });
        continue;
      }

      if (
        parsedFrame.event === "response.output_item.done" &&
        data.item &&
        typeof data.item === "object"
      ) {
        const item = data.item as Record<string, unknown>;
        if (item.type === "function_call" && typeof item.id === "string") {
          upsertFunctionCall(functionCalls, {
            itemId: item.id,
            callId: typeof item.call_id === "string" ? item.call_id : "",
            name: typeof item.name === "string" ? item.name : "",
            argumentsJson: typeof item.arguments === "string" ? item.arguments : "",
          });
        }
      }
    }
  }

  if (!responseId) {
    throw new Error("Missing response id from streamed provider turn");
  }

  return {
    responseId,
    functionCalls: Array.from(functionCalls.values()).filter(
      (call) => call.itemId && call.callId && call.name,
    ),
    sawText,
  };
}

export class AssistantSessionControlPlane {
  private readonly transport: AssistantSessionTransport;
  private readonly model: string;
  private readonly state: AssistantSessionState;
  private currentTurnAbort: AbortController | null = null;
  private isClosed = false;
  private hasStarted = false;
  private sessionStarted = false;

  constructor(options: AssistantSessionControlPlaneOptions) {
    const createdAt = nowIso();

    this.transport = options.transport;
    this.model = getOpenAIModel();
    this.state = {
      sessionId: options.sessionId?.trim() || randomUUID(),
      createdAt,
      updatedAt: createdAt,
      previousResponseId: null,
      baseContext:
        options.initialContext && typeof options.initialContext === "object"
          ? options.initialContext
          : {},
      status: "idle",
      activeTurnId: null,
    };
  }

  async start(): Promise<void> {
    if (this.isClosed) {
      throw new Error("Cannot start a closed session");
    }
    if (this.hasStarted) return;

    this.transport.onClose(async (_code, reason) => {
      await this.close("transport_closed", reason || "transport closed");
    });

    this.hasStarted = true;
  }

  async receive(message: AssistantSessionInboundMessage): Promise<void> {
    if (this.isClosed) return;
    if (!this.hasStarted) {
      throw new Error("Control plane must be started before receiving messages");
    }

    switch (message.type) {
      case "session.start":
        await this.handleSessionStart(message);
        return;
      case "session.turn":
        if (!this.sessionStarted) {
          await this.sendError("session", "Cannot run a turn before session.start", {
            code: "SESSION_NOT_STARTED",
            turnId: message.turnId,
          });
          return;
        }
        await this.runTurn(message);
        return;
      case "session.cancel":
        if (!this.sessionStarted) return;
        await this.cancelActiveTurn(message.reason || "explicit_cancel");
        return;
      case "session.close":
        await this.close(message.reason || "explicit_close", "client requested close");
        return;
    }
  }

  async cancelActiveTurn(reason: AssistantCloseReason = "explicit_cancel"): Promise<void> {
    if (!this.currentTurnAbort || !this.state.activeTurnId) {
      await this.sendError("session", "No active turn to cancel", {
        code: "NO_ACTIVE_TURN",
      });
      return;
    }
    this.currentTurnAbort.abort(reason);
  }

  async close(reason: AssistantCloseReason = "explicit_close", detail = "session closed"): Promise<void> {
    if (this.isClosed) return;

    if (this.currentTurnAbort && this.state.activeTurnId) {
      this.currentTurnAbort.abort(reason);
    }

    this.isClosed = true;
    this.sessionStarted = false;
    this.state.status = "closed";
    this.state.activeTurnId = null;
    this.touch();

    await this.send({
      type: "session.closed",
      sessionId: this.state.sessionId,
      reason: detail,
    });

    await this.transport.close(1000, detail);
  }

  getState(): AssistantSessionState {
    return { ...this.state };
  }

  private async handleSessionStart(
    message: Extract<AssistantSessionInboundMessage, { type: "session.start" }>,
  ): Promise<void> {
    if (message.protocolVersion !== ASSISTANT_PROTOCOL_VERSION) {
      await this.sendError("session", `Unsupported protocol version ${message.protocolVersion}`, {
        code: "UNSUPPORTED_PROTOCOL_VERSION",
      });
      await this.close("protocol_error", "protocol version mismatch");
      return;
    }

    if (message.context && typeof message.context === "object" && !Array.isArray(message.context)) {
      this.state.baseContext = message.context;
      this.touch();
    }

    this.sessionStarted = true;

    await this.send({
      type: "session.ready",
      sessionId: this.state.sessionId,
      createdAt: this.state.createdAt,
    });

    await this.sendState();
  }

  private async runTurn(message: AssistantSessionTurnMessage): Promise<void> {
    if (this.state.status === "running" || this.state.activeTurnId) {
      await this.sendError("session", "A turn is already running for this session", {
        code: "TURN_ALREADY_RUNNING",
        turnId: message.turnId,
      });
      return;
    }

    const { turnId, normalized } = normalizeTurnRequest(message);

    if (!normalized.userText.trim()) {
      await this.sendError("session", "Turn message is empty", {
        code: "EMPTY_TURN_MESSAGE",
        turnId,
      });
      return;
    }

    this.transitionToRunning(turnId);
    await this.sendState();

    const metrics: TurnExecutionMetrics = { startedAt: nowMs() };
    const abortController = new AbortController();
    this.currentTurnAbort = abortController;

    try {
      const mergedContext: Record<string, unknown> = {
        ...(this.state.baseContext || {}),
        ...(normalized.context || {}),
      };

      const route = routeRequest({
        ...normalized,
        context: mergedContext,
      }) as AssistantMode;

      await this.send({
        type: "turn.started",
        sessionId: this.state.sessionId,
        turnId,
        route,
      });

      await this.sendActivity(turnId, "understanding");
      assertRemainingBudget(metrics.startedAt, "turn");

      const assembledContext = await buildContext({
        route,
        userText: normalized.userText,
        messages: normalized.messages,
        context: mergedContext,
      });

      assertRemainingBudget(metrics.startedAt, "context");

      const tools = buildAssistantTools({ route, context: assembledContext });

      let currentInput: TurnInputMessage[] | ToolOutputItem[] =
        this.state.previousResponseId
          ? buildContinuationInput(normalized.userText)
          : buildInitialInputMessages(
              assembledContext.systemPrompt,
              normalized.messages,
              normalized.userText,
            );

      let currentTools: unknown = tools;
      let sawAnyText = false;

      for (let loopIndex = 0; loopIndex < OPENAI_LIMITS.maxToolContinuationLoops; loopIndex += 1) {
        assertRemainingBudget(metrics.startedAt, "turn loop");

        const turn = await streamOneResponsesTurn({
          model: this.model,
          input: currentInput,
          tools: currentTools,
          previousResponseId: this.state.previousResponseId,
          signal: abortController.signal,
          metrics,
          onTextDelta: async (delta) => {
            await this.send({
              type: "text.delta",
              sessionId: this.state.sessionId,
              turnId,
              delta,
            });
          },
        });

        this.state.previousResponseId = turn.responseId;
        this.touch();
        if (turn.sawText) sawAnyText = true;

        if (turn.functionCalls.length === 0) {
          metrics.completedAt = nowMs();
          await this.sendActivity(turnId, "completed");
          await this.send({
            type: "turn.completed",
            sessionId: this.state.sessionId,
            turnId,
            responseId: this.state.previousResponseId,
            sawText: sawAnyText,
          });
          this.finishTurn();
          return;
        }

        const toolOutputs = await this.executeToolBatch({
          turnId,
          route,
          context: assembledContext,
          calls: turn.functionCalls,
          signal: abortController.signal,
        });

        assertRemainingBudget(metrics.startedAt, "tool execution");
        await this.sendActivity(turnId, "validating");

        currentInput = toolOutputs;
        currentTools = undefined;
      }

      throw new Error("Maximum tool continuation loops exceeded");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "turn execution failed";

      if (abortController.signal.aborted) {
        metrics.cancelledAt = nowMs();
        await this.send({
          type: "turn.cancelled",
          sessionId: this.state.sessionId,
          turnId,
          reason: messageText,
        });
        this.finishTurn();
        return;
      }

      metrics.failedAt = nowMs();
      await this.sendActivity(turnId, "failed");
      await this.sendError("orchestrator", messageText, {
        code: "TURN_EXECUTION_FAILED",
        turnId,
      });
      this.finishTurn();
    }
  }

  private async executeToolBatch(params: {
    turnId: string;
    route: AssistantMode;
    context: Awaited<ReturnType<typeof buildContext>>;
    calls: FunctionCallAccumulator[];
    signal: AbortSignal;
  }): Promise<ToolOutputItem[]> {
    const toolOutputs: ToolOutputItem[] = [];

    for (const call of params.calls) {
      if (params.signal.aborted) {
        throw new Error("tool execution aborted");
      }

      await this.sendActivity(params.turnId, "executing_tool", call.name);
      await this.send({
        type: "tool.call",
        sessionId: this.state.sessionId,
        turnId: params.turnId,
        callId: call.callId,
        toolName: call.name,
      });

      const parsedArgs = parseJsonObjectSafe(call.argumentsJson);

      try {
        const result = await withTimeout(
          executeAssistantTool(
            {
              name: call.name,
              args: parsedArgs,
              route: params.route,
              context: params.context,
            },
            {
              onProgress: (text: string) => {
                if (text && text.trim()) {
                  void this.send({
                    type: "tool.progress",
                    sessionId: this.state.sessionId,
                    turnId: params.turnId,
                    toolName: call.name,
                    text,
                  });
                }
              },
            },
          ),
          OPENAI_LIMITS.toolTimeoutMs,
          `tool ${call.name}`,
          params.signal,
        );

        await this.send({
          type: "tool.result",
          sessionId: this.state.sessionId,
          turnId: params.turnId,
          toolName: call.name,
          result,
        });

        toolOutputs.push({
          type: "function_call_output",
          call_id: call.callId,
          output: JSON.stringify(result ?? null),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "tool execution failed";

        await this.sendError("tool", message, {
          code: "TOOL_EXECUTION_FAILED",
          turnId: params.turnId,
          toolName: call.name,
        });

        toolOutputs.push({
          type: "function_call_output",
          call_id: call.callId,
          output: JSON.stringify({ ok: false, error: message }),
        });
      }
    }

    return toolOutputs;
  }

  private transitionToRunning(turnId: string): void {
    this.state.status = "running";
    this.state.activeTurnId = turnId;
    this.touch();
  }

  private finishTurn(): void {
    this.currentTurnAbort = null;
    this.state.status = this.isClosed ? "closed" : "idle";
    this.state.activeTurnId = null;
    this.touch();
    if (!this.isClosed) void this.sendState();
  }

  private touch(): void {
    this.state.updatedAt = nowIso();
  }

  private async sendActivity(
    turnId: string,
    activity: AssistantActivityType,
    toolName?: string,
  ): Promise<void> {
    await this.send({
      type: "activity",
      sessionId: this.state.sessionId,
      turnId,
      activity,
      toolName,
    });
  }

  private async sendState(): Promise<void> {
    await this.send({
      type: "session.state",
      sessionId: this.state.sessionId,
      status: this.state.status,
      activeTurnId: this.state.activeTurnId,
      previousResponseId: this.state.previousResponseId,
    });
  }

  private async sendError(
    scope: "session" | "provider" | "tool" | "transport" | "orchestrator",
    message: string,
    extra?: { code?: string; turnId?: string; toolName?: string },
  ): Promise<void> {
    await this.send({
      type: "error",
      sessionId: this.state.sessionId,
      scope,
      message,
      code: extra?.code,
      turnId: extra?.turnId,
      toolName: extra?.toolName,
    });
  }

  private async send(message: AssistantSessionOutboundMessage): Promise<void> {
    if (this.isClosed && message.type !== "session.closed") return;
    await this.transport.send(message);
  }
}

export async function runOrchestrator(_req: NextRequest): Promise<Response> {
  return new Response(
    JSON.stringify({
      ok: false,
      error:
        "WebSocket session transport is required for the session-based orchestrator. This HTTP POST entry point is not wired to the final control-plane architecture.",
      status: "blocked",
    }),
    {
      status: 426,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Upgrade: "websocket",
        "Cache-Control": "no-store",
      },
    },
  );
}
