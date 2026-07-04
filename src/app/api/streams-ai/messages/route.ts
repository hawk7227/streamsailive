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
import { buildUniversalChatContext } from "@/lib/streams-ai/universal-chat-context";
import { recordUniversalRuntimeEvent } from "@/lib/streams-ai/runtime-events";
import { runControlledOpenAIToolLoopScaffold } from "@/lib/streams-ai/openai-tool-loop";
import { runResponsesContinuation } from "@/lib/streams-ai/responses-continuation";
import { buildStreamsMemoryContext, saveThreadSummary } from "@/lib/streams-ai/memory-context";

const assets = new StreamsAIAssetsRepository();
const jobs = new StreamsAIJobsRepository();
const messages = new StreamsAIMessagesRepository();
const providerRuns = new StreamsAIProviderRunsRepository();
const sessions = new StreamsAISessionsRepository();
const toolCalls = new StreamsAIToolCallsRepository();

const LIVE_ASSISTANT_SOURCE = "streams-ai-openai-live-assistant";
const CAPABILITY_SOURCE = "streams-ai-canonical-capability-registry";
const FAST_REPLY_SOURCE = "streams-ai-fast-local-reply";
const DEFAULT_OPENAI_MODEL = "gpt-4.1";
const MAX_HISTORY_MESSAGES = 28;

const STREAMS_LIVE_ASSISTANT_INSTRUCTIONS = [
  "You are Streams AI, a universal OpenAI-powered assistant inside Streams.",
  "Answer broadly like ChatGPT first, then use Streams capabilities when runtime context, saved memory, or the user request requires it.",
  "OpenAI is the single orchestrator brain. Tools, workers, providers, validators, memory, connectors, and workspace surfaces report results; they do not decide independently.",
  "For normal questions, answer naturally without forcing tool use.",
  "For workspace, file, image, repo, generation, build, repair, automation, memory, or safety requests, use the supplied runtime context, saved memory, universal plan, and approved tool results.",
  "Do not claim any action happened unless a tool result, runtime event, job, asset, provider run, commit, build status, deployment status, storage record, memory record, or other proof shows it.",
  "If proof is partial, say partial. If a tool is unavailable, say unavailable. If action confidence is low, pause and recommend safe options.",
  "Users can ask what is remembered, ask to save memory, or ask to remove saved memory. Respect user and project scope.",
  "Keep existing Streams UI/system behavior intact unless the user explicitly asks for a change.",
].join("\n");

type AssistantProviderStatus = "ok" | "not_configured" | "failed";
type StreamSend = (event: string, payload: Record<string, unknown>) => void;
type PersistedChatMessage = { id?: string; role?: string | null; content?: string | null; metadata?: Record<string, any> | null };
type ExecutedToolResult = { name: string; ok: boolean; result: Record<string, unknown> };
type AssistantResult = { content: string; providerStatus: AssistantProviderStatus; providerError?: string; responseId?: string | null; model?: string; usage?: Record<string, unknown> | null; toolResults?: ExecutedToolResult[] };

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
    const body = await readJsonBody<{ sessionId?: string; role?: "user" | "assistant" | "system" | "tool"; content?: string; message?: string; status?: string; metadata?: Record<string, unknown>; runAssistant?: boolean; userId?: string; mode?: string; provider?: string; attachments?: any[] }>(request);
    const content = (body.content || body.message || "").trim();
    if (!content) return streamsAIJson({ ok: false, error: "content or message is required" }, 400);
    const isFastReply = isSimpleFastReply(content);
    let sessionId = body.sessionId || "";
    if (!sessionId) {
      const created = await sessions.create(scope, { title: isFastReply ? "New chat" : await generateAITitle(content), metadata: { source: "copied-streams-chat-ui", assistantRuntime: LIVE_ASSISTANT_SOURCE, mode: "universal-live-assistant", backendTools: "universal-approved-tools", canonicalCapabilities: "enabled", recentChat: true } });
      sessionId = created.id;
    }
    const userMessage = await messages.create(scope, { sessionId, role: body.role || "user", content, status: body.status || "complete", metadata: { ...(body.metadata || {}), copiedUiUserId: body.userId || null, assistantRuntime: LIVE_ASSISTANT_SOURCE, mode: "universal-live-assistant", backendTools: "universal-approved-tools", canonicalCapabilities: "enabled", attachments: body.attachments || [] } });
    if (body.runAssistant === false) return streamsAIJson({ ok: true, sessionId, message: userMessage, messages: [userMessage] }, 201);
    if (isFastReply) return streamFastAssistantResponse({ scope, sessionId, userContent: content });
    if (isCanonicalCapabilityQuestion(content)) return streamCanonicalCapabilityResponse({ scope, sessionId, userContent: content });
    return streamAssistantResponse({ scope, sessionId, userContent: content, mode: body.mode });
  } catch (error) {
    return streamsAIError(error);
  }
}

function isSimpleFastReply(content: string) {
  const text = content.toLowerCase().replace(/[!?.\s]+$/g, "").trim();
  return /^(hi|hello|hey|yo|sup|gm|good morning|good afternoon|good evening|test)$/.test(text);
}

function fastReplyText(content: string) {
  const text = content.toLowerCase();
  if (text.includes("test")) return "I’m here and responding.";
  return "Hey — I’m here. What do you want to build, create, or work on?";
}

function streamFastAssistantResponse({ scope, sessionId, userContent }: { scope: StreamsAIScope; sessionId: string; userContent: string }) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const answer = fastReplyText(userContent);
  const stream = new ReadableStream<Uint8Array>({ async start(controller) {
    const send: StreamSend = (event, payload) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
    try {
      send("activity", { phase: "fast_reply.started", statusText: "Replying…", source: FAST_REPLY_SOURCE, startedAt, sessionId });
      for (const token of chunkText(answer, 80)) send("response", { token });
      const assistantMessage = await messages.create(scope, { sessionId, role: "assistant", content: answer, status: "complete", metadata: { source: FAST_REPLY_SOURCE, provider: "local", providerStatus: "ok", reason: "simple_greeting_fast_path" } });
      send("complete", { ok: true, sessionId, assistantMessageId: assistantMessage.id, provider: "local", providerStatus: "ok", source: FAST_REPLY_SOURCE, elapsedMs: Date.now() - startedAt });
    } catch (error) {
      send("error", { message: error instanceof Error ? error.message : String(error) });
    } finally {
      controller.close();
    }
  } });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}

function streamCanonicalCapabilityResponse({ scope, sessionId, userContent }: { scope: StreamsAIScope; sessionId: string; userContent: string }) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const answer = buildCanonicalCapabilityAnswer(userContent);
  const registry = buildRuntimeCapabilityRegistry();
  const stream = new ReadableStream<Uint8Array>({ async start(controller) {
    const send: StreamSend = (event, payload) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
    try {
      send("activity", { phase: "capabilities.started", statusText: "Loading canonical STREAMS capabilities…", source: CAPABILITY_SOURCE, startedAt, sessionId });
      send("response", { token: "Loading the Streams capability map…\n\n" });
      for (const token of chunkText(answer, 160)) send("response", { token });
      const assistantMessage = await messages.create(scope, { sessionId, role: "assistant", content: answer, status: "complete", metadata: { source: CAPABILITY_SOURCE, provider: "streams", providerStatus: "ok", registryVersion: registry.version, capabilityCount: registry.total, statusCounts: registry.statusCounts } });
      send("complete", { ok: true, sessionId, assistantMessageId: assistantMessage.id, provider: "streams", providerStatus: "ok", source: CAPABILITY_SOURCE, registryVersion: registry.version, capabilityCount: registry.total, elapsedMs: Date.now() - startedAt });
    } catch (error) { send("error", { message: error instanceof Error ? error.message : String(error) }); }
    finally { controller.close(); }
  } });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}

function streamAssistantResponse({ scope, sessionId, userContent, mode }: { scope: StreamsAIScope; sessionId: string; userContent: string; mode?: string }) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const stream = new ReadableStream<Uint8Array>({ async start(controller) {
    const send: StreamSend = (event, payload) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
    try {
      send("activity", { phase: "turn.started", statusText: "Checking the right context…", source: LIVE_ASSISTANT_SOURCE, startedAt, sessionId });
      send("response", { token: "Checking the right context…\n\n" });
      await recordUniversalRuntimeEvent({ sessionId, phase: "turn.started", source: LIVE_ASSISTANT_SOURCE, severity: "info", message: "Universal assistant turn started." });
      send("activity", { phase: "history.started", statusText: "Loading recent chat state…", source: LIVE_ASSISTANT_SOURCE, sessionId });
      const history = await messages.list(scope, sessionId);
      send("response", { token: "Loading recent chat state…\n\n" });
      send("activity", { phase: "context.started", statusText: "Checking memory, tools, and workspace context…", source: LIVE_ASSISTANT_SOURCE, sessionId });
      const universalContext = await buildUniversalChatContext({ sessionId, userMessage: userContent });
      const memoryContext = await buildStreamsMemoryContext(scope, sessionId, userContent);
      const requestedUniversalTools = detectUniversalToolRequests(userContent, sessionId, universalContext);
      const loopResult = await runControlledOpenAIToolLoopScaffold({ requestedTools: requestedUniversalTools, deps: { sessionId, jobs, assets, providerRuns, scope } });
      const controlledToolResults: ExecutedToolResult[] = loopResult.toolResults.map((item) => ({ name: item.name, ok: item.ok, result: item.result || { error: item.error || "Tool failed" } }));
      const legacyToolResults = await executeRequestedBackendTools({ userContent, scope, sessionId, send });
      const toolResults = [...controlledToolResults, ...legacyToolResults];
      send("response", { token: "Preparing the answer…\n\n" });
      const fullContextText = [universalContext.contextText, memoryContext.contextText].join("\n\n");
      const assistant = await runLiveOpenAIResponse({ history, scope, sessionId, universalContextText: fullContextText, toolResults, send, mode });
      const memoryUpdate = await saveThreadSummary(scope, sessionId, userContent, assistant.content);
      const assistantMessage = await messages.create(scope, { sessionId, role: "assistant", content: assistant.content, status: "complete", metadata: { source: LIVE_ASSISTANT_SOURCE, provider: "openai", providerStatus: assistant.providerStatus, providerError: assistant.providerError || null, openaiModel: assistant.model || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL, openaiResponseId: assistant.responseId || null, openaiUsage: assistant.usage || null, backendTools: "universal-approved-tools", toolLoop: { scaffold: true, requested: requestedUniversalTools.map((tool) => tool.name), maxRounds: loopResult.maxRounds, responsesContinuation: true }, universalPlan: universalContext.plan || null, universalCapabilitySummary: universalContext.capabilitySummary, memoryContext: { memoryCount: memoryContext.memories.length, hasSessionSummary: Boolean(memoryContext.sessionSummary), memoryUpdate }, toolResults: assistant.toolResults || toolResults, runtimeContract: "universal_live_assistant_with_responses_tool_continuation" } });
      if (assistant.providerStatus !== "ok") for (const token of chunkText(assistant.content)) send("response", { token });
      await recordUniversalRuntimeEvent({ sessionId, phase: "turn.completed", source: LIVE_ASSISTANT_SOURCE, severity: assistant.providerStatus === "ok" ? "info" : "error", message: `Universal assistant turn completed with provider status: ${assistant.providerStatus}.`, proof: { responseId: assistant.responseId || null, assistantMessageId: assistantMessage.id, memoryUpdated: Boolean(memoryUpdate) } });
      send("complete", { ok: true, sessionId, assistantMessageId: assistantMessage.id, provider: "openai", providerStatus: assistant.providerStatus, responseId: assistant.responseId || null, toolResults: assistant.toolResults || toolResults, universalPlan: universalContext.plan, memoryContext: { memoryCount: memoryContext.memories.length, hasSessionSummary: Boolean(memoryContext.sessionSummary) }, elapsedMs: Date.now() - startedAt, source: LIVE_ASSISTANT_SOURCE });
    } catch (error) {
      const fallback = providerFallback(error);
      const assistantMessage = await messages.create(scope, { sessionId, role: "assistant", content: fallback.content, status: "complete", metadata: { source: LIVE_ASSISTANT_SOURCE, provider: "openai", providerStatus: "failed", providerError: fallback.providerError || null } });
      for (const token of chunkText(fallback.content)) send("response", { token });
      send("complete", { ok: true, sessionId, assistantMessageId: assistantMessage.id, provider: "openai", providerStatus: "failed", elapsedMs: Date.now() - startedAt, source: LIVE_ASSISTANT_SOURCE });
    } finally { controller.close(); }
  } });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}

async function runLiveOpenAIResponse({ history, scope, sessionId, universalContextText, toolResults, send, mode = "Thinking" }: { history: PersistedChatMessage[]; scope: StreamsAIScope; sessionId: string; universalContextText: string; toolResults: ExecutedToolResult[]; send: StreamSend; mode?: string }): Promise<AssistantResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  let model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  if (mode === "Thinking") model = "o3-mini";
  else if (mode === "Instant") model = "gpt-4o-mini";
  else if (mode === "Pro") model = "gpt-4o";
  if (!apiKey) return { providerStatus: "not_configured", model, toolResults, content: "STREAMS AI saved your message, but the live OpenAI assistant is not enabled because OPENAI_API_KEY is not configured in this deployment." };
  try {
    const client = new OpenAI({ apiKey });
    const input = buildOpenAIInput(history, toolResults, universalContextText);
    send("activity", { phase: "openai.started", statusText: "Writing the answer…", model, source: LIVE_ASSISTANT_SOURCE });
    send("response", { token: "Writing the answer…\n\n" });
    const continuation = await runResponsesContinuation({ client, model, instructions: STREAMS_LIVE_ASSISTANT_INSTRUCTIONS, input: input as any[], deps: { sessionId, jobs, assets, providerRuns, scope }, send, metadata: { product: "streams-ai", runtime: LIVE_ASSISTANT_SOURCE, backendTools: "responses-continuation", tenantId: String(scope.tenantId || ""), sessionId: String(sessionId || "") }, maxRounds: 6 });
    if (continuation.content) for (const token of chunkText(continuation.content)) send("response", { token });
    const continuationResults: ExecutedToolResult[] = continuation.toolResults.map((item) => ({ name: item.name, ok: item.ok, result: item.result || { error: item.error || "Tool failed" } }));
    const mergedToolResults = [...toolResults, ...continuationResults];
    return { providerStatus: "ok", content: continuation.content || summarizeToolResults(mergedToolResults), responseId: continuation.responseId, model, usage: continuation.usage, toolResults: mergedToolResults };
  } catch (error) { return providerFallback(error, model, toolResults); }
}

function buildOpenAIInput(history: PersistedChatMessage[], toolResults: ExecutedToolResult[], universalContextText: string) {
  const inputMessages: any[] = [{ role: "user", content: [{ type: "input_text", text: universalContextText }] }];
  for (const message of history.slice(-MAX_HISTORY_MESSAGES)) {
    if (!String(message.content || "").trim()) continue;
    if (message.role === "assistant") inputMessages.push({ role: "assistant", content: [{ type: "output_text", text: String(message.content || "") }] });
    else inputMessages.push({ role: "user", content: [{ type: "input_text", text: String(message.content || "") }] });
  }
  if (toolResults.length) inputMessages.push({ role: "user", content: [{ type: "input_text", text: ["Approved Streams runtime/tool results for this turn:", JSON.stringify(toolResults, null, 2), "", "Answer from these real results. Do not claim any unproven layer as complete."].join("\n") }] });
  return inputMessages;
}

function detectUniversalToolRequests(userContent: string, sessionId: string, universalContext: Awaited<ReturnType<typeof buildUniversalChatContext>>) {
  const text = userContent.toLowerCase();
  const requests: Array<{ name: string; args: Record<string, unknown> }> = [];
  if (universalContext.plan?.needsPlan) requests.push({ name: "orchestrator_plan", args: { sessionId, userMessage: userContent } });
  if (universalContext.plan?.needsPlan || /what happened|runtime|event|status|workspace|safety|repair|build|generation/.test(text)) requests.push({ name: "runtime_events_read", args: { sessionId } });
  if (/capabilit|what tools|tool list|available tools/.test(text)) requests.push({ name: "capabilities_list", args: { sessionId } });
  if (/job|jobs|queue|generation status|build status/.test(text)) requests.push({ name: "jobs_list", args: { sessionId } });
  if (/asset|assets|stored output|generated output/.test(text)) requests.push({ name: "assets_list", args: { sessionId } });
  if (/provider[_\s-]?runs?|provider execution|provider run records?/.test(text)) requests.push({ name: "provider_runs_lookup", args: { sessionId } });
  if (/resolve|selected layer|source range|safe scope|exact target/.test(text)) requests.push({ name: "action_resolve", args: { sessionId, attemptedAction: userContent } });
  return dedupeRequests(requests);
}

async function executeRequestedBackendTools({ userContent, scope, sessionId, send }: { userContent: string; scope: StreamsAIScope; sessionId: string; send: StreamSend }): Promise<ExecutedToolResult[]> {
  const requests = detectBackendToolRequests(userContent);
  const results: ExecutedToolResult[] = [];
  for (const request of requests) {
    send("activity", { phase: "tool.started", statusText: `Running ${request.name.replace(/_/g, " ")}…`, toolName: request.name });
    send("response", { token: `Running ${request.name.replace(/_/g, " ")}…\n\n` });
    try { const result = await executeApprovedBackendTool({ name: request.name, args: request.args, scope, sessionId }); results.push({ name: request.name, ok: true, result }); send("tool", { status: "completed", toolName: request.name, result }); }
    catch (error) { const message = error instanceof Error ? error.message : String(error || "Tool failed"); results.push({ name: request.name, ok: false, result: { error: message } }); send("tool", { status: "failed", toolName: request.name, error: message }); }
  }
  return results;
}

function detectBackendToolRequests(userContent: string) {
  const text = userContent.toLowerCase();
  const requests: Array<{ name: string; args: Record<string, unknown> }> = [];
  if (/approved backend tools|what tools|tool list/.test(text)) requests.push({ name: "list_streams_capabilities", args: {} });
  if (/latest|list|check|show|read/.test(text) && /job|jobs|job status|persisted job state/.test(text)) requests.push({ name: "list_streams_jobs", args: { limit: 12 } });
  if (/latest|list|check|show|read|find/.test(text) && /asset|assets|stored output|generated output/.test(text)) requests.push({ name: "list_streams_assets", args: { limit: 12 } });
  if (/provider[_\s-]?runs?|provider run records?|provider execution/.test(text)) requests.push({ name: "provider_runs_lookup", args: { limit: 12 } });
  if (/create|queue|persist/.test(text) && /tool job|streams tool job|backend tool|job/.test(text)) requests.push({ name: "create_streams_tool_job", args: { toolName: detectRequestedJobKind(userContent), productId: "streams-ai", inputJson: { prompt: extractPrompt(userContent), originalRequest: userContent.slice(0, 12000) } } });
  return dedupeRequests(requests);
}

async function executeApprovedBackendTool({ name, args, scope, sessionId }: { name: string; args: Record<string, unknown>; scope: StreamsAIScope; sessionId: string }) {
  if (name === "list_streams_capabilities") return { capabilities: buildRuntimeCapabilityRegistry().capabilities.map((capability) => ({ id: capability.id, name: capability.title, status: capability.status, proof: capability.proof })) };
  if (name === "create_streams_tool_job") { const toolName = safeString(args.toolName || "chat_tool").slice(0, 80); const productId = safeString(args.productId || "streams-ai").slice(0, 80); const inputJson = sanitizeToolInput(args.inputJson) || {}; const toolCall = await toolCalls.create(scope, { sessionId, toolName, productId, inputJson, status: "queued" }); const job = await jobs.create(scope, { sessionId, toolCallId: toolCall.id, productId, kind: toolName, status: "queued", inputJson, creditEstimate: 0 }); return { status: "queued", proof: "persisted_tool_call_and_job", toolCallId: toolCall.id, jobId: job.id, jobStatus: job.status, jobKind: job.kind, productId: job.product_id || productId, unproven: ["worker pickup", "provider execution", "provider_runs row", "storage upload", "generated output asset creation", "final preview rendering from stored output"] }; }
  if (name === "list_streams_jobs") { const rows = await jobs.list(scope, { sessionId }); return { count: rows.length, jobs: rows.slice(0, clampLimit(args.limit, 12)).map(normalizeJobRow) }; }
  if (name === "list_streams_assets") { const rows = await assets.list(scope, { sessionId }); return { count: rows.length, assets: rows.slice(0, clampLimit(args.limit, 12)).map(normalizeAssetRow) }; }
  if (name === "provider_runs_lookup") { const latestJobs = await jobs.list(scope, { sessionId }); const latestJob = latestJobs.find((job) => String(job.kind || "").includes("image")) || latestJobs[0] || null; const jobId = latestJob?.id || null; const rows = await providerRuns.list(scope, { jobId }); return { status: rows.length ? "found" : "none", jobId, count: rows.length, providerRuns: rows.slice(0, clampLimit(args.limit, 12)).map(normalizeProviderRunRow) }; }
  throw new Error(`Tool is not approved: ${name}`);
}

function normalizeJobRow(job: Record<string, unknown>) { return { id: job.id, kind: job.kind, status: job.status, productId: job.product_id, toolCallId: job.tool_call_id, createdAt: job.created_at, inputJson: job.input_json }; }
function normalizeAssetRow(asset: Record<string, unknown>) { return { id: asset.id, kind: asset.kind, name: asset.name, mimeType: asset.mime_type, sizeBytes: asset.size_bytes, storageBucket: asset.storage_bucket, storagePath: asset.storage_path, publicUrl: asset.public_url, createdAt: asset.created_at, metadata: asset.metadata }; }
function normalizeProviderRunRow(row: Record<string, unknown>) { return { id: row.id, jobId: row.job_id, provider: row.provider, model: row.model, status: row.status, startedAt: row.started_at, completedAt: row.completed_at, outputAssetId: row.output_asset_id, error: row.error || row.error_message, responseJson: row.response_json, requestJson: row.request_json, createdAt: row.created_at }; }
function dedupeRequests<T extends { name: string }>(requests: T[]) { const seen = new Set<string>(); return requests.filter((request) => { if (seen.has(request.name)) return false; seen.add(request.name); return true; }); }
function detectRequestedJobKind(userContent: string) { const text = userContent.toLowerCase(); if (/image[_\s-]?to[_\s-]?video|i2v/.test(text)) return "image_to_video"; if (/text[_\s-]?to[_\s-]?video|video_generation|text_to_video/.test(text)) return "text_to_video"; if (/image[_\s-]?generation|generate an? image|generate image|product photo|photo/.test(text)) return "image_generation"; if (/voice|audio|tts/.test(text)) return "voice_generation"; if (/music|song/.test(text)) return "music_generation"; if (/audit|debug|codebase/.test(text)) return "code_audit"; return "chat_tool"; }
function extractPrompt(userContent: string) { const match = userContent.match(/prompt\s*:\s*([\s\S]+)/i); return (match?.[1] || userContent).trim().slice(0, 8000); }
function sanitizeToolInput(value: unknown): Record<string, unknown> | undefined { if (!value || typeof value !== "object" || Array.isArray(value)) return undefined; const clean: Record<string, unknown> = {}; for (const [key, item] of Object.entries(value as Record<string, unknown>)) { if (/key|credential/.test(key.toLowerCase())) continue; if (typeof item === "string") clean[key] = item.slice(0, 8000); else if (typeof item === "number" || typeof item === "boolean" || item === null) clean[key] = item; else if (Array.isArray(item)) clean[key] = item.slice(0, 40); else if (typeof item === "object") clean[key] = JSON.parse(JSON.stringify(item)); } return clean; }
function safeString(value: unknown) { return String(value || "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._:-]/g, "_"); }
function clampLimit(value: unknown, fallback: number) { const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback; return Math.max(1, Math.min(50, n)); }
function chunkText(text: string, max = 24) { const parts = text.match(new RegExp(`.{1,${max}}(\\s|$)`, "g")); return parts?.length ? parts : [text]; }
function summarizeToolResults(results: ExecutedToolResult[]) { if (!results.length) return "Streams AI completed the live OpenAI response."; return ["Streams executed approved runtime/tool checks.", "", ...results.map((result) => `- ${result.name}: ${result.ok ? "ok" : "failed"}`), "", "Outputs, builds, and deployments still require proof before they can be claimed complete."].join("\n"); }
function providerFallback(error: unknown, model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL, toolResults: ExecutedToolResult[] = []): AssistantResult { const message = error instanceof Error ? error.message : String(error || "Unknown provider failure"); return { providerStatus: "failed", providerError: message, model, toolResults, content: ["Streams AI saved your message, but the live OpenAI assistant did not complete successfully.", "", "The chat session and your message are stored. Check OPENAI_API_KEY / OPENAI_MODEL in the deployment environment, then retry.", "", `Provider error: ${message}`].join("\n") }; }
