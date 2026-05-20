import { type NextRequest } from "next/server";
import OpenAI from "openai";
import { requireStreamsAIScope, type StreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAIMessagesRepository } from "@/lib/streams-ai/repositories/messages-repository";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";

const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();

type GuidanceResult = {
  content: string;
  providerStatus: "ok" | "not_configured" | "failed";
  providerError?: string;
};

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return streamsAIJson({ ok: false, error: "sessionId is required" }, 400);

    const session = await sessions.get(scope, sessionId);
    if (!session) return streamsAIJson({ ok: false, error: "Session not found" }, 404);

    const data = await messages.list(scope, sessionId);
    return streamsAIJson({ ok: true, messages: data });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      sessionId?: string;
      role?: "user" | "assistant" | "system" | "tool";
      content?: string;
      message?: string;
      status?: string;
      metadata?: Record<string, unknown>;
      runAssistant?: boolean;
      userId?: string;
    }>(request);

    const content = (body.content || body.message || "").trim();
    if (!content) return streamsAIJson({ ok: false, error: "content or message is required" }, 400);

    let sessionId = body.sessionId || "";
    if (!sessionId) {
      const created = await sessions.create(scope, {
        title: titleFromMessage(content),
        metadata: { source: "copied-streams-chat-ui", adapter: "legacy-message-body" },
      });
      sessionId = created.id;
    }

    const userMessage = await messages.create(scope, {
      sessionId,
      role: body.role || "user",
      content,
      status: body.status || "complete",
      metadata: {
        ...(body.metadata || {}),
        copiedUiUserId: body.userId || null,
      },
    });

    const shouldRunAssistant = body.runAssistant !== false;
    if (!shouldRunAssistant) {
      return streamsAIJson({ ok: true, sessionId, message: userMessage, messages: [userMessage] }, 201);
    }

    return streamAssistantResponse({ scope, sessionId, content });
  } catch (error) {
    return streamsAIError(error);
  }
}

function streamAssistantResponse({ scope, sessionId, content }: { scope: StreamsAIScope; sessionId: string; content: string }) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        send("activity", { statusText: "Thinking" });
        const guidance = await runGuidanceResponse(content);

        const assistantMessage = await messages.create(scope, {
          sessionId,
          role: "assistant",
          content: guidance.content,
          status: "complete",
          metadata: {
            source: "streams-ai-guidance",
            providerStatus: guidance.providerStatus,
            providerError: guidance.providerError || null,
            note: "Guidance-only response. Capability execution still requires tool/job routing.",
          },
        });

        const chunks = chunkText(guidance.content);
        for (const token of chunks) {
          send("response", { token });
        }

        send("complete", {
          ok: true,
          sessionId,
          assistantMessageId: assistantMessage.id,
          providerStatus: guidance.providerStatus,
        });
      } catch (error) {
        const fallback = providerFallback(error);
        try {
          const assistantMessage = await messages.create(scope, {
            sessionId,
            role: "assistant",
            content: fallback.content,
            status: "complete",
            metadata: {
              source: "streams-ai-guidance",
              providerStatus: "failed",
              providerError: fallback.providerError || null,
              note: "Fallback response saved after assistant provider failure.",
            },
          });

          for (const token of chunkText(fallback.content)) {
            send("response", { token });
          }
          send("complete", { ok: true, sessionId, assistantMessageId: assistantMessage.id, providerStatus: "failed" });
        } catch (persistError) {
          send("error", { message: persistError instanceof Error ? persistError.message : String(persistError) });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function chunkText(text: string) {
  const parts = text.match(/.{1,24}(\s|$)/g);
  return parts?.length ? parts : [text];
}

function titleFromMessage(message: string) {
  const clean = message.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > 58 ? `${clean.slice(0, 58)}…` : clean;
}

function providerFallback(error: unknown): GuidanceResult {
  const message = error instanceof Error ? error.message : String(error || "Unknown provider failure");
  return {
    providerStatus: "failed",
    providerError: message,
    content: [
      "STREAMS AI saved your message, but the live assistant provider did not complete successfully.",
      "",
      "The chat session and your message are stored. Check OPENAI_API_KEY / OPENAI_MODEL in the deployment environment, then retry.",
    ].join("\n"),
  };
}

async function runGuidanceResponse(userContent: string): Promise<GuidanceResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      providerStatus: "not_configured",
      content: [
        "STREAMS AI saved your message, but assistant generation is not enabled because OPENAI_API_KEY is not configured in this deployment.",
        "",
        "Next production step: configure OpenAI, then route this request through the STREAMS AI orchestrator with scoped sessions, messages, assets, jobs, credits, and provider-run tracking.",
      ].join("\n"),
    };
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1",
      input: [
        {
          role: "system",
          content:
            "You are STREAMS AI. Give business/growth guidance only. Do not claim that media generation, jobs, credits, or storage actions have run unless the request is routed through the production tool/job APIs.",
        },
        { role: "user", content: userContent },
      ],
    });

    return {
      providerStatus: "ok",
      content: response.output_text || "STREAMS AI completed the guidance response.",
    };
  } catch (error) {
    return providerFallback(error);
  }
}
