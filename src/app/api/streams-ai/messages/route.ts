import { NextRequest } from "next/server";
import { memoryMessagesGET, memoryMessagesPOST } from "@/lib/streams-ai/routes/messages-memory-active";
import { hasImageAttachment, resolveValidationInstruction } from "@/lib/streams-ai/routes/messages-memory-provider-support";
import { requiresDeterministicStructureCheck } from "@/lib/streams-ai/routes/response-structure-validator";
import { collectSseResponse, validateAndRepairResponse } from "@/lib/streams-ai/routes/structured-response-service";

function encodeSse(event: string, payload: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function streamTextResponse(text: string, metadata: Record<string, unknown> = {}) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSse("activity", { phase: "writing", statusText: "Writing…" })));
      for (const token of String(text || "").match(/[\s\S]{1,240}/g) || [""]) {
        controller.enqueue(encoder.encode(encodeSse("response", { token })));
      }
      controller.enqueue(encoder.encode(encodeSse("complete", { ok: true, elapsedMs: Date.now() - startedAt, ...metadata })));
      controller.close();
    },
  }), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function safeFallbackStream() {
  return streamTextResponse("Streams could not complete that response. Please retry.", { status: "error" });
}

function buildInternalRequest(request: NextRequest, body: Record<string, any>) {
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");
  return new NextRequest(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function normalizedRequestBody(body: Record<string, any>) {
  const idempotencyKey = String(body.idempotencyKey || body.userId || "").trim() || crypto.randomUUID();
  const turnId = String(body.turnId || "").trim() || crypto.randomUUID();
  return { ...body, idempotencyKey, turnId };
}

async function persistRepairedTurn(
  request: NextRequest,
  body: Record<string, any>,
  userContent: string,
  repaired: string,
) {
  const userResponse = await memoryMessagesPOST(buildInternalRequest(request, {
    ...body,
    content: userContent,
    message: userContent,
    role: "user",
    runAssistant: false,
  }));
  const userData = await userResponse.json().catch(() => ({}));
  if (!userResponse.ok || !userData?.sessionId || !userData?.message?.id) {
    throw new Error("Could not save validated user turn");
  }

  const assistantResponse = await memoryMessagesPOST(buildInternalRequest(request, {
    sessionId: userData.sessionId,
    content: repaired,
    message: repaired,
    role: "assistant",
    runAssistant: false,
    idempotencyKey: body.idempotencyKey,
    turnId: body.turnId,
    status: "complete",
    metadata: {
      structureValidated: true,
      structureRepaired: true,
      sourceUserMessageId: userData.message.id,
    },
  }));
  const assistantData = await assistantResponse.json().catch(() => ({}));
  if (!assistantResponse.ok || !assistantData?.message?.id) {
    throw new Error("Could not save validated assistant turn");
  }

  return {
    sessionId: userData.sessionId as string,
    assistantMessageId: assistantData.message.id as string,
  };
}

function structuredResponse(
  request: NextRequest,
  body: Record<string, any>,
  userContent: string,
  validationInstruction: string,
) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(encodeSse(event, payload)));
      };

      try {
        const upstream = await memoryMessagesPOST(buildInternalRequest(request, body));
        const collected = await collectSseResponse(upstream, (payload) => send("activity", payload));
        if (!collected.content.trim()) {
          throw new Error(String(collected.errorPayload?.message || "The assistant returned no response to validate"));
        }

        const validated = await validateAndRepairResponse({
          instruction: validationInstruction,
          draft: collected.content,
          forceRepair: Boolean(collected.errorPayload || !collected.completePayload?.ok),
        });

        let sessionId = String(collected.completePayload?.sessionId || "");
        let assistantMessageId = String(collected.completePayload?.assistantMessageId || "");
        if (validated.repaired || !sessionId || !assistantMessageId) {
          const persisted = await persistRepairedTurn(request, body, userContent, validated.content);
          sessionId = persisted.sessionId;
          assistantMessageId = persisted.assistantMessageId;
        }

        send("activity", { phase: "streaming", statusText: "Writing…" });
        for (const token of validated.content.match(/[\s\S]{1,240}/g) || [""]) send("response", { token });
        send("complete", {
          ok: true,
          sessionId,
          assistantMessageId,
          turnId: body.turnId,
          structureValidated: true,
          structureRepaired: validated.repaired,
        });
      } catch (error) {
        console.error("[streams-ai/messages] structured response failed", error);
        send("error", {
          message: "Streams could not complete the requested response format. Please retry.",
          detailCode: "STRUCTURED_RESPONSE_FAILED",
        });
      } finally {
        controller.close();
      }
    },
  }), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET(request: NextRequest) {
  return memoryMessagesGET(request);
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.clone().json().catch(() => ({}));
    const body = normalizedRequestBody(rawBody);
    const userContent = String(body.content || body.message || "").trim();
    const validationInstruction = resolveValidationInstruction(body, userContent);
    const imageAttached = hasImageAttachment(body.attachments);

    if (imageAttached || requiresDeterministicStructureCheck(validationInstruction)) {
      return structuredResponse(request, body, userContent, validationInstruction);
    }

    const response = await memoryMessagesPOST(buildInternalRequest(request, body));
    if (response.status >= 400) return safeFallbackStream();
    return response;
  } catch {
    return safeFallbackStream();
  }
}
