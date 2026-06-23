import { type NextRequest } from "next/server";
import OpenAI from "openai";
import { requireStreamsAIScope, type StreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { buildCanonicalCapabilityAnswer, buildRuntimeCapabilityRegistry, isCanonicalCapabilityQuestion } from "@/lib/streams-ai/capabilities/canonical-capabilities";
import { StreamsAIAssetsRepository } from "@/lib/streams-ai/repositories/assets-repository";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { StreamsAIMessagesRepository } from "@/lib/streams-ai/repositories/messages-repository";
import { StreamsAIProviderRunsRepository } from "@/lib/streams-ai/repositories/provider-runs-repository";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";
import { StreamsAIToolCallsRepository } from "@/lib/streams-ai/repositories/tool-calls-repository";
import { generateAITitle } from "@/lib/streams-ai/services/title-generator";

const assets = new StreamsAIAssetsRepository();
const jobs = new StreamsAIJobsRepository();
const messages = new StreamsAIMessagesRepository();
const providerRuns = new StreamsAIProviderRunsRepository();
const sessions = new StreamsAISessionsRepository();
const toolCalls = new StreamsAIToolCallsRepository();

const LIVE_ASSISTANT_SOURCE = "streams-ai-openai-live-assistant";
const CAPABILITY_SOURCE = "streams-ai-canonical-capability-registry";
const DEFAULT_OPENAI_MODEL = "gpt-4.1";
const MAX_HISTORY_MESSAGES = 28;
const MAX_MESSAGE_CHARS = 32000;

type AssistantProviderStatus = "ok" | "not_configured" | "failed";

type AssistantResult = {
  content: string;
  reasoning?: string;
  providerStatus: AssistantProviderStatus;
  providerError?: string;
  responseId?: string | null;
  model?: string;
  usage?: Record<string, unknown> | null;
  toolResults?: ExecutedToolResult[];
};

type StreamSend = (event: string, payload: Record<string, unknown>) => void;

type PersistedChatMessage = {
  id?: string;
  role?: string | null;
  content?: string | null;
  metadata?: Record<string, any> | null;
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
  "Capability questions are answered from the canonical STREAMS capability registry before generic OpenAI generation.",
  "When STREAMS backend tool results are provided in context, answer from those results and do not pretend another lookup was performed.",
  "Tool/job rows prove persistence only. They do not prove worker pickup, provider execution, provider_runs, storage upload, generated output, or preview rendering unless those records are present in the supplied tool results.",
  "Provider_runs rows prove provider tracking exists. They prove provider execution only when status/metadata shows a real provider request/response, not merely a placeholder row.",
  "Assets prove generated output only when they contain storage bucket/path or URL metadata tied to the job/provider run.",
  "Never fake external actions. Do not claim images, videos, voice, files, emails, calendar actions, provider runs, storage uploads, database writes, repo edits, browser actions, or deployments happened unless a real STREAMS backend tool/job/provider/storage path has executed and returned proof.",
  "For production build/audit work, classify claims as Proven, Implemented but unproven, Blocked, or Rejected. Do not call something complete unless source, runtime, persistence, output, and fake-layer-removal proof exist where relevant.",
  "For STREAMS architecture, preserve the locked flow: normalize -> route -> context -> OpenAI -> stream -> tools -> continue -> complete.",
  "Use clean Markdown when it improves readability. Use short paragraphs, bullets, numbered lists, tables, headings, blockquotes, inline code, and fenced code blocks appropriately. Do not over-format simple replies. Do not use raw HTML for normal chat answers. Keep simple greetings short and natural. For code answers, always use fenced code blocks with a language tag. For checklist-style answers, bold the label before the colon, for example: **Visual Layout:** Confirm the UI is aligned.",
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
      mode?: string;
      provider?: string;
      attachments?: any[];
    }>(request);

    const content = (body.content || body.message || "").trim();
    if (!content) return streamsAIJson({ ok: false, error: "content or message is required" }, 400);

    let sessionId = body.sessionId || "";
    if (!sessionId) {
      const created = await sessions.create(scope, {
        title: await generateAITitle(content),
        metadata: {
          source: "copied-streams-chat-ui",
          adapter: "legacy-message-body",
          assistantRuntime: LIVE_ASSISTANT_SOURCE,
          mode: "full-live-assistant",
          backendTools: "deterministic-approved-tools",
          canonicalCapabilities: "enabled",
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
        canonicalCapabilities: "enabled",
        attachments: body.attachments || [],
      },
    });

    const shouldRunAssistant = body.runAssistant !== false;
    if (!shouldRunAssistant) {
      return streamsAIJson({ ok: true, sessionId, message: userMessage, messages: [userMessage] }, 201);
    }

    if (isCanonicalCapabilityQuestion(content)) {
      return streamCanonicalCapabilityResponse({ scope, sessionId, userContent: content });
    }

    return streamAssistantResponse({
      scope,
      sessionId,
      userContent: content,
      mode: body.mode,
      provider: body.provider,
    });
  } catch (error) {
    return streamsAIError(error);
  }
}

function streamCanonicalCapabilityResponse({ scope, sessionId, userContent }: { scope: StreamsAIScope; sessionId: string; userContent: string }) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const answer = buildCanonicalCapabilityAnswer(userContent);
  const registry = buildRuntimeCapabilityRegistry();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: StreamSend = (event, payload) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        send("activity", { phase: "capabilities.started", statusText: "Loading canonical STREAMS capabilities…", source: CAPABILITY_SOURCE, startedAt, sessionId });
        for (const token of chunkText(answer, 160)) send("response", { token });

        const assistantMessage = await messages.create(scope, {
          sessionId,
          role: "assistant",
          content: answer,
          status: "complete",
          metadata: {
            source: CAPABILITY_SOURCE,
            provider: "streams",
            providerStatus: "ok",
            registryVersion: registry.version,
            capabilityCount: registry.total,
            statusCounts: registry.statusCounts,
            proofNote: "Answered from the canonical STREAMS capability registry, not generic model memory.",
          },
        });

        send("complete", {
          ok: true,
          sessionId,
          assistantMessageId: assistantMessage.id,
          provider: "streams",
          providerStatus: "ok",
          source: CAPABILITY_SOURCE,
          registryVersion: registry.version,
          capabilityCount: registry.total,
          elapsedMs: Date.now() - startedAt,
        });
      } catch (error) {
        send("error", { message: error instanceof Error ? error.message : String(error) });
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

function streamAssistantResponse({
  scope,
  sessionId,
  userContent,
  mode,
  provider,
}: {
  scope: StreamsAIScope;
  sessionId: string;
  userContent: string;
  mode?: string;
  provider?: string;
}) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: StreamSend = (event, payload) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        send("activity", { phase: "turn.started", source: LIVE_ASSISTANT_SOURCE, startedAt, sessionId });

        const history = await messages.list(scope, sessionId);
        const toolResults = await executeRequestedBackendTools({ userContent, scope, sessionId, send });
        const assistant = await runLiveOpenAIResponse({ history, scope, sessionId, toolResults, send, mode, provider });

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
            reasoning: assistant.reasoning || null,
            proofNote: "Assistant text was generated through the server-side OpenAI Chat Completions API path. Approved STREAMS backend tools may create/read real backend records.",
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
  mode = "Thinking",
  provider = "Auto",
}: {
  history: PersistedChatMessage[];
  scope: StreamsAIScope;
  sessionId: string;
  toolResults: ExecutedToolResult[];
  send: StreamSend;
  mode?: string;
  provider?: string;
}): Promise<AssistantResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  let model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  if (mode === "Thinking") {
    model = "o3-mini";
  } else if (mode === "Instant") {
    model = "gpt-4o-mini";
  } else if (mode === "Pro") {
    model = "gpt-4o";
  }

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
    const input = await buildOpenAIInput(history, toolResults, client, scope);

    // o3-mini does not support vision (image inputs). Fall back to vision-capable gpt-4o.
    const hasImage = input.some((msg: any) =>
      Array.isArray(msg.content) &&
      msg.content.some((block: any) => block.type === "input_image")
    );
    if (hasImage && model === "o3-mini") {
      console.log("[runLiveOpenAIResponse] Image detected in input history. Overriding o3-mini with vision-capable gpt-4o model.");
      model = "gpt-4o";
    }

    let content = "";
    let reasoning = "";
    let responseId: string | null = null;
    let usage: Record<string, unknown> | null = null;

    if (toolResults.length > 0) {
      send("activity", {
        phase: "openai.started",
        statusText: "Reading backend tool results…",
        model,
        source: LIVE_ASSISTANT_SOURCE,
      });
    }

    const createStream = client.responses.create.bind(client.responses) as unknown as ResponsesCreateStream;
    const responseStream = await createStream({
      model,
      instructions: STREAMS_LIVE_ASSISTANT_INSTRUCTIONS,
      input: input as any,
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

    return { providerStatus: "ok", content: content.trim() || summarizeToolResults(toolResults), reasoning: reasoning || undefined, responseId, model, usage, toolResults };
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

  if (/\b(approved backend tools|what tools|tool list)\b/.test(text)) {
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
      capabilities: buildRuntimeCapabilityRegistry().capabilities.map((capability) => ({
        id: capability.id,
        name: capability.title,
        status: capability.status,
        proof: capability.proof,
      })),
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

async function ensureOpenAIFileId(client: OpenAI, attachment: any): Promise<string | null> {
  if (attachment.openAIFileId) return attachment.openAIFileId;

  const bucket = attachment.storageBucket || attachment.storage_bucket;
  const path = attachment.storagePath || attachment.storage_path;
  const url = attachment.url || attachment.storageUrl || attachment.publicUrl;

  try {
    let blob: Blob;

    if (bucket && path) {
      const { createStreamsAIServiceClient } = await import("@/lib/streams-ai/server");
      const serviceClient = createStreamsAIServiceClient();
      const { data, error } = await serviceClient.storage.from(bucket).download(path);
      if (error || !data) {
        throw new Error(error?.message || "Failed to download from Supabase Storage");
      }
      blob = data;
    } else if (url) {
      let targetUrl = url;
      if (targetUrl.startsWith("/")) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        targetUrl = `${appUrl}${targetUrl}`;
      }
      const res = await fetch(targetUrl);
      if (!res.ok) return null;
      blob = await res.blob();
    } else {
      return null;
    }

    const fileObj = new File([blob], attachment.name || "file", { type: attachment.mimeType || "application/octet-stream" });

    const openAIFile = await client.files.create({
      file: fileObj,
      purpose: "user_data",
    });

    return openAIFile.id;
  } catch (err) {
    console.error("[ensureOpenAIFileId] failed to upload file to OpenAI:", err);
    return null;
  }
}

async function buildOpenAIInput(
  history: PersistedChatMessage[],
  toolResults: ExecutedToolResult[],
  client: OpenAI,
  scope: StreamsAIScope
): Promise<any[]> {
  const inputMessages: any[] = [];

  for (const message of history) {
    if (!String(message.content || "").trim()) continue;

    const role = normalizeOpenAIRole(message.role);

    // Assistant messages use output_text — no file attachments allowed
    if (role === "assistant") {
      inputMessages.push({
        role: "assistant",
        content: [{ type: "output_text", text: String(message.content || "") }],
      });
      continue;
    }

    // User messages: process file attachments first, then the text
    const attachments = message.metadata?.attachments as any[];
    const contentBlocks: any[] = [];

    if (attachments && attachments.length > 0) {
      let updated = false;
      const updatedAttachments = [...attachments];

      for (let index = 0; index < updatedAttachments.length; index += 1) {
        const file = updatedAttachments[index];
        const isImage = file.kind === "image" || (file.mimeType || file.mime_type || "").startsWith("image/");

        console.log(`[buildOpenAIInput] Processing attachment index ${index}:`, {
          id: file.id,
          name: file.name,
          kind: file.kind,
          mimeType: file.mimeType || file.mime_type,
          isImage
        });

        if (isImage) {
          try {
            const bucket = file.storageBucket || file.storage_bucket;
            const path = file.storagePath || file.storage_path;
            let blob: Blob | null = null;

            if (bucket && path) {
              console.log(`[buildOpenAIInput] Attempting Supabase download: bucket=${bucket}, path=${path}`);
              const { createStreamsAIServiceClient } = await import("@/lib/streams-ai/server");
              const serviceClient = createStreamsAIServiceClient();
              const { data, error } = await serviceClient.storage.from(bucket).download(path);
              if (error) {
                console.error(`[buildOpenAIInput] Supabase storage error:`, error.message);
              } else if (data) {
                blob = data;
                console.log(`[buildOpenAIInput] Downloaded from Supabase storage successfully: size=${blob.size} bytes`);
              }
            }

            if (!blob) {
              const url = file.url || file.storageUrl || file.publicUrl;
              console.log(`[buildOpenAIInput] Supabase download failed or skipped. Falling back to HTTP URL fetch: ${url}`);
              if (url) {
                let targetUrl = url;
                if (targetUrl.startsWith("/")) {
                  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
                  targetUrl = `${appUrl}${targetUrl}`;
                  console.log(`[buildOpenAIInput] Prefixed relative path to targetUrl: ${targetUrl}`);
                }
                const res = await fetch(targetUrl);
                if (res.ok) {
                  blob = await res.blob();
                  console.log(`[buildOpenAIInput] Fetched from URL successfully: size=${blob.size} bytes`);
                } else {
                  console.error(`[buildOpenAIInput] URL fetch failed: status=${res.status}`);
                }
              }
            }

            if (blob) {
              const buffer = Buffer.from(await blob.arrayBuffer());
              const mime = file.mimeType || file.mime_type || "image/jpeg";
              const base64 = buffer.toString("base64");
              contentBlocks.push({
                type: "input_image",
                image_url: `data:${mime};base64,${base64}`
              });
              console.log(`[buildOpenAIInput] Embedded base64 input_image block successfully`);
            } else {
              console.error(`[buildOpenAIInput] Could not retrieve image blob for: ${file.name}`);
            }
          } catch (err) {
            console.error("[buildOpenAIInput] failed to process base64 image:", err);
          }
        } else {
          // Non-image files use text context stuffing via ensureOpenAIFileId
          const fileId = await ensureOpenAIFileId(client, file);
          if (fileId) {
            contentBlocks.push({ type: "input_file", file_id: fileId });
            if (file.openAIFileId !== fileId) {
              file.openAIFileId = fileId;
              updated = true;
            }
          }
        }
      }

      if (updated && message.id) {
        try {
          await messages.updateMetadata(scope, message.id, {
            ...(message.metadata || {}),
            attachments: updatedAttachments,
          });
          message.metadata = { ...(message.metadata || {}), attachments: updatedAttachments };
        } catch (err) {
          console.error("Failed to update message metadata in database:", err);
        }
      }
    }

    contentBlocks.push({ type: "input_text", text: String(message.content || "") });

    inputMessages.push({ role: "user", content: contentBlocks });
  }

  if (toolResults.length) {
    inputMessages.push({
      role: "user",
      content: [
        {
          type: "input_text",
          text: [
            "Approved STREAMS backend tool results for the current turn:",
            JSON.stringify(toolResults, null, 2),
            "",
            "Answer from these real tool results. Do not claim any unproven layer as complete.",
          ].join("\n"),
        },
      ],
    });
  }

  return inputMessages.length ? inputMessages : [{ role: "user", content: [{ type: "input_text", text: "Hello" }] }];
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

function chunkText(text: string, max = 24) {
  const parts = text.match(new RegExp(`.{1,${max}}(\\s|$)`, "g"));
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
