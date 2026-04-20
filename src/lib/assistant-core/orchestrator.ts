import { NextRequest } from "next/server";
import { routeRequest } from "./router";
import { buildContext } from "./context";
import { client } from "./openai";
import { buildAssistantTools, executeAssistantTool } from "./tools";
import type {
  AssistantMode,
  ChatMessage,
  NormalizedAssistantRequest,
} from "./contracts";

type RequestBody = {
  message?: string;
  messages?: Array<{ role?: string; content?: unknown }>;
  context?: Record<string, unknown>;
};

type FunctionCallItem = {
  call_id: string;
  name: string;
  arguments: string;
};

type MediaArtifact = {
  kind: "image" | "video" | "i2v";
  url: string;
  result: Record<string, unknown>;
};

const encoder = new TextEncoder();

function sse(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
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

function normalizeRequest(body: RequestBody): NormalizedAssistantRequest {
  const messages = normalizeMessages(body.messages);
  const latestUserMessage =
    messages
      .slice()
      .reverse()
      .find((message) => message.role === "user")?.content ?? "";

  const userText =
    typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : latestUserMessage;

  return {
    userText,
    messages,
    context:
      body.context && typeof body.context === "object" ? body.context : {},
  };
}

function extractTextFromContentPart(part: any): string[] {
  const chunks: string[] = [];

  if (!part || typeof part !== "object") return chunks;

  if (typeof part.text === "string" && part.text.trim()) {
    chunks.push(part.text);
  }

  if (typeof part.output_text === "string" && part.output_text.trim()) {
    chunks.push(part.output_text);
  }

  if (typeof part.input_text === "string" && part.input_text.trim()) {
    chunks.push(part.input_text);
  }

  if (typeof part.content === "string" && part.content.trim()) {
    chunks.push(part.content);
  }

  return chunks;
}

function getTextFromResponse(response: any): string {
  if (!response || typeof response !== "object") return "";

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const chunks: string[] = [];
  const output = Array.isArray(response.output) ? response.output : [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;

    if (typeof item.text === "string" && item.text.trim()) {
      chunks.push(item.text);
    }

    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      chunks.push(...extractTextFromContentPart(part));
    }
  }

  return chunks.join("\n").trim();
}

function getFunctionCalls(response: any): FunctionCallItem[] {
  const output = Array.isArray(response?.output) ? response.output : [];

  return output
    .filter((item: any) => item?.type === "function_call")
    .map((item: any) => ({
      call_id:
        typeof item.call_id === "string"
          ? item.call_id
          : typeof item.id === "string"
            ? item.id
            : "",
      name: typeof item.name === "string" ? item.name : "",
      arguments:
        typeof item.arguments === "string"
          ? item.arguments
          : JSON.stringify(item.arguments ?? {}),
    }))
    .filter((item: FunctionCallItem) => item.call_id && item.name);
}

function buildInputMessages(
  systemPrompt: string,
  messages: ChatMessage[],
  userText: string,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const base = messages.length
    ? messages
    : userText
      ? [{ role: "user" as const, content: userText }]
      : [];

  if (!systemPrompt.trim()) return base;

  return [{ role: "system", content: systemPrompt }, ...base];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function normalizeMediaKind(value: unknown): "image" | "video" | "i2v" {
  if (value === "video") return "video";
  if (value === "i2v") return "i2v";
  return "image";
}

function extractMediaArtifact(result: unknown): MediaArtifact | null {
  const root = asRecord(result);
  if (!root) return null;

  const payload = asRecord(root.payload);
  const data = asRecord(root.data);

  const url = firstString(
    root.outputUrl,
    root.url,
    root.assetUrl,
    root.videoUrl,
    root.imageUrl,
    payload?.outputUrl,
    payload?.url,
    payload?.assetUrl,
    payload?.videoUrl,
    payload?.imageUrl,
    data?.outputUrl,
    data?.url,
    data?.assetUrl,
    data?.videoUrl,
    data?.imageUrl,
  );

  if (!url) return null;

  const kind = normalizeMediaKind(
    firstString(root.type, payload?.type, data?.type),
  );

  return {
    kind,
    url,
    result: root,
  };
}

export async function runOrchestrator(req: NextRequest) {
  const body = (await req.json()) as RequestBody;
  const normalized = normalizeRequest(body);

  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        let streamClosed = false;

        const send = (event: string, data: unknown) => {
          if (streamClosed) return;
          controller.enqueue(sse(event, data));
        };

        const closeStream = (donePayload: Record<string, unknown>) => {
          if (streamClosed) return;
          send("done", donePayload);
          streamClosed = true;
          controller.close();
        };

        try {
          send("phase", { phase: "routing" });

          const route = routeRequest(normalized);

          send("phase", { phase: "building_context", route });

          const assembledContext = await buildContext({
            route,
            userText: normalized.userText,
            messages: normalized.messages,
            context: normalized.context,
          });

          const tools = buildAssistantTools({
            route,
            context: assembledContext,
          });

          const model =
            typeof process.env.OPENAI_MODEL === "string" &&
            process.env.OPENAI_MODEL.trim()
              ? process.env.OPENAI_MODEL.trim()
              : "gpt-4.1";

          const initialInput = buildInputMessages(
            assembledContext.systemPrompt,
            normalized.messages,
            normalized.userText,
          );

          send("phase", { phase: "calling_openai", model });

          let response: any = await client.responses.create({
            model,
            input: initialInput,
            tools,
          });

          let loopCount = 0;
          const maxLoops = 12;
          let mediaResolved = false;

          while (loopCount < maxLoops && !streamClosed) {
            const calls = getFunctionCalls(response);
            if (calls.length === 0) break;

            loopCount += 1;

            const toolOutputs: Array<{
              type: "function_call_output";
              call_id: string;
              output: string;
            }> = [];

            for (const call of calls) {
              if (streamClosed) return;

              send("tool_call", {
                call_id: call.call_id,
                name: call.name,
              });

              let parsedArgs: Record<string, unknown> = {};
              try {
                parsedArgs = JSON.parse(call.arguments || "{}");
              } catch {
                parsedArgs = {};
              }

              try {
                const result = await executeAssistantTool(
                  {
                    name: call.name,
                    args: parsedArgs,
                    route: route as AssistantMode,
                    context: assembledContext,
                  },
                  {
                    onProgress: (text: string) => {
                      if (text && text.trim()) {
                        send("tool_progress", {
                          name: call.name,
                          text,
                        });
                      }
                    },
                  },
                );

                send("tool_result", {
                  name: call.name,
                  result,
                });

                if (
                  result &&
                  typeof result === "object" &&
                  ("action" in result || "payload" in result)
                ) {
                  send("tool_result", result);
                }

                const mediaArtifact =
                  call.name === "generate_media"
                    ? extractMediaArtifact(result)
                    : null;

                if (mediaArtifact) {
                  mediaResolved = true;

                  send("phase", { phase: "media_ready", kind: mediaArtifact.kind });

                  send("media", {
                    kind: mediaArtifact.kind,
                    url: mediaArtifact.url,
                    result: mediaArtifact.result,
                  });

                  if (mediaArtifact.kind === "image") {
                    send("image", {
                      url: mediaArtifact.url,
                      result: mediaArtifact.result,
                    });
                  } else {
                    send("video", {
                      url: mediaArtifact.url,
                      result: mediaArtifact.result,
                    });
                  }

                  closeStream({ ok: true, media: true, kind: mediaArtifact.kind });
                  return;
                }

                toolOutputs.push({
                  type: "function_call_output",
                  call_id: call.call_id,
                  output: JSON.stringify(result ?? null),
                });
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : "tool execution failed";

                send("tool_error", {
                  name: call.name,
                  error: message,
                });

                toolOutputs.push({
                  type: "function_call_output",
                  call_id: call.call_id,
                  output: JSON.stringify({ ok: false, error: message }),
                });
              }
            }

            if (streamClosed) return;
            if (mediaResolved) return;

            send("phase", { phase: "continuing_after_tools" });

            response = await client.responses.create({
              model,
              previous_response_id: response.id,
              input: toolOutputs,
            });
          }

          if (streamClosed) return;

          send("phase", { phase: "finalizing" });

          const finalText = getTextFromResponse(response);

          if (finalText) {
            send("text", { text: finalText });
          } else {
            const outputTypes = Array.isArray(response?.output)
              ? response.output
                  .map((item: any) =>
                    typeof item?.type === "string" ? item.type : "unknown",
                  )
                  .join(", ")
              : "none";

            send("text", {
              text: `I received your message, but no text content was returned by the model. [output types: ${outputTypes}]`,
            });
          }

          closeStream({ ok: true });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "orchestrator failed";

          send("tool_error", { error: message });
          closeStream({ ok: false, error: message });
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    },
  );
}

