import { NextRequest } from "next/server";
import { memoryMessagesGET, memoryMessagesPOST } from "@/lib/streams-ai/routes/messages-memory-active";
import { resolveValidationInstruction } from "@/lib/streams-ai/routes/messages-memory-provider-support";
import { requiresDeterministicStructureCheck } from "@/lib/streams-ai/routes/response-structure-validator";
import { collectSseResponse, validateAndRepairResponse } from "@/lib/streams-ai/routes/structured-response-service";

type StreamsMessageRequestBody = Record<string, any> & {
  content?: string;
  message?: string;
  attachments?: any[];
  idempotencyKey?: string;
  turnId?: string;
  userId?: string;
  metadata?: Record<string, any>;
};

const ATTACHMENT_ONLY_SENTINEL = "\u200B";

function encodeSse(event: string, payload: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function streamTextResponse(text: string, metadata: Record<string, unknown> = {}) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSse("activity", { phase: "preparing", statusText: "Preparing response…" })));
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

function buildInternalRequest(request: NextRequest, body: StreamsMessageRequestBody) {
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");
  return new NextRequest(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function normalizedRequestBody(body: StreamsMessageRequestBody): StreamsMessageRequestBody {
  const idempotencyKey = String(body.idempotencyKey || body.userId || "").trim() || crypto.randomUUID();
  const turnId = String(body.turnId || "").trim() || crypto.randomUUID();
  return { ...body, idempotencyKey, turnId };
}

function explicitlyRequestsDeterministicStructure(userContent: string, body: StreamsMessageRequestBody) {
  if (body.metadata?.enforceDeterministicStructure === true) return true;
  const text = String(userContent || "");
  if (!text || text === ATTACHMENT_ONLY_SENTINEL) return false;
  return /\b(markdown\s+table|exact\s+columns?|fenced\s+code\s+block|blockquote|numbered\s+sections?|output\s+exactly|use\s+this\s+exact\s+format)\b/i.test(text)
    && requiresDeterministicStructureCheck(text);
}

async function persistRepairedTurn(
  request: NextRequest,
  body: StreamsMessageRequestBody,
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
    sessionId: String(userData.sessionId),
    assistantMessageId: String(assistantData.message.id),
  };
}

function structuredResponse(
  request: NextRequest,
  body: StreamsMessageRequestBody,
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
        const upstreamBody = {
          ...body,
          metadata: {
            ...(body.metadata || {}),
            enforceDeterministicStructure: false,
          },
        };
        const upstream = await memoryMessagesPOST(buildInternalRequest(request, upstreamBody));
        const collected = await collectSseResponse(upstream, (payload) => send("activity", payload));
        const upstreamOk = Boolean(collected.completePayload?.ok) && !collected.errorPayload;
        const validated = await validateAndRepairResponse({
          instruction: validationInstruction,
          draft: collected.content,
          forceRepair: !upstreamOk,
        });

        let sessionId = String(collected.completePayload?.sessionId || "");
        let assistantMessageId = String(collected.completePayload?.assistantMessageId || "");

        if (validated.repaired) {
          send("activity", { phase: "checking", statusText: "Preparing response…" });
          const persisted = await persistRepairedTurn(request, body, userContent, validated.content);
          sessionId = persisted.sessionId;
          assistantMessageId = persisted.assistantMessageId;
        }

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
    const rawBody = await request.clone().json().catch(() => ({} as StreamsMessageRequestBody));
    const body = normalizedRequestBody(rawBody as StreamsMessageRequestBody);
    const userContent = String(body.content || body.message || "").trim();

    if (explicitlyRequestsDeterministicStructure(userContent, body)) {
      const validationInstruction = resolveValidationInstruction(body, userContent);
      return structuredResponse(request, body, userContent, validationInstruction);
    }

    const response = await memoryMessagesPOST(buildInternalRequest(request, body));
    if (response.status >= 400) return safeFallbackStream();
    return response;
  } catch {
    return safeFallbackStream();
  }
}
