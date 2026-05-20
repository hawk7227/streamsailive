import { type NextRequest } from "next/server";
import OpenAI from "openai";
import { requireStreamsAIScope, type StreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAIAssetsRepository } from "@/lib/streams-ai/repositories/assets-repository";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { StreamsAIMessagesRepository } from "@/lib/streams-ai/repositories/messages-repository";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";
import { StreamsAIToolCallsRepository } from "@/lib/streams-ai/repositories/tool-calls-repository";

const assets = new StreamsAIAssetsRepository();
const jobs = new StreamsAIJobsRepository();
const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();
const toolCalls = new StreamsAIToolCallsRepository();

const LIVE_ASSISTANT_SOURCE = "streams-ai-openai-live-assistant";
const DEFAULT_OPENAI_MODEL = "gpt-4.1";
const MAX_HISTORY_MESSAGES = 28;
const MAX_MESSAGE_CHARS = 32000;
const MAX_TOOL_ROUNDS = 2;

type AssistantProviderStatus = "ok" | "not_configured" | "failed";

type AssistantResult = {
  content: string;
  providerStatus: AssistantProviderStatus;
  providerError?: string;
  responseId?: string | null;
  model?: string;
  usage?: Record<string, unknown> | null;
  toolCalls?: ExecutedToolResult[];
};

type StreamSend = (event: string, payload: Record<string, unknown>) => void;

type PersistedChatMessage = {
  role?: string | null;
  content?: string | null;
  status?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type OpenAIInputMessage = {
  role: "user" | "assistant";
  content: string;
};

type OpenAIToolCall = {
  id?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
};

type ExecutedToolResult = {
  callId: string;
  name: string;
  ok: boolean;
  result: Record<string, unknown>;
};

type OpenAIStreamEvent = {
  type?: string;
  delta?: string;
  text?: string;
  item?: {
    type?: string;
    id?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
  };
  output_item?: {
    type?: string;
    id?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
  };
  response?: {
    id?: string;
    output_text?: string;
    usage?: Record<string, unknown>;
    output?: Array<{
      type?: string;
      id?: string;
      call_id?: string;
      name?: string;
      arguments?: string;
    }>;
  };
  error?: {
    message?: string;
  };
};

type ResponsesCreateStream = (args: Record<string, unknown>) => Promise<AsyncIterable<OpenAIStreamEvent>>;

const STREAMS_APPROVED_TOOL_NAMES = new Set([
  "list_streams_capabilities",
  "create_streams_tool_job",
  "list_streams_jobs",
  "list_streams_assets",
]);

const STREAMS_OPENAI_TOOLS = [
  {
    type: "function",
    name: "list_streams_capabilities",
    description: "List the approved STREAMS backend tools currently exposed to the live assistant and their proof status.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
  {
    type: "function",
    name: "create_streams_tool_job",
    description: "Persist an approved STREAMS tool call and durable queued job. This does not claim provider execution or output creation; it only creates the real backend records needed for workers/providers to process next.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        toolName: {
          type: "string",
          description: "Approved STREAMS capability kind to queue, for example image_generation, text_to_video, image_to_video, code_audit, file_analysis, artifact_generation, voice_generation, music_generation, preview_action, or build_audit.",
        },
        productId: {
          type: "string",
          description: "STREAMS product/module id. Defaults to streams-ai.",
        },
        projectId: {
          type: "string",
          description: "Optional project id when the action belongs to a project.",
        },
        inputJson: {
          type: "object",
          description: "Structured user request and normalized tool input. Must not include secrets.",
          additionalProperties: true,
        },
        creditEstimate: {
          type: "number",
          description: "Optional non-binding credit estimate. Defaults to 0.",
        },
      },
      required: ["toolName"],
    },
  },
  {
    type: "function",
    name: "list_streams_jobs",
    description: "Read recent persisted STREAMS jobs for this chat/session so the assistant can reason from real backend state.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: {
          type: "string",
          description: "Optional job status filter such as queued, running, complete, failed, or cancelled.",
        },
        limit: {
          type: "number",
          description: "Maximum jobs to return, capped by the backend.",
        },
      },
    },
  },
  {
    type: "function",
    name: "list_streams_assets",
    description: "Read recent persisted STREAMS assets for this chat/session so the assistant can answer from real uploaded/generated asset records.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        projectId: {
          type: "string",
          description: "Optional project id filter.",
        },
        limit: {
          type: "number",
          description: "Maximum assets to return, capped by the backend.",
        },
      },
    },
  },
];

const STREAMS_LIVE_ASSISTANT_INSTRUCTIONS = [
  "You are STREAMS AI, a full live OpenAI-powered assistant inside the STREAMS chat interface.",
  "You are not limited to business or growth guidance. Help across the full assistant range: general questions, coding, debugging, architecture, files, UI/UX, product strategy, writing, planning, marketplace help, Shopify, AI media systems, terminal guidance, deployment guidance, and production audits.",
  "OpenAI is the single reasoning brain. STREAMS owns runtime, UI, persistence, tools, jobs, assets, providers, storage, previews, credits, permissions, and proof.",
  "Use approved function tools when the user asks to inspect STREAMS state, queue a backend capability, list jobs, list assets, or create the real job record needed for later provider execution.",
  "Tool calls are real backend actions only when the tool result says ok=true. If a tool result creates a queued job, say the job was queued/persisted, not that the provider output was generated.",
  "Use OpenAI knowledge and the conversation/file context supplied by STREAMS. Do not pretend to have hidden access to ChatGPT private account tools, Gmail, calendar, local computer, browser, Vercel, Supabase, provider dashboards, or repositories unless STREAMS has explicitly supplied that information through the request or a real tool result.",
  "Be maximally capable but truth-bound. Answer directly, reason deeply, and produce useful code/specs/checklists/instructions when asked.",
  "Never fake external actions. Do not claim images, videos, voice, files, emails, calendar actions, provider runs, storage uploads, database writes, repo edits, browser actions, or deployments happened unless a real STREAMS backend tool/job/provider/storage path has executed and returned proof.",
  "When a requested action requires a provider/worker that has not executed yet, explain the required STREAMS production path: persisted tool call, durable job, provider run, storage upload, asset row, job events, and frontend render from real state.",
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
          toolLoop: "enabled",
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
        toolLoop: "enabled",
      },
    });

    const shouldRunAssistant = body.runAssistant !== false;
    if (!shouldRunAssistant) {
      return streamsAIJson({ ok: true, sessionId, message: userMessage, messages: [userMessage] }, 201);
    }

    return streamAssistantResponse({ scope, sessionId });
  } catch (error) {
    return streamsAIError(error);
  }
}

function streamAssistantResponse({ scope, sessionId }: { scope: StreamsAIScope; sessionId: string }) {
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
            toolLoop: "enabled",
            toolCalls: assistant.toolCalls || [],
            runtimeContract: "full_live_assistant_with_approved_streams_tool_loop",
            proofNote: "Assistant text was generated through the server-side OpenAI Responses API path. Approved STREAMS tools may create/read real backend records. Provider output still requires workers/providers/storage before output claims are made.",
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
          toolCalls: assistant.toolCalls || [],
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
              proofNote: "Fallback response saved after live OpenAI assistant/tool-loop failure.",
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
    const createStream = client.responses.create.bind(client.responses) as unknown as ResponsesCreateStream;
    const input = buildOpenAIInput(history);
    const executedTools: ExecutedToolResult[] = [];

    send("activity", {
      phase: "openai.started",
      statusText: "Connected to OpenAI live assistant…",
      model,
      source: LIVE_ASSISTANT_SOURCE,
    });

    const firstPass = await runOpenAIStream({
      createStream,
      model,
      input,
      send,
      metadata: buildOpenAIMetadata(scope, sessionId, "first-pass"),
      tools: STREAMS_OPENAI_TOOLS,
    });

    executedTools.push(...await executeToolCalls({
      calls: firstPass.toolCalls,
      scope,
      sessionId,
      send,
    }));

    if (!executedTools.length) {
      return {
        providerStatus: "ok",
        content: firstPass.content.trim() || "STREAMS AI completed the live OpenAI response.",
        responseId: firstPass.responseId,
        model,
        usage: firstPass.usage,
        toolCalls: executedTools,
      };
    }

    let finalPass = firstPass;
    for (let round = 0; round < MAX_TOOL_ROUNDS && executedTools.length; round += 1) {
      if (!finalPass.responseId) break;
      send("activity", {
        phase: "openai.continuing",
        statusText: "Reading tool results…",
        model,
        source: LIVE_ASSISTANT_SOURCE,
        round: round + 1,
      });

      finalPass = await runOpenAIStream({
        createStream,
        model,
        input: buildToolOutputInput(executedTools),
        send,
        previousResponseId: finalPass.responseId,
        metadata: buildOpenAIMetadata(scope, sessionId, `tool-continuation-${round + 1}`),
        tools: STREAMS_OPENAI_TOOLS,
      });

      const nextToolResults = await executeToolCalls({
        calls: finalPass.toolCalls,
        scope,
        sessionId,
        send,
      });
      if (!nextToolResults.length) break;
      executedTools.push(...nextToolResults);
    }

    const content = finalPass.content.trim() || firstPass.content.trim() || summarizeToolResults(executedTools);
    return {
      providerStatus: "ok",
      content,
      responseId: finalPass.responseId || firstPass.responseId,
      model,
      usage: finalPass.usage || firstPass.usage,
      toolCalls: executedTools,
    };
  } catch (error) {
    return providerFallback(error, model);
  }
}

async function runOpenAIStream({
  createStream,
  model,
  input,
  send,
  previousResponseId,
  metadata,
  tools,
}: {
  createStream: ResponsesCreateStream;
  model: string;
  input: unknown;
  send: StreamSend;
  previousResponseId?: string | null;
  metadata: Record<string, string>;
  tools?: unknown[];
}) {
  let content = "";
  let responseId: string | null = null;
  let usage: Record<string, unknown> | null = null;
  const toolCallsToRun: OpenAIToolCall[] = [];

  const responseStream = await createStream({
    model,
    instructions: STREAMS_LIVE_ASSISTANT_INSTRUCTIONS,
    input,
    stream: true,
    store: true,
    metadata,
    ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
    ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
  });

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

    if ((event.type === "response.output_item.done" || event.type === "response.output_item.added") && isFunctionCallItem(event.item || event.output_item)) {
      const call = normalizeToolCall(event.item || event.output_item);
      if (call) toolCallsToRun.push(call);
      continue;
    }

    if (event.type === "response.completed") {
      responseId = event.response?.id || responseId;
      usage = event.response?.usage || usage;
      if (!content && event.response?.output_text) {
        content = event.response.output_text;
        send("response", { token: content });
      }
      for (const output of event.response?.output || []) {
        if (isFunctionCallItem(output)) {
          const call = normalizeToolCall(output);
          if (call) toolCallsToRun.push(call);
        }
      }
      continue;
    }

    if (event.type === "response.failed") {
      throw new Error(event.error?.message || "OpenAI response failed.");
    }
  }

  return {
    content,
    responseId,
    usage,
    toolCalls: dedupeToolCalls(toolCallsToRun),
  };
}

function isFunctionCallItem(item: unknown): item is { type?: string; name?: string; arguments?: string; call_id?: string; id?: string } {
  if (!item || typeof item !== "object") return false;
  const typed = item as { type?: string; name?: string };
  return typed.type === "function_call" && typeof typed.name === "string";
}

function normalizeToolCall(item: { id?: string; call_id?: string; name?: string; arguments?: string }): OpenAIToolCall | null {
  if (!item.name || !STREAMS_APPROVED_TOOL_NAMES.has(item.name)) return null;
  const callId = item.call_id || item.id;
  if (!callId) return null;
  return {
    id: item.id,
    call_id: callId,
    name: item.name,
    arguments: item.arguments || "{}",
  };
}

function dedupeToolCalls(calls: OpenAIToolCall[]) {
  const seen = new Set<string>();
  return calls.filter((call) => {
    const key = `${call.call_id || call.id || ""}:${call.name || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function executeToolCalls({
  calls,
  scope,
  sessionId,
  send,
}: {
  calls: OpenAIToolCall[];
  scope: StreamsAIScope;
  sessionId: string;
  send: StreamSend;
}) {
  const executed: ExecutedToolResult[] = [];
  for (const call of calls) {
    const name = call.name || "unknown";
    const callId = call.call_id || call.id || createStableToolCallId(name);
    send("activity", { phase: "tool.started", statusText: `Running ${name.replace(/_/g, " ")}…`, toolName: name, callId });
    send("tool", { status: "started", toolName: name, callId });

    try {
      const args = parseToolArguments(call.arguments);
      const result = await executeApprovedTool({ name, args, scope, sessionId });
      const record = { callId, name, ok: true, result };
      executed.push(record);
      send("tool", { status: "completed", toolName: name, callId, result });
      send("activity", { phase: "tool.completed", statusText: `${name.replace(/_/g, " ")} completed.`, toolName: name, callId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Tool failed");
      const record = { callId, name, ok: false, result: { error: message } };
      executed.push(record);
      send("tool", { status: "failed", toolName: name, callId, error: message });
      send("activity", { phase: "tool.failed", statusText: `${name.replace(/_/g, " ")} failed.`, toolName: name, callId, error: message });
    }
  }
  return executed;
}

async function executeApprovedTool({
  name,
  args,
  scope,
  sessionId,
}: {
  name: string;
  args: Record<string, unknown>;
  scope: StreamsAIScope;
  sessionId: string;
}) {
  if (!STREAMS_APPROVED_TOOL_NAMES.has(name)) throw new Error(`Tool is not approved: ${name}`);

  if (name === "list_streams_capabilities") {
    return {
      capabilities: [
        { name: "list_streams_capabilities", status: "proven_source", action: "Lists approved backend tools exposed to OpenAI." },
        { name: "create_streams_tool_job", status: "persistence_only", action: "Creates real tool_call and queued job rows. Provider execution is not claimed." },
        { name: "list_streams_jobs", status: "proven_source", action: "Reads persisted jobs owned by the current user/session." },
        { name: "list_streams_assets", status: "proven_source", action: "Reads persisted assets owned by the current user/session." },
      ],
      nextRequiredForFullCapabilities: [
        "worker pickup",
        "provider execution",
        "provider_runs rows",
        "storage upload",
        "asset creation from provider output",
        "job_events status updates",
        "frontend artifact rendering from stored output",
      ],
    };
  }

  if (name === "create_streams_tool_job") {
    const toolName = safeString(args.toolName || args.kind || "chat_tool").slice(0, 80);
    const productId = safeString(args.productId || "streams-ai").slice(0, 80);
    const projectId = safeOptionalString(args.projectId);
    const inputJson = sanitizeToolInput(args.inputJson) || sanitizeToolInput(args) || {};
    const creditEstimate = typeof args.creditEstimate === "number" && Number.isFinite(args.creditEstimate) ? args.creditEstimate : 0;

    const toolCall = await toolCalls.create(scope, {
      sessionId,
      projectId,
      toolName,
      productId,
      inputJson,
      status: "queued",
    });

    const job = await jobs.create(scope, {
      projectId,
      sessionId,
      toolCallId: toolCall.id,
      productId,
      kind: toolName,
      status: "queued",
      inputJson,
      creditEstimate,
    });

    return {
      status: "queued",
      proof: "persisted_tool_call_and_job",
      toolCallId: toolCall.id,
      jobId: job.id,
      jobStatus: job.status,
      jobKind: job.kind,
      productId: job.product_id || productId,
      note: "This proves the backend tool/job records were created. It does not prove provider execution, storage upload, or generated output.",
    };
  }

  if (name === "list_streams_jobs") {
    const status = safeOptionalString(args.status);
    const limit = clampLimit(args.limit, 12);
    const rows = await jobs.list(scope, { sessionId, status });
    return {
      count: rows.length,
      jobs: rows.slice(0, limit).map((job) => ({
        id: job.id,
        kind: job.kind,
        status: job.status,
        productId: job.product_id,
        toolCallId: job.tool_call_id,
        createdAt: job.created_at,
        inputJson: job.input_json,
      })),
    };
  }

  if (name === "list_streams_assets") {
    const projectId = safeOptionalString(args.projectId);
    const limit = clampLimit(args.limit, 12);
    const rows = await assets.list(scope, { projectId, sessionId });
    return {
      count: rows.length,
      assets: rows.slice(0, limit).map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        name: asset.name,
        mimeType: asset.mime_type,
        sizeBytes: asset.size_bytes,
        storageBucket: asset.storage_bucket,
        storagePath: asset.storage_path,
        publicUrl: asset.public_url,
        createdAt: asset.created_at,
        metadata: asset.metadata,
      })),
    };
  }

  throw new Error(`Tool has no executor: ${name}`);
}

function buildToolOutputInput(results: ExecutedToolResult[]) {
  return results.map((result) => ({
    type: "function_call_output",
    call_id: result.callId,
    output: JSON.stringify({ ok: result.ok, toolName: result.name, ...result.result }),
  }));
}

function buildOpenAIMetadata(scope: StreamsAIScope, sessionId: string, pass: string) {
  return {
    product: "streams-ai",
    runtime: LIVE_ASSISTANT_SOURCE,
    toolLoop: "enabled",
    pass,
    tenantId: String(scope.tenantId || ""),
    sessionId: String(sessionId || ""),
  };
}

function summarizeToolResults(results: ExecutedToolResult[]) {
  if (!results.length) return "STREAMS AI completed the live OpenAI response.";
  return [
    "STREAMS completed approved backend tool calls.",
    "",
    ...results.map((result) => `- ${result.name}: ${result.ok ? "ok" : "failed"}`),
    "",
    "Provider execution and generated outputs still require worker/provider/storage proof before they can be claimed as complete.",
  ].join("\n");
}

function parseToolArguments(raw: unknown) {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function sanitizeToolInput(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    if (/api[_-]?key|secret|token|password|authorization/i.test(key)) continue;
    if (typeof item === "string") clean[key] = item.slice(0, 8000);
    else if (typeof item === "number" || typeof item === "boolean" || item === null) clean[key] = item;
    else if (Array.isArray(item)) clean[key] = item.slice(0, 40);
    else if (typeof item === "object") clean[key] = JSON.parse(JSON.stringify(item)).valueOf();
  }
  return clean;
}

function safeString(value: unknown) {
  return String(value || "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._:-]/g, "_");
}

function safeOptionalString(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function clampLimit(value: unknown, fallback: number) {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(1, Math.min(50, n));
}

function createStableToolCallId(name: string) {
  return `call_${name}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function buildOpenAIInput(history: PersistedChatMessage[]): OpenAIInputMessage[] {
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

function normalizeOpenAIRole(role: string | null | undefined): "user" | "assistant" {
  return role === "assistant" ? "assistant" : "user";
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
