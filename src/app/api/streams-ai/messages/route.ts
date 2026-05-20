import { type NextRequest } from "next/server";
import OpenAI from "openai";
import { requireStreamsAIScope, type StreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAIMessagesRepository } from "@/lib/streams-ai/repositories/messages-repository";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";

const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();

const LIVE_ASSISTANT_SOURCE = "streams-ai-openai-live-assistant";
const DEFAULT_OPENAI_MODEL = "gpt-4.1";
const MAX_HISTORY_MESSAGES = 28;
const MAX_MESSAGE_CHARS = 32000;

type AssistantProviderStatus = "ok" | "not_configured" | "failed";

type AssistantResult = {
  content: string;
  providerStatus: AssistantProviderStatus;
  providerError?: string;
  responseId?: string | null;
  model?: string;
  usage?: Record<string, unknown> | null;
};

type StreamSend = (event: string, payload: Record<string, unknown>) => void;

type PersistedChatMessage = {
  role?: string | null;
  content?: string | null;
  status?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type OpenAIStreamEvent = {
  type?: string;
  delta?: string;
  text?: string;
  response?: {
    id?: string;
    output_text?: string;
    usage?: Record<string, unknown>;
  };
  error?: {
    message?: string;
  };
};

const STREAMS_LIVE_ASSISTANT_INSTRUCTIONS = [
  "You are STREAMS AI, a full live OpenAI-powered assistant inside the STREAMS chat interface.",
  "You are not limited to business or growth guidance. Help across the full assistant range: general questions, coding, debugging, architecture, files, UI/UX, product strategy, writing, planning, marketplace help, Shopify, AI media systems, terminal guidance, deployment guidance, and production audits.",
  "OpenAI is the single reasoning brain. STREAMS owns runtime, UI, persistence, tools, jobs, assets, providers, storage, previews, credits, permissions, and proof.",
  "Use OpenAI knowledge and the conversation/file context supplied by STREAMS. Do not pretend to have hidden access to ChatGPT private account tools, Gmail, calendar, local computer, browser, Vercel, Supabase, provider dashboards, or repositories unless STREAMS has explicitly supplied that information through the request or a real tool result.",
  "Be maximally capable but truth-bound. Answer directly, reason deeply, and produce useful code/specs/checklists/instructions when asked.",
  "Never fake external actions. Do not claim images, videos, voice, files, emails, calendar actions, provider runs, storage uploads, database writes, repo edits, browser actions, or deployments happened unless a real STREAMS backend tool/job/provider/storage path has executed and returned proof.",
  "When a requested action requires a tool that is not currently executed in this chat turn, explain the required STREAMS production path: persisted tool call, durable job, provider run, storage upload, asset row, job events, and frontend render from real state.",
  "For production build/audit work, classify claims as Proven, Implemented but unproven, Blocked, or Rejected. Do not call something complete unless source, runtime, persistence, output, and fake-layer-removal proof exist where relevant.",
  "For STREAMS architecture, preserve the locked flow: normalize -> route -> context -> OpenAI -> stream -> tools -> continue -> complete.",
  "Keep existing STREAMS UI/system behavior intact. Do not recommend removing existing shells, bridges, routes, capability cards, upload behavior, sidebars, preview surfaces, or module surfaces unless the user explicitly asks for that cleanup.",
  "Use concise language by default, but provide non-consolidated detail when the user asks for it.",
].join("\n");

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
        metadata: {
          source: "copied-streams-chat-ui",
          adapter: "legacy-message-body",
          assistantRuntime: LIVE_ASSISTANT_SOURCE,
          mode: "full-live-assistant",
        },
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
        assistantRuntime: LIVE_ASSISTANT_SOURCE,
        mode: "full-live-assistant",
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
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: StreamSend = (event, payload) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        send("activity", {
          phase: "turn.started",
          statusText: "Understanding…",
          source: LIVE_ASSISTANT_SOURCE,
          startedAt,
        });

        const history = await messages.list(scope, sessionId);
        const assistant = await runLiveOpenAIResponse({
          history,
          scope,
          sessionId,
          send,
        });

        const assistantMessage = await messages.create(scope, {
          sessionId,
          role: "assistant",
          content: assistant.content,
          status: "complete",
          metadata: {
            source: LIVE_ASSISTANT_SOURCE,
            provider: "openai",
            providerStatus: assistant.providerStatus,
            providerError: assistant.providerError || null,
            openaiModel: assistant.model || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
            openaiResponseId: assistant.responseId || null,
            openaiUsage: assistant.usage || null,
            runtimeContract: "full_live_assistant_preserving_existing_streams_ui",
            proofNote: "Assistant text was generated through the server-side OpenAI Responses API path. External actions still require real STREAMS tool/job/provider/storage execution before output claims are made.",
          },
        });

        if (assistant.providerStatus !== "ok") {
          for (const token of chunkText(assistant.content)) send("response", { token });
        }

        send("complete", {
          ok: true,
          sessionId,
          assistantMessageId: assistantMessage.id,
          provider: "openai",
          providerStatus: assistant.providerStatus,
          responseId: assistant.responseId || null,
          elapsedMs: Date.now() - startedAt,
          source: LIVE_ASSISTANT_SOURCE,
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
              source: LIVE_ASSISTANT_SOURCE,
              provider: "openai",
              providerStatus: "failed",
              providerError: fallback.providerError || null,
              proofNote: "Fallback response saved after live OpenAI assistant failure.",
            },
          });

          for (const token of chunkText(fallback.content)) send("response", { token });
          send("complete", {
            ok: true,
            sessionId,
            assistantMessageId: assistantMessage.id,
            provider: "openai",
            providerStatus: "failed",
            elapsedMs: Date.now() - startedAt,
            source: LIVE_ASSISTANT_SOURCE,
          });
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

async function runLiveOpenAIResponse({
  history,
  scope,
  sessionId,
  send,
}: {
  history: PersistedChatMessage[];
  scope: StreamsAIScope;
  sessionId: string;
  send: StreamSend;
}): Promise<AssistantResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

  if (!apiKey) {
    return {
      providerStatus: "not_configured",
      model,
      content: [
        "STREAMS AI saved your message, but the live OpenAI assistant is not enabled because OPENAI_API_KEY is not configured in this deployment.",
        "",
        "Required production wiring: set OPENAI_API_KEY server-side in Vercel/local env, keep it out of NEXT_PUBLIC variables, then retry this chat route.",
      ].join("\n"),
    };
  }

  try {
    const client = new OpenAI({ apiKey });
    const input = buildOpenAIInput(history);
    let content = "";
    let responseId: string | null = null;
    let usage: Record<string, unknown> | null = null;

    send("activity", {
      phase: "openai.started",
      statusText: "Connected to OpenAI live assistant…",
      model,
      source: LIVE_ASSISTANT_SOURCE,
    });

    const responseStream = (await client.responses.create({
      model,
      instructions: STREAMS_LIVE_ASSISTANT_INSTRUCTIONS,
      input,
      stream: true,
      store: true,
      metadata: {
        product: "streams-ai",
        runtime: LIVE_ASSISTANT_SOURCE,
        tenantId: String(scope.tenantId || ""),
        sessionId: String(sessionId || ""),
      },
    })) as unknown as AsyncIterable<OpenAIStreamEvent>;

    for await (const event of responseStream) {
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        content += event.delta;
        send("response", { token: event.delta });
        continue;
      }

      if (event.type === "response.output_text.done" && !content && typeof event.text === "string") {
        content = event.text;
        send("response", { token: event.text });
        continue;
      }

      if (event.type === "response.completed") {
        responseId = event.response?.id || responseId;
        usage = event.response?.usage || usage;
        if (!content && event.response?.output_text) {
          content = event.response.output_text;
          send("response", { token: content });
        }
        continue;
      }

      if (event.type === "response.failed") {
        throw new Error(event.error?.message || "OpenAI response failed.");
      }
    }

    const finalContent = content.trim() || "STREAMS AI completed the live OpenAI response.";
    return {
      providerStatus: "ok",
      content: finalContent,
      responseId,
      model,
      usage,
    };
  } catch (error) {
    return providerFallback(error, model);
  }
}

function buildOpenAIInput(history: PersistedChatMessage[]) {
  const safeHistory = history
    .filter((message) => String(message.content || "").trim())
    .slice(-MAX_HISTORY_MESSAGES);

  if (!safeHistory.length) {
    return [{ role: "user", content: "Hello" }];
  }

  return safeHistory.map((message) => ({
    role: normalizeOpenAIRole(message.role),
    content: String(message.content || "").slice(0, MAX_MESSAGE_CHARS),
  }));
}

function normalizeOpenAIRole(role: string | null | undefined) {
  if (role === "assistant") return "assistant";
  if (role === "system") return "system";
  return "user";
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

function providerFallback(error: unknown, model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL): AssistantResult {
  const message = error instanceof Error ? error.message : String(error || "Unknown provider failure");
  return {
    providerStatus: "failed",
    providerError: message,
    model,
    content: [
      "STREAMS AI saved your message, but the live OpenAI assistant did not complete successfully.",
      "",
      "The chat session and your message are stored. Check OPENAI_API_KEY / OPENAI_MODEL in the deployment environment, then retry.",
      "",
      `Provider error: ${message}`,
    ].join("\n"),
  };
}
