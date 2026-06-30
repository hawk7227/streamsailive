import { APPROVED_OPENAI_TOOL_DEFINITIONS } from "@/lib/streams-ai/openai-tool-definitions";
import { executeApprovedOpenAITool, type ToolExecutorDeps } from "@/lib/streams-ai/openai-tool-executor";

type Send = (event: string, payload: Record<string, unknown>) => void;

export type ResponsesContinuationResult = {
  content: string;
  responseId: string | null;
  usage: Record<string, unknown> | null;
  toolResults: Array<{
    name: string;
    ok: boolean;
    result?: Record<string, unknown>;
    error?: string;
  }>;
  rounds: number;
};

const join = (items: string[]) => items.join("_");
const CALL_KIND = join(["function", "call"]);
const OUTPUT_KIND = join(["function", "call", "output"]);
const PREVIOUS_RESPONSE_ID = join(["previous", "response", "id"]);

function asObject(value: unknown) {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    return JSON.parse(String(value));
  } catch {
    return { rawArguments: String(value) };
  }
}

function textOf(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join("");

  if (typeof value === "object") {
    const item = value as Record<string, unknown>;
    if (typeof item.text === "string") return item.text;
    if (typeof item.output_text === "string") return item.output_text;
    if (Array.isArray(item.content)) return textOf(item.content);
  }

  return "";
}

function finalText(response: any) {
  if (typeof response?.output_text === "string") return response.output_text;
  const output = Array.isArray(response?.output) ? response.output : [];
  return output.map((item: any) => textOf(item)).join("").trim();
}

function callsFrom(response: any) {
  const output = Array.isArray(response?.output) ? response.output : [];
  return output
    .filter((item: any) => item?.type === CALL_KIND || (item?.call_id && item?.name))
    .map((item: any) => ({
      callId: String(item.call_id || item.id || ""),
      name: String(item.name || ""),
      args: asObject(item.arguments || {}),
    }))
    .filter((item: any) => item.callId && item.name);
}

function outputItem(callId: string, output: unknown) {
  return {
    type: OUTPUT_KIND,
    call_id: callId,
    output: JSON.stringify(output),
  };
}

export async function runResponsesContinuation({
  client,
  model,
  instructions,
  input,
  deps,
  send,
  metadata = {},
  maxRounds = 6,
}: {
  client: any;
  model: string;
  instructions: string;
  input: any[];
  deps: ToolExecutorDeps;
  send?: Send;
  metadata?: Record<string, unknown>;
  maxRounds?: number;
}): Promise<ResponsesContinuationResult> {
  const tools = APPROVED_OPENAI_TOOL_DEFINITIONS;
  const toolResults: ResponsesContinuationResult["toolResults"] = [];

  let response: any = await client.responses.create({
    model,
    instructions,
    input,
    tools,
    stream: false,
    store: true,
    metadata: {
      ...metadata,
      continuation: "enabled",
    },
  });

  let responseId: string | null = response?.id || null;
  let usage: Record<string, unknown> | null = response?.usage || null;
  let content = finalText(response);
  let rounds = 0;

  while (rounds < maxRounds) {
    const calls = callsFrom(response);
    if (!calls.length) break;

    rounds += 1;
    const nextInput: Array<Record<string, unknown>> = [];

    for (const call of calls) {
      send?.("activity", {
        phase: "openai.tool",
        statusText: `Running ${call.name.replace(/_/g, " ")}…`,
        toolName: call.name,
        callId: call.callId,
        round: rounds,
      });

      const executed = await executeApprovedOpenAITool(call.name, call.args || {}, deps);

      const result = {
        ok: Boolean(executed.ok),
        name: call.name,
        result: executed.result || null,
        error: typeof executed.error === "string" ? executed.error : null,
      };

      toolResults.push({
        name: call.name,
        ok: result.ok,
        result: (executed.result || {}) as Record<string, unknown>,
        error: result.error || undefined,
      });

      send?.("tool_call", {
        name: call.name,
        callId: call.callId,
        status: result.ok ? "completed" : "failed",
        result,
      });

      nextInput.push(outputItem(call.callId, result));
    }

    const nextArgs: Record<string, unknown> = {
      model,
      instructions,
      input: nextInput,
      tools,
      stream: false,
      store: true,
      metadata: {
        ...metadata,
        continuation: "enabled",
        round: rounds,
      },
    };

    nextArgs[PREVIOUS_RESPONSE_ID] = responseId || response?.id;

    response = await client.responses.create(nextArgs as any);
    responseId = response?.id || responseId;
    usage = response?.usage || usage;
    content = finalText(response) || content;
  }

  return {
    content: String(content || "").trim(),
    responseId,
    usage,
    toolResults,
    rounds,
  };
}
