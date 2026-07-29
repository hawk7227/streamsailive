import { NextRequest } from "next/server";
import { runOrchestrator } from "@/lib/assistant-core/orchestrator";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function emit(event: string, payload: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function parseBlocks(buffer: string): { blocks: string[]; rest: string } {
  const parts = buffer.split("\n\n");
  return { blocks: parts.slice(0, -1), rest: parts.at(-1) || "" };
}

function parseBlock(block: string): { event: string; payload: Record<string, unknown> } | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  try {
    const parsed = JSON.parse(data.join("\n"));
    return { event, payload: parsed && typeof parsed === "object" ? parsed : { value: parsed } };
  } catch {
    return { event, payload: { message: data.join("\n") } };
  }
}

function translateEvent(event: string, payload: Record<string, unknown>) {
  switch (event) {
    case "phase":
      return { event: "activity", payload: { ...payload, statusText: payload.phase || "Working…" } };
    case "text_delta":
      return { event: "response", payload: { token: payload.delta || "" } };
    case "done":
      return { event: "complete", payload };
    case "tool_progress":
      return { event: "activity", payload: { ...payload, statusText: payload.text || "Using a connected tool…" } };
    default:
      return { event, payload };
  }
}

export async function runUnifiedStreamsAssistant(
  request: NextRequest,
  body: Record<string, any>,
  userContent: string,
): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");

  const upstream = await runOrchestrator(new NextRequest(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: userContent,
      messages: Array.isArray(body.messages) ? body.messages : undefined,
      context: {
        ...(body.context || {}),
        ...(body.metadata || {}),
        sessionId: body.sessionId || undefined,
        conversationId: body.sessionId || body.conversationId || undefined,
        workspaceId: body.workspaceId || body.metadata?.workspaceId || undefined,
        turnId: body.turnId,
        attachments: body.attachments || [],
      },
    }),
    signal: request.signal,
  }));

  if (!upstream.body) return upstream;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseBlocks(buffer);
          buffer = parsed.rest;
          for (const block of parsed.blocks) {
            const item = parseBlock(block);
            if (!item) continue;
            const translated = translateEvent(item.event, item.payload);
            controller.enqueue(emit(translated.event, translated.payload));
          }
        }
        if (buffer.trim()) {
          const item = parseBlock(buffer);
          if (item) {
            const translated = translateEvent(item.event, item.payload);
            controller.enqueue(emit(translated.event, translated.payload));
          }
        }
      } catch (error) {
        controller.enqueue(emit("error", {
          message: error instanceof Error ? error.message : "Unified assistant stream failed",
        }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Streams-AI-Route": "assistant-core-unified",
    },
  });
}
