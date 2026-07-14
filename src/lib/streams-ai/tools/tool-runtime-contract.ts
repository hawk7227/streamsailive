export const STREAMS_TOOL_RUNTIME_VERSION = "streams-tool-runtime-v1";

export type StreamsToolRisk = "read" | "write" | "destructive";

export type StreamsToolReceipt = {
  version: string;
  toolCallId: string;
  taskId: string;
  toolName: string;
  status: "succeeded" | "failed" | "cancelled";
  verified: boolean;
  idempotencyKey: string;
  startedAt: string;
  completedAt: string;
  output?: Record<string, unknown>;
  proof?: Record<string, unknown>;
  error?: string;
};

export type StreamsToolDefinition<TInput extends Record<string, unknown> = Record<string, unknown>> = {
  name: string;
  description: string;
  risk: StreamsToolRisk;
  requiresApproval: boolean;
  validate(input: unknown): TInput;
  authorize(input: TInput): Promise<void>;
  execute(input: TInput, signal?: AbortSignal): Promise<Record<string, unknown>>;
  verify(input: TInput, output: Record<string, unknown>): Promise<Record<string, unknown>>;
  compensate?(input: TInput, output: Record<string, unknown>): Promise<Record<string, unknown>>;
};

export async function executeStreamsTool<TInput extends Record<string, unknown>>(input: {
  definition: StreamsToolDefinition<TInput>;
  rawInput: unknown;
  taskId: string;
  toolCallId: string;
  idempotencyKey: string;
  approvalGranted: boolean;
  signal?: AbortSignal;
}): Promise<StreamsToolReceipt> {
  const startedAt = new Date().toISOString();
  const base = {
    version: STREAMS_TOOL_RUNTIME_VERSION,
    toolCallId: input.toolCallId,
    taskId: input.taskId,
    toolName: input.definition.name,
    idempotencyKey: input.idempotencyKey,
    startedAt,
  };

  try {
    if (!input.taskId || !input.toolCallId || !input.idempotencyKey) throw new Error("Tool execution identifiers are required");
    if (input.definition.requiresApproval && !input.approvalGranted) throw new Error("Tool execution requires approval");
    if (input.signal?.aborted) throw new DOMException("Tool execution cancelled", "AbortError");
    const validated = input.definition.validate(input.rawInput);
    await input.definition.authorize(validated);
    const output = await input.definition.execute(validated, input.signal);
    if (input.signal?.aborted) throw new DOMException("Tool execution cancelled", "AbortError");
    const proof = await input.definition.verify(validated, output);
    if (!proof || typeof proof !== "object") throw new Error("Tool verification did not return proof");
    return { ...base, status: "succeeded", verified: true, output, proof, completedAt: new Date().toISOString() };
  } catch (error) {
    const cancelled = input.signal?.aborted || (error instanceof DOMException && error.name === "AbortError");
    return { ...base, status: cancelled ? "cancelled" : "failed", verified: false, error: error instanceof Error ? error.message : String(error), completedAt: new Date().toISOString() };
  }
}
