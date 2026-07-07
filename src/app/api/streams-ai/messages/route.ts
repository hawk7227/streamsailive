import { type NextRequest } from "next/server";
import { memoryMessagesGET, memoryMessagesPOST } from "@/lib/streams-ai/routes/messages-memory-active";

function encodeSse(event: string, payload: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function safeFallbackStream(error: unknown) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const message = [
    "I could not complete that request in the live assistant route.",
    "The app stayed open, but the backend returned an error before the normal streamed answer completed.",
    "Please retry with a shorter check first, or open the deployment logs for the exact server error.",
  ].join("\n\n");

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSse("activity", {
        phase: "route.fallback",
        statusText: "Provider error",
        source: "streams-ai-route-safety",
        startedAt,
      })));
      controller.enqueue(encoder.encode(encodeSse("response", { token: message })));
      controller.enqueue(encoder.encode(encodeSse("complete", {
        ok: true,
        provider: "streams-memory",
        providerStatus: "fallback",
        routeFallback: true,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error || "unknown"),
      })));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function GET(request: NextRequest) {
  return memoryMessagesGET(request);
}

export async function POST(request: NextRequest) {
  try {
    const response = await memoryMessagesPOST(request);
    if (response.status >= 400) return safeFallbackStream(`messages route returned ${response.status}`);
    return response;
  } catch (error) {
    return safeFallbackStream(error);
  }
}
