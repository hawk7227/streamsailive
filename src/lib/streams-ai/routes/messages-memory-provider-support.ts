import OpenAI from "openai";
import type { StreamsAIScope } from "../auth";
import { createStreamsAIServiceClient } from "../server";
import { StreamsAIAssetsRepository } from "../repositories/assets-repository";
import { StreamsAIMessagesRepository } from "../repositories/messages-repository";
import { StreamsAISessionsRepository } from "../repositories/sessions-repository";
import type { StreamsMemoryContext } from "../intelligence/memory-engine";

const assets = new StreamsAIAssetsRepository();
const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();

const MAX_HISTORY_MESSAGES = 16;
const MAX_ATTACHMENT_CONTEXT_CHARS = 36000;
const DEFAULT_FAST_MODEL = "gpt-4o-mini";
const DEFAULT_PRO_MODEL = "gpt-4o";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";

type PersistedChatMessage = { id?: string; role?: string | null; content?: string | null; metadata?: Record<string, any> | null };
type ChatPostBody = { sessionId?: string; role?: "user" | "assistant" | "system" | "tool"; content?: string; message?: string; status?: string; metadata?: Record<string, unknown>; userId?: string; mode?: string; provider?: string; attachments?: any[] };
type AttachmentContext = { text: string; imageParts: OpenAI.Chat.Completions.ChatCompletionContentPartImage[]; statusText: string; statusEvents: string[] };
type StreamSend = (event: string, payload: Record<string, unknown>) => void;

export async function getHistoryForPrompt(scope: StreamsAIScope, sessionId: string, userContent: string) {
  if (!sessionId) return [] as PersistedChatMessage[];
  if (/^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay|yes|no|cool|great|good morning|good afternoon|good evening)[.!?\s]*$/i.test(userContent.trim())) return [] as PersistedChatMessage[];
  return messages.list(scope, sessionId).catch(() => [] as PersistedChatMessage[]);
}

export async function ensureSession(scope: StreamsAIScope, sessionId: string, content: string) {
  if (sessionId) return sessionId;
  const title = content.replace(/\s+/g, " ").trim().slice(0, 58) || "New chat";
  const created = await sessions.create(scope, { title, metadata: { source: "streams-ai-chat-ui", assistantRuntime: "streams-ai-memory-provider-router", mode: "provider-router-memory", recentChat: true } });
  return created.id;
}

export async function persistChatTurn({ scope, sessionId, userContent, assistantContent, body, assistantStatus, assistantMetadata }: { scope: StreamsAIScope; sessionId: string; userContent: string; assistantContent: string; body: ChatPostBody; assistantStatus: string; assistantMetadata: Record<string, unknown> }) {
  const persistedSessionId = await ensureSession(scope, sessionId, userContent);
  await messages.create(scope, { sessionId: persistedSessionId, role: body.role || "user", content: userContent, status: body.status || "complete", metadata: buildUserMetadata(body) });
  const assistantMessage = await messages.create(scope, { sessionId: persistedSessionId, role: "assistant", content: assistantContent, status: assistantStatus, metadata: assistantMetadata });
  return { sessionId: persistedSessionId, assistantMessageId: assistantMessage.id };
}

export function buildUserMetadata(body: ChatPostBody) {
  return { ...(body.metadata || {}), copiedUiUserId: body.userId || null, assistantRuntime: "streams-ai-memory-provider-router", mode: "provider-router-memory", attachments: body.attachments || [] };
}

export async function buildAttachmentContext(scope: StreamsAIScope, body: ChatPostBody, sessionId: string, send?: StreamSend): Promise<AttachmentContext> {
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (!attachments.length) return { text: "", imageParts: [], statusText: "", statusEvents: [] };
  if (send) send("activity", { phase: "attachments.reading", statusText: attachments.length === 1 ? "Reading attached file…" : `Reading ${attachments.length} attached files…`, source: "streams-ai-memory-provider-router", sessionId, backendProof: { attachmentCount: attachments.length } });
  const assetRows = sessionId ? await assets.list(scope, { sessionId }).catch(() => []) : [];
  const byId = new Map<string, any>();
  const byName = new Map<string, any>();
  for (const row of assetRows as any[]) { if (row?.id) byId.set(String(row.id), row); if (row?.name) byName.set(String(row.name), row); }
  let used = 0;
  let imageCount = 0;
  let readableCount = 0;
  let pendingCount = 0;
  const sections: string[] = [];
  const statusEvents = new Set<string>();
  const imageParts: OpenAI.Chat.Completions.ChatCompletionContentPartImage[] = [];
  for (let index = 0; index < attachments.length; index += 1) {
    const input = attachments[index] || {};
    const row = byId.get(String(input.id || input.assetId || "")) || byName.get(String(input.name || "")) || null;
    const merged = { ...(row || {}), ...(input || {}), metadata: { ...(row?.metadata || {}), ...(input?.metadata || {}) } };
    const metadata = merged.metadata || {};
    const textPreview = String(merged.textPreview || metadata.textPreview || input.textPreview || "").trim();
    const summary = String(merged.summary || metadata.summary || input.summary || "").trim();
    const extractionStatus = String(merged.extractionStatus || metadata.extractionStatus || metadata.processingStatus || input.extractionStatus || "unknown");
    const extractionMode = String(merged.extractionMode || metadata.extractionMode || input.extractionMode || "").toLowerCase();
    const chunkCount = Number(merged.textChunkCount || metadata.chunkCount || input.textChunkCount || 0);
    const name = String(merged.name || input.name || `Attachment ${index + 1}`);
    const mime = String(merged.mimeType || merged.mime_type || input.mimeType || "unknown");
    const size = Number(merged.sizeBytes || merged.size_bytes || input.sizeBytes || 0);
    const isImage = String(merged.kind || input.kind || "").toLowerCase() === "image" || mime.startsWith("image/") || extractionMode === "image";
    const signedImageUrl = isImage ? await resolveImageUrl(merged).catch(() => "") : "";
    if (signedImageUrl) { imageParts.push({ type: "image_url", image_url: { url: signedImageUrl } }); imageCount += 1; }
    addExtractionStatus(statusEvents, extractionMode, mime, name, metadata);
    const readable = [summary ? `Summary: ${summary}` : "", textPreview ? `Extracted text preview:\n${textPreview}` : ""].filter(Boolean).join("\n\n");
    if (readable) { readableCount += 1; statusEvents.add("Text extracted"); if (chunkCount > 0 || extractionStatus === "ready") statusEvents.add("Extraction complete"); }
    if (!readable && !signedImageUrl) pendingCount += 1;
    const statusLine = signedImageUrl ? "vision_input_available" : readable ? "readable_context_available" : `no_readable_text_available_status_${extractionStatus}`;
    let block = [`File ${index + 1}: ${name}`, `MIME: ${mime}`, `Size bytes: ${size}`, `Extraction mode: ${extractionMode || "unknown"}`, `Extraction status: ${statusLine}`].join("\n");
    if (signedImageUrl) block += "\n\nImage is attached as a vision input for direct visual review.";
    block += readable ? `\n\n${readable}` : signedImageUrl ? "" : "\n\nNo extracted text was available for this file at request time.";
    const remaining = MAX_ATTACHMENT_CONTEXT_CHARS - used;
    if (remaining <= 0) break;
    if (block.length > remaining) block = `${block.slice(0, remaining)}\n[Attachment context truncated]`;
    used += block.length;
    sections.push(block);
  }
  const aggregate = imageCount ? `Inspecting ${imageCount} image${imageCount === 1 ? "" : "s"}…` : readableCount ? `Reading ${readableCount} extracted file${readableCount === 1 ? "" : "s"}…` : pendingCount ? `Checking ${pendingCount} attachment${pendingCount === 1 ? "" : "s"}…` : "";
  if (aggregate) statusEvents.add(aggregate);
  if (send) for (const statusText of statusEvents) send("activity", { phase: "attachments.proof", statusText, source: "streams-ai-memory-provider-router", sessionId, backendProof: { attachmentContextReady: true } });
  return { text: sections.length ? `[Attached file context supplied by Streams backend]\n${sections.join("\n\n---\n\n")}\n[/Attached file context]\n\nUse the attached file context above when answering.` : "", imageParts, statusText: aggregate, statusEvents: Array.from(statusEvents) };
}

function addExtractionStatus(statusEvents: Set<string>, extractionMode: string, mime: string, name: string, metadata: Record<string, any>) {
  const lowerName = name.toLowerCase();
  if (extractionMode === "pdf" || mime.includes("pdf") || lowerName.endsWith(".pdf")) statusEvents.add("Reading PDF…");
  else if (["docx", "legacy-doc", "odt-document", "epub", "rtf"].includes(extractionMode) || /word|rtf|epub|opendocument/.test(mime)) statusEvents.add("Reading document…");
  else if (["spreadsheet", "csv"].includes(extractionMode) || /spreadsheet|excel|csv/.test(mime)) statusEvents.add("Reading spreadsheet…");
  else if (extractionMode === "presentation" || /presentation|powerpoint/.test(mime) || lowerName.endsWith(".pptx")) statusEvents.add("Reading presentation…");
  else if (["text", "html"].includes(extractionMode) || /text|json|javascript|typescript|css|html|xml|yaml|sql|markdown/.test(mime)) statusEvents.add("Reading code…");
  if (String(metadata.transcriptionStatus || "").toLowerCase() === "processing" || metadata.transcriptionJobId) statusEvents.add("Transcribing audio…");
  if (String(metadata.frameStatus || metadata.videoFrameStatus || "").toLowerCase() === "processing" || metadata.frameJobId) statusEvents.add("Sampling frames…");
}

async function resolveImageUrl(asset: any) {
  const mime = String(asset.mimeType || asset.mime_type || "");
  if (!mime.startsWith("image/")) return "";
  const bucket = asset.storageBucket || asset.storage_bucket || "";
  const path = asset.storagePath || asset.storage_path || "";
  if (bucket && path) { const { data, error } = await createStreamsAIServiceClient().storage.from(bucket).createSignedUrl(path, 60 * 60); if (!error && data?.signedUrl) return data.signedUrl; }
  const text = String(asset.publicUrl || asset.public_url || asset.url || "").trim();
  return /^https?:\/\//i.test(text) ? text : "";
}

function buildStreamsProviderSystem(scope: StreamsAIScope) {
  const first = String(scope.userFirstName || "").trim();
  return [
    "You are Streams AI, Marcus Hawkins' AI business operator and product-building copilot inside the StreamsAI platform.",
    "You are not a generic chatbot. Answer as StreamsAI with the user's current product, repo, launch, and builder context in mind.",
    "Current product context: StreamsAI helps everyday small business owners, creators, and entrepreneurs turn ideas into business plans, visuals, content, websites, apps, automations, and launch actions.",
    "Core positioning: StreamsAI is for people who want to start or grow a business but do not know what to do next. It should act like an AI operator, not just a Q&A bot.",
    "When the user asks for marketing, launch, business, or product strategy for StreamsAI, give StreamsAI-specific actions, not generic market-research templates.",
    "When the user asks about development work, give direct answers with exact repo paths, file names, commits, status, and what is wired vs not verified whenever that context is available.",
    "Use retrieved Streams memory, project memory, file context, chat history, and tool results when supplied. If they are missing, say what is not verified instead of inventing.",
    "Project memory beats general memory. Recent user corrections beat older inferred preferences. Source documents beat summaries.",
    "Prefer concise, direct, practical answers. Avoid filler phrases, generic startup advice, and broad textbook steps unless the user explicitly asks for a general overview.",
    "For launch plans, include offer, target buyer, content angles, outreach motion, proof/demo assets, onboarding path, pricing test, and next execution steps.",
    "For Marcus, default to direct answers with exact files and commits when discussing implementation. Do not overclaim that something is working unless it is tested or verified.",
    "Do not ask which project when the active route/context is StreamsAI unless there is a real ambiguity. Assume the project is StreamsAI unless the user names another project.",
    "Do not pretend to run tools, builds, deployments, searches, generations, or image vision unless proof exists.",
    first ? `The signed-in account holder's first name is ${first}. Use it only at key personal moments.` : "No reliable first name is available. Do not invent one.",
  ].join("\n");
}

export function buildChatMessages(history: PersistedChatMessage[], userContent: string, scope: StreamsAIScope, attachmentContext: AttachmentContext, memoryContext: StreamsMemoryContext): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: buildStreamsProviderSystem(scope) }];
  for (const message of history.slice(-MAX_HISTORY_MESSAGES)) {
    const content = String(message.content || "").trim();
    if (!content) continue;
    if (message.role === "assistant") result.push({ role: "assistant", content });
    else if (message.role === "user") result.push({ role: "user", content });
  }
  const text = [memoryContext.promptBlock, attachmentContext.text, `User request:\n${userContent}`].filter(Boolean).join("\n\n");
  if (attachmentContext.imageParts.length) result.push({ role: "user", content: [{ type: "text", text }, ...attachmentContext.imageParts] as any });
  else result.push({ role: "user", content: text });
  return result;
}

export function resolveOpenAIModel(mode?: string) { return mode === "Pro" ? process.env.OPENAI_PRO_MODEL || DEFAULT_PRO_MODEL : process.env.OPENAI_FAST_MODEL || process.env.OPENAI_MODEL || DEFAULT_FAST_MODEL; }
export function resolveAnthropicModel(mode?: string) { return mode === "Pro" ? process.env.ANTHROPIC_PRO_MODEL || process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL : process.env.ANTHROPIC_FAST_MODEL || process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL; }
