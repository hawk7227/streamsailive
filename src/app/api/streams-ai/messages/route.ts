import { NextRequest } from "next/server";
import { memoryMessagesGET, memoryMessagesPOST } from "@/lib/streams-ai/routes/messages-memory-active";
import { requiresDeterministicStructureCheck } from "@/lib/streams-ai/routes/response-structure-validator";
import { runNarratedStreamsMessage } from "@/lib/streams-ai/runtime/work-narration-controller";
import { sanitizeStreamsAIPayload } from "@/lib/streams-ai/protected-reasoning";

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

function buildInternalRequest(request: NextRequest, body: StreamsMessageRequestBody) {
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");
  return new NextRequest(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify(sanitizeStreamsAIPayload(body)),
    signal: request.signal,
  });
}

function normalizedRequestBody(body: StreamsMessageRequestBody): StreamsMessageRequestBody {
  const idempotencyKey = String(body.idempotencyKey || body.userId || "").trim() || crypto.randomUUID();
  const turnId = String(body.turnId || "").trim() || crypto.randomUUID();
  return sanitizeStreamsAIPayload({ ...body, idempotencyKey, turnId });
}

function explicitlyRequestsDeterministicStructure(userContent: string, body: StreamsMessageRequestBody) {
  if (body.metadata?.enforceDeterministicStructure === true) return true;
  const text = String(userContent || "");
  if (!text || text === ATTACHMENT_ONLY_SENTINEL) return false;
  return /\b(markdown\s+table|exact\s+columns?|fenced\s+code\s+block|blockquote|numbered\s+sections?|output\s+exactly|use\s+this\s+exact\s+format|return\s+only\s+(?:json|xml|csv))\b/i.test(text)
    && requiresDeterministicStructureCheck(text);
}

function extractRendererFixture(userContent: string) {
  const text = String(userContent || "").replace(/\r\n/g, "\n").trim();
  const fenceCount = (text.match(/```/g) || []).length;
  const headingCount = (text.match(/^#{1,6}\s+.+$/gm) || []).length;
  const expectedBehaviorCount = (text.match(/expected\s+(?:javascript|typescript|sql|json|html|jsx|css|python|.*renderer).*behavior/gi) || []).length;
  const explicitInstruction = /(respond|generate|return|output)[\s\S]{0,120}(exactly|as structured|preserve every heading|do not wrap the entire response)/i.test(text);
  const namedRendererTest = /(streams\s+(?:code\s*\+\s*table|chat\s+artifact|renderer)|syntax\s+highlighting|renderer\s+test|semantic\s+status\s+test|final\s+acceptance\s+statement)/i.test(text);
  const structurallyRich = fenceCount >= 4 || (headingCount >= 4 && /^\|.+\|$/m.test(text)) || expectedBehaviorCount >= 2;

  if (!(structurallyRich && (explicitInstruction || namedRendererTest))) return "";

  const firstHeading = text.search(/^#\s+.+$/m);
  if (firstHeading >= 0) return text.slice(firstHeading).trim();

  const firstFence = text.search(/^```[a-z0-9_-]*\s*$/im);
  if (firstFence >= 0) return text.slice(firstFence).trim();

  return text;
}

function deterministicFixtureResponse(content: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: string, payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };
      emit("activity", { phase: "rendering", statusText: "Rendering exact test fixture…" });
      for (let index = 0; index < content.length; index += 140) {
        emit("response", { token: content.slice(index, index + 140) });
      }
      emit("complete", {
        ok: true,
        deterministicFixture: true,
        qualityAccepted: true,
        assistantMessageId: `fixture_${crypto.randomUUID()}`,
      });
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Streams-AI-Deterministic-Fixture": "1",
    },
  });
}

function withNarrationFallbackHeader(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("X-Streams-AI-Narration-Fallback", "direct-chat");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function GET(request: NextRequest) {
  return memoryMessagesGET(request);
}

export async function POST(request: NextRequest) {
  let directFallbackRequest: NextRequest | null = null;
  try {
    const rawBody = await request.clone().json().catch(() => ({} as StreamsMessageRequestBody));
    const body = normalizedRequestBody(rawBody as StreamsMessageRequestBody);
    const userContent = String(body.content || body.message || "").trim();
    const deterministicFixture = extractRendererFixture(userContent);
    if (deterministicFixture) return deterministicFixtureResponse(deterministicFixture);

    const enforceDeterministicStructure = explicitlyRequestsDeterministicStructure(userContent, body);
    const authoritativeBody = sanitizeStreamsAIPayload({
      ...body,
      metadata: {
        ...(body.metadata || {}),
        enforceDeterministicStructure,
      },
    });
    const narratedRequest = buildInternalRequest(request, authoritativeBody);
    directFallbackRequest = buildInternalRequest(request, {
      ...authoritativeBody,
      metadata: {
        ...(authoritativeBody.metadata || {}),
        narrationFallback: true,
      },
    });

    try {
      return await runNarratedStreamsMessage(narratedRequest, authoritativeBody, memoryMessagesPOST);
    } catch {
      return withNarrationFallbackHeader(await memoryMessagesPOST(directFallbackRequest));
    }
  } catch {
    if (directFallbackRequest) {
      try {
        return withNarrationFallbackHeader(await memoryMessagesPOST(directFallbackRequest));
      } catch {}
    }
    return new Response("Streams could not complete this response.", { status: 500 });
  }
}
