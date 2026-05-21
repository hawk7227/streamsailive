import { type NextRequest } from "next/server";
import OpenAI from "openai";
import { requireStreamsAIScope, type StreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAIAssetsRepository } from "@/lib/streams-ai/repositories/assets-repository";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { StreamsAIMessagesRepository } from "@/lib/streams-ai/repositories/messages-repository";
import { StreamsAIProviderRunsRepository } from "@/lib/streams-ai/repositories/provider-runs-repository";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";
import { StreamsAIToolCallsRepository } from "@/lib/streams-ai/repositories/tool-calls-repository";

const assets = new StreamsAIAssetsRepository();
const jobs = new StreamsAIJobsRepository();
const messages = new StreamsAIMessagesRepository();
const providerRuns = new StreamsAIProviderRunsRepository();
const sessions = new StreamsAISessionsRepository();
const toolCalls = new StreamsAIToolCallsRepository();

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
  toolResults?: ExecutedToolResult[];
};

type StreamSend = (event: string, payload: Record<string, unknown>) => void;

type PersistedChatMessage = {
  role?: string | null;
  content?: string | null;
};

type OpenAIInputMessage = {
  role: "user" | "assistant";
  content: string;
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

type ResponsesCreateStream = (args: Record<string, unknown>) => Promise<AsyncIterable<OpenAIStreamEvent>>;

type ExecutedToolResult = {
  name: string;
  ok: boolean;
  result: Record<string, unknown>;
};

const STREAMS_LIVE_ASSISTANT_INSTRUCTIONS = [
  "You are STREAMS AI, a full live OpenAI-powered assistant inside the STREAMS chat interface.",
  "You are not limited to business or growth guidance. Help across the full assistant range: general questions, coding, debugging, architecture, files, UI/UX, product strategy, writing, planning, marketplace help, Shopify, AI media systems, terminal guidance, deployment guidance, and production audits.",
  "OpenAI is the single reasoning brain. STREAMS owns runtime, UI, persistence, tools, jobs, assets, providers, storage, previews, credits, permissions, and proof.",
  "When STREAMS backend tool results are provided in context, answer from those results and do not pretend another lookup was performed.",
  "Tool/job rows prove persistence only. They do not prove worker pickup, provider execution, provider_runs, storage upload, generated output, or preview rendering unless those records are present in the supplied tool results.",
  "Provider_runs rows prove provider tracking exists. They prove provider execution only when status/metadata shows a real provider request/response, not merely a placeholder row.",
  "Assets prove generated output only when they contain storage bucket/path or URL metadata tied to the job/provider run.",
  "Never fake external actions. Do not claim images, videos, voice, files, emails, calendar actions, provider runs, storage uploads, database writes, repo edits, browser actions, or deployments happened unless a real STREAMS backend tool/job/provider/storage path has executed and returned proof.",
  "For production build/audit work, classify claims as Proven, Implemented but unproven, Blocked, or Rejected. Do not call something complete unless source, runtime, persistence, output, and fake-layer-removal proof exist where relevant.",
  "For STREAMS architecture, preserve the locked flow: normalize -> route -> context -> OpenAI -> stream -> tools -> continue -> complete.",
  "Keep existing STREAMS UI/system behavior intact. Do not recommend removing existing shells, bridges, routes, capability cards, upload behavior, sidebars, preview surfaces, or module surfaces unless the user explicitly asks for that cleanup.",
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
          backendTools: "deterministic-approved-tools",
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
        backendTools: "deterministic-approved-tools",
      },
    });

    const shouldRunAssistant = body.runAssistant !== false;
    if (!shouldRunAssistant) {
      return streamsAIJson({ ok: true, sessionId, message: userMessage, messages: [userMessage] }, 201);
    }

    return streamAssistantResponse({ scope, sessionId, userContent: content });
  } catch (error) {
    return streamsAIError(error);
  }
}

function streamAssistantResponse({ scope, sessionId, userContent }: { scope: StreamsAIScope; sessionId: string; userContent: string }) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: StreamSend = (event, payload) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        send("activity", { phase: "turn.started", statusText: "Understanding…", source: LIVE_ASSISTANT_SOURCE, startedAt });

        const history = await messages.list(scope, sessionId);
        const toolResults = await executeRequestedBackendTools({ userContent, scope, sessionId, send });
        const assistant = await runLiveOpenAIResponse({ history, scope, sessionId, toolResults, send });

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
            backendTools: "deterministic-approved-tools",
            toolResults: assistant.toolResults || toolResults,
            runtimeContract: "full_live_assistant_with_provider_run_lookup",
            proofNote: "Assistant text was generated through the server-side OpenAI Responses API path. Approved STREAMS backend tools may create/read real backend records. Provider output still requires workers/providers/storage before output claims are made.",
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
          toolResults: assistant.toolResults || toolResults,
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
              proofNote: "Fallback response saved after live OpenAI assistant/backend-tool failure.",
            },
          });

          for (const token of chunkText(fallback.content)) send("response", { token });
          send("complete", { ok: true, sessionId, assistantMessageId: assistantMessage.id, provider: "openai", providerStatus: "failed", elapsedMs: Date.now() - startedAt, source: LIVE_ASSISTANT_SOURCE });
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
  toolResults,
  send,
}: {
  history: PersistedChatMessage[];
  scope: StreamsAIScope;
  sessionId: string;
  toolResults: ExecutedToolResult[];
  send: StreamSend;
}): Promise<AssistantResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

  if (!apiKey) {
    return {
      providerStatus: "not_configured",
      model,
      toolResults,
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
    const input = buildOpenAIInput(history, toolResults);
    let content = "";
    let responseId: string | null = null;
    let usage: Record<string, unknown> | null = null;

    send("activity", {
      phase: "openai.started",
      statusText: toolResults.length ? "Reading backend tool results…" : "Connected to OpenAI live assistant…",
      model,
      source: LIVE_ASSISTANT_SOURCE,
    });

    const responseStream = await createStream({
      model,
      instructions: STREAMS_LIVE_ASSISTANT_INSTRUCTIONS,
      input,
      stream: true,
      store: true,
      metadata: {
        product: "streams-ai",
        runtime: LIVE_ASSISTANT_SOURCE,
        backendTools: toolResults.length ? "executed" : "none-requested",
        tenantId: String(scope.tenantId || ""),
        sessionId: String(sessionId || ""),
      },
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

    return { providerStatus: "ok", content: content.trim() || summarizeToolResults(toolResults), responseId, model, usage, toolResults };
  } catch (error) {
    return providerFallback(error, model, toolResults);
  }
}

async function executeRequestedBackendTools({
  userContent,
  scope,
  sessionId,
  send,
}: {
  userContent: string;
  scope: StreamsAIScope;
  sessionId: string;
  send: StreamSend;
}): Promise<ExecutedToolResult[]> {
  const requests = detectBackendToolRequests(userContent);
  const results: ExecutedToolResult[] = [];

  for (const request of requests) {
    send("activity", { phase: "tool.started", statusText: `Running ${request.name.replace(/_/g, " ")}…`, toolName: request.name });
    send("tool", { status: "started", toolName: request.name });
    try {
      const result = await executeApprovedBackendTool({ name: request.name, args: request.args, scope, sessionId });
      const record = { name: request.name, ok: true, result };
      results.push(record);
      send("tool", { status: "completed", toolName: request.name, result });
      send("activity", { phase: "tool.completed", statusText: `${request.name.replace(/_/g, " ")} completed.`, toolName: request.name });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Tool failed");
      const record = { name: request.name, ok: false, result: { error: message } };
      results.push(record);
      send("tool", { status: "failed", toolName: request.name, error: message });
      send("activity", { phase: "tool.failed", statusText: `${request.name.replace(/_/g, " ")} failed.`, toolName: request.name, error: message });
    }
  }

  return results;
}

function detectBackendToolRequests(userContent: string) {
  const text = userContent.toLowerCase();
  const requests: Array<{ name: string; args: Record<string, unknown> }> = [];

  if (/\b(capabilities|approved backend tools|what tools|tool list)\b/.test(text)) {
    requests.push({ name: "list_streams_capabilities", args: {} });
  }

  if (/\b(create|queue|persist)\b[\s\S]{0,120}\b(tool job|streams tool job|backend tool|job)\b/.test(text)) {
    requests.push({
      name: "create_streams_tool_job",
      args: {
        toolName: detectRequestedJobKind(userContent),
        productId: "streams-ai",
        inputJson: { prompt: extractPrompt(userContent), originalRequest: userContent.slice(0, 12000) },
      },
    });
  }

  if (/\b(latest|list|check|show|read)\b[\s\S]{0,120}\b(job|jobs|job status|persisted job state)\b/.test(text)) {
    requests.push({ name: "list_streams_jobs", args: { limit: 12 } });
  }

  if (/\b(latest|list|check|show|read|find)\b[\s\S]{0,120}\b(asset|assets|stored output|generated output)\b/.test(text)) {
    requests.push({ name: "list_streams_assets", args: { limit: 12 } });
  }

  if (/provider[_\s-]?runs?|provider run records?|provider execution/.test(text)) {
    requests.push({ name: "provider_runs_lookup", args: { limit: 12 } });
  }

  return dedupeRequests(requests);
}

async function executeApprovedBackendTool({
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
  if (name === "list_streams_capabilities") {
    return {
      capabilities: [
        { name: "list_streams_capabilities", status: "wired", proof: "route executor returns approved tool list" },
        { name: "create_streams_tool_job", status: "wired_persistence_only", proof: "creates real tool_call and queued job rows" },
        { name: "list_streams_jobs", status: "wired", proof: "reads persisted jobs for current session" },
        { name: "list_streams_assets", status: "wired", proof: "reads persisted assets for current session" },
        { name: "provider_runs_lookup", status: "wired", proof: "reads persisted provider_runs records" },
      ],
    };
  }

  if (name === "create_streams_tool_job") {
    const toolName = safeString(args.toolName || "chat_tool").slice(0, 80);
    const productId = safeString(args.productId || "streams-ai").slice(0, 80);
    const inputJson = sanitizeToolInput(args.inputJson) || {};

    const toolCall = await toolCalls.create(scope, { sessionId, toolName, productId, inputJson, status: "queued" });
    const job = await jobs.create(scope, { sessionId, toolCallId: toolCall.id, productId, kind: toolName, status: "queued", inputJson, creditEstimate: 0 });

    return {
      status: "queued",
      proof: "persisted_tool_call_and_job",
      toolCallId: toolCall.id,
      jobId: job.id,
      jobStatus: job.status,
      jobKind: job.kind,
      productId: job.product_id || productId,
      unproven: ["worker pickup", "provider execution", "provider_runs row", "storage upload", "generated output asset creation", "final preview rendering from stored output"],
    };
  }

  if (name === "list_streams_jobs") {
    const rows = await jobs.list(scope, { sessionId });
    return { count: rows.length, jobs: rows.slice(0, clampLimit(args.limit, 12)).map(normalizeJobRow) };
  }

  if (name === "list_streams_assets") {
    const rows = await assets.list(scope, { sessionId });
    return { count: rows.length, assets: rows.slice(0, clampLimit(args.limit, 12)).map(normalizeAssetRow) };
  }

  if (name === "provider_runs_lookup") {
    const latestJobs = await jobs.list(scope, { sessionId });
    const latestJob = latestJobs.find((job) => String(job.kind || "").includes("image")) || latestJobs[0] || null;
    const jobId = latestJob?.id || null;
    const rows = await providerRuns.list(scope, { jobId });
    return {
      status: rows.length ? "found" : "none",
      jobId,
      count: rows.length,
      providerRuns: rows.slice(0, clampLimit(args.limit, 12)).map(normalizeProviderRunRow),
      interpretation: rows.length
        ? "provider_runs rows exist. Inspect each row status/response_json/output_asset_id to determine provider/output proof."
        : "No provider_runs rows were found for the latest matching job. Provider execution is not proven from provider_runs yet.",
    };
  }

  throw new Error(`Tool is not approved: ${name}`);
}

function normalizeJobRow(job: Record<string, unknown>) {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    productId: job.product_id,
    toolCallId: job.tool_call_id,
    createdAt: job.created_at,
    inputJson: job.input_json,
  };
}

function normalizeAssetRow(asset: Record<string, unknown>) {
  return {
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
  };
}

function normalizeProviderRunRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    jobId: row.job_id,
    provider: row.provider,
    model: row.model,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    outputAssetId: row.output_asset_id,
    error: row.error || row.error_message,
    responseJson: row.response_json,
    requestJson: row.request_json,
    createdAt: row.created_at,
  };
}

function dedupeRequests(requests: Array<{ name: string; args: Record<string, unknown> }>) {
  const seen = new Set<string>();
  return requests.filter((request) => {
    if (seen.has(request.name)) return false;
    seen.add(request.name);
    return true;
  });
}

function detectRequestedJobKind(userContent: string) {
  const text = userContent.toLowerCase();
  if (/image[_\s-]?to[_\s-]?video|i2v/.test(text)) return "image_to_video";
  if (/text[_\s-]?to[_\s-]?video|video_generation|text_to_video/.test(text)) return "text_to_video";
  if (/image[_\s-]?generation|generate an? image|generate image|product photo|photo/.test(text)) return "image_generation";
  if (/voice|audio|tts/.test(text)) return "voice_generation";
  if (/music|song/.test(text)) return "music_generation";
  if (/audit|debug|codebase/.test(text)) return "code_audit";
  return "chat_tool";
}

function extractPrompt(userContent: string) {
  const match = userContent.match(/prompt\s*:\s*([\s\S]+)/i);
  return (match?.[1] || userContent).trim().slice(0, 8000);
}

function buildOpenAIInput(history: PersistedChatMessage[], toolResults: ExecutedToolResult[]): OpenAIInputMessage[] {
  const safeHistory = history
    .filter((message) => String(message.content || "").trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({ role: normalizeOpenAIRole(message.role), content: String(message.content || "").slice(0, MAX_MESSAGE_CHARS) }));

  if (toolResults.length) {
    safeHistory.push({
      role: "user",
      content: [
        "Approved STREAMS backend tool results for the current turn:",
        JSON.stringify(toolResults, null, 2),
        "",
        "Answer from these real tool results. Do not claim any unproven layer as complete.",
      ].join("\n"),
    });
  }

  return safeHistory.length ? safeHistory : [{ role: "user", content: "Hello" }];
}

function normalizeOpenAIRole(role: string | null | undefined): "user" | "assistant" {
  return role === "assistant" ? "assistant" : "user";
}

function summarizeToolResults(results: ExecutedToolResult[]) {
  if (!results.length) return "STREAMS AI completed the live OpenAI response.";
  return ["STREAMS executed approved backend tool checks.", "", ...results.map((result) => `- ${result.name}: ${result.ok ? "ok" : "failed"}`), "", "Provider execution and generated outputs still require worker/provider/storage proof before they can be claimed as complete."].join("\n");
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
    else if (typeof item === "object") clean[key] = JSON.parse(JSON.stringify(item));
  }
  return clean;
}

function safeString(value: unknown) {
  return String(value || "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._:-]/g, "_");
}

function clampLimit(value: unknown, fallback: number) {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(1, Math.min(50, n));
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

function providerFallback(error: unknown, model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL, toolResults: ExecutedToolResult[] = []): AssistantResult {
  const message = error instanceof Error ? error.message : String(error || "Unknown provider failure");
  return {
    providerStatus: "failed",
    providerError: message,
    model,
    toolResults,
    content: ["STREAMS AI saved your message, but the live OpenAI assistant did not complete successfully.", "", "The chat session and your message are stored. Check OPENAI_API_KEY / OPENAI_MODEL in the deployment environment, then retry.", "", `Provider error: ${message}`].join("\n"),
  };
}
