import { type NextRequest } from "next/server";
import OpenAI from "openai";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAIMessagesRepository } from "@/lib/streams-ai/repositories/messages-repository";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";

const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();

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

    const assistantContent = await runGuidanceResponse(content);
    const assistantMessage = await messages.create(scope, {
      sessionId,
      role: "assistant",
      content: assistantContent,
      status: "complete",
      metadata: {
        source: "streams-ai-guidance",
        note: "Guidance-only response. Capability execution still requires tool/job routing.",
      },
    });

    return streamsAIJson(
      {
        ok: true,
        sessionId,
        message: assistantMessage,
        userMessage,
        assistantMessage,
        messages: [userMessage, assistantMessage],
        reply: assistantContent,
        content: assistantContent,
        text: assistantContent,
      },
      201,
    );
  } catch (error) {
    return streamsAIError(error);
  }
}

function titleFromMessage(message: string) {
  const clean = message.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > 58 ? `${clean.slice(0, 58)}…` : clean;
}

async function runGuidanceResponse(userContent: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return [
      "STREAMS AI saved your message, but assistant generation is not enabled because OPENAI_API_KEY is not configured in this deployment.",
      "",
      "Next production step: configure OpenAI, then route this request through the STREAMS AI orchestrator with scoped sessions, messages, assets, jobs, credits, and provider-run tracking.",
    ].join("\n");
  }

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

  return response.output_text || "STREAMS AI completed the guidance response.";
}
