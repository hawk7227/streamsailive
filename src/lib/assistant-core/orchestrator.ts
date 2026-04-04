import { NextRequest } from "next/server";
import { routeRequest } from "./router";
import { buildContext } from "./context";
import { client } from "./openai";
import { buildAssistantTools, executeAssistantTool } from "./tools";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type RequestBody = {
  message?: string;
  messages?: ChatMessage[];
  context?: Record<string, unknown>;
};

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function getTextFromResponse(response: any): string {
  if (!response) return "";

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const chunks: string[] = [];
  const output = Array.isArray(response.output) ? response.output : [];

  for (const item of output) {
    if (typeof item?.text === "string" && item.text.trim()) {
      chunks.push(item.text);
    }

    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim()) {
        chunks.push(part.text);
      }
      if (typeof part?.output_text === "string" && part.output_text.trim()) {
        chunks.push(part.output_text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function getFunctionCalls(response: any): Array<{
  call_id: string;
  name: string;
  arguments: string;
}> {
  const output = Array.isArray(response?.output) ? response.output : [];

  return output
    .filter((item: any) => item?.type === "function_call")
    .map((item: any) => ({
      call_id: String(item.call_id),
      name: String(item.name),
      arguments:
        typeof item.arguments === "string"
          ? item.arguments
          : JSON.stringify(item.arguments ?? {}),
    }));
}

export async function runOrchestrator(req: NextRequest) {
  const body = (await req.json()) as RequestBody;

  const normalized = {
    userText:
      typeof body.message === "string"
        ? body.message
        : Array.isArray(body.messages)
          ? [...body.messages]
              .reverse()
              .find((m) => m.role === "user" && typeof m.content === "string")
              ?.content ?? ""
          : "",
    messages: Array.isArray(body.messages) ? body.messages : [],
    context: body.context ?? {},
  };

  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(new TextEncoder().encode(sse(event, data)));
        };

        try {
          send("phase", { phase: "routing" });

          const route = routeRequest(normalized as any);

          send("phase", { phase: "building_context", route });

          const assembledContext = await buildContext({
            route,
            userText: normalized.userText,
            messages: normalized.messages,
            context: normalized.context,
          } as any);

          send("phase", { phase: "calling_openai" });

          const tools = buildAssistantTools({
            route,
            context: assembledContext,
          } as any);

          const inputMessages = [
            ...(Array.isArray(normalized.messages) ? normalized.messages : []),
            ...(assembledContext?.systemPrompt
              ? [{ role: "system" as const, content: String(assembledContext.systemPrompt) }]
              : []),
          ];

          let response = await client.responses.create({
            model: "gpt-4.1",
            input:
              inputMessages.length > 0
                ? inputMessages
                : [{ role: "user", content: normalized.userText }],
            tools,
          });

          let loopCount = 0;
          const maxLoops = 12;

          while (loopCount < maxLoops) {
            const calls = getFunctionCalls(response);
            if (calls.length === 0) break;

            loopCount += 1;

            const toolOutputs: Array<{
              type: "function_call_output";
              call_id: string;
              output: string;
            }> = [];

            for (const call of calls) {
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
                    route,
                    context: assembledContext,
                  } as any,
                  {
                    onProgress: (text: string) => {
                      send("tool_progress", { name: call.name, text });
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
                  output: JSON.stringify({ error: message }),
                });
              }
            }

            send("phase", { phase: "continuing_after_tools" });

            response = await client.responses.create({
              model: "gpt-4.1",
              previous_response_id: response.id,
              input: toolOutputs,
            });
          }
console.log("OPENAI_RESPONSE_DEBUG", JSON.stringify(response, null, 2));
          const finalText = getTextFromResponse(response);

          if (finalText) {
            send("text", { text: finalText });
          }

          send("done", { ok: true });
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "orchestrator failed";

          send("tool_error", { error: message });
          send("done", { ok: false, error: message });
          controller.close();
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
