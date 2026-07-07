import { type NextRequest } from "next/server";
import { memoryMessagesGET, memoryMessagesPOST } from "@/lib/streams-ai/routes/messages-memory-active";

function encodeSse(event: string, payload: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function streamTextResponse(text: string, metadata: Record<string, unknown> = {}) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSse("activity", {
        phase: "streams.owned.started",
        statusText: "Writing…",
        source: "streams-owned-route",
        startedAt,
        backendProof: { streamsOwned: true, providerBypassed: true, ...metadata },
      })));

      const chunks = String(text || "").match(/[\s\S]{1,900}/g) || [""];
      for (const token of chunks) controller.enqueue(encoder.encode(encodeSse("response", { token })));

      controller.enqueue(encoder.encode(encodeSse("complete", {
        ok: true,
        provider: "streams",
        providerStatus: "ok",
        streamsOwned: true,
        providerBypassed: true,
        elapsedMs: Date.now() - startedAt,
        ...metadata,
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

function safeFallbackStream(error: unknown) {
  const message = [
    "I could not complete that request in the live assistant route.",
    "The app stayed open, but the backend returned an error before the normal streamed answer completed.",
    "Please retry with a shorter check first, or open the deployment logs for the exact server error.",
  ].join("\n\n");
  return streamTextResponse(message, {
    routeFallback: true,
    provider: "streams-memory",
    providerStatus: "fallback",
    error: error instanceof Error ? error.message : String(error || "unknown"),
  });
}

function isSimpleGreeting(_text: string) {
  return false;
}

function isStreamsSystemAuditPrompt(_text: string) {
  return false;
}

function buildStreamsAuditResponse() {
  return [
    "Audit fast path disabled. Normal chat requests are delegated to the active provider route.",
  ].join("\n");
}

export async function GET(request: NextRequest) {
  return memoryMessagesGET(request);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.clone().json().catch(() => ({}));
    const userContent = String(body?.content || body?.message || "").trim();

    if (isSimpleGreeting(userContent)) {
      return streamTextResponse("Hey — I’m here. What are we building or fixing next?", {
        fastPath: "simple-greeting",
      });
    }

    if (isStreamsSystemAuditPrompt(userContent)) {
      return streamTextResponse(buildStreamsAuditResponse(), {
        fastPath: "streams-system-audit",
      });
    }

    const response = await memoryMessagesPOST(request);
    if (response.status >= 400) return safeFallbackStream(`messages route returned ${response.status}`);
    return response;
  } catch (error) {
    return safeFallbackStream(error);
  }
}
