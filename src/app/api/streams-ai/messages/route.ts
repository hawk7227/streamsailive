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
