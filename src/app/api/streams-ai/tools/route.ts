import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { StreamsAIToolCallsRepository } from "@/lib/streams-ai/repositories/tool-calls-repository";

const toolCalls = new StreamsAIToolCallsRepository();
const jobs = new StreamsAIJobsRepository();

const allowedProducts = new Set([
  "streams-ai",
  "text-2-image",
  "photo-2-motion",
  "text-2-video",
  "snap-pick-click",
  "voice-captions",
  "idea-2-launch",
]);

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return streamsAIJson({ ok: false, error: "sessionId is required" }, 400);

    const calls = await toolCalls.list(scope, sessionId);
    return streamsAIJson({ ok: true, toolCalls: calls });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      sessionId?: string;
      messageId?: string | null;
      projectId?: string | null;
      toolName?: string;
      productId?: string | null;
      inputJson?: Record<string, unknown>;
      creditEstimate?: number;
    }>(request);

    if (!body.sessionId) return streamsAIJson({ ok: false, error: "sessionId is required" }, 400);
    if (!body.toolName?.trim()) return streamsAIJson({ ok: false, error: "toolName is required" }, 400);

    const productId = body.productId || "streams-ai";
    if (!allowedProducts.has(productId)) {
      return streamsAIJson({ ok: false, error: `Unsupported STREAMS AI product_id: ${productId}` }, 400);
    }

    const toolCall = await toolCalls.create(scope, {
      sessionId: body.sessionId,
      messageId: body.messageId,
      projectId: body.projectId,
      toolName: body.toolName,
      productId,
      inputJson: body.inputJson,
      status: "queued",
    });

    const job = await jobs.create(scope, {
      projectId: body.projectId,
      sessionId: body.sessionId,
      messageId: body.messageId,
      toolCallId: toolCall.id,
      productId,
      kind: body.toolName,
      status: "queued",
      inputJson: body.inputJson,
      creditEstimate: body.creditEstimate || 0,
    });

    return streamsAIJson({
      ok: true,
      toolCall,
      job,
      status: "queued",
      note: "Tool call and job were persisted. Provider execution must be handled by the matching capability worker before any output claim is made.",
    }, 201);
  } catch (error) {
    return streamsAIError(error);
  }
}
