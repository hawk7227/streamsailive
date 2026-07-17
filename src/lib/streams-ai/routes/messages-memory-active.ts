import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "../auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "../api";
import { StreamsAIMessagesRepository } from "../repositories/messages-repository";
import { StreamsAISessionsRepository } from "../repositories/sessions-repository";
import { buildStreamsParitySystemPrompt, STREAMS_PARITY_PROFILE_VERSION } from "../intelligence/parity-profile";
import { learnFromStreamsTurn } from "../intelligence/memory-engine";
import { collectProviderCitations, renderProviderCitations } from "../research/provider-citation-renderer";
import { executeAuthoritativeStreamsTurn, prepareAuthoritativeStreamsTurn, type StreamsGeneratedCandidate } from "../runtime/authoritative-turn-controller";
import { buildAttachmentContext, buildUserMetadata, ensureSession, getHistoryForPrompt, persistChatTurn, resolveIdempotencyBase, resolveTurnId } from "./messages-memory-provider-support";

const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();
const SOURCE = "streams-ai-authoritative-runtime";
const ATTACHMENT_ONLY_SENTINEL = "\u200B";

const CURRENT_RESEARCH_CONTRACT = [
  "<current_research_contract>",
  "Use live web search for every time-sensitive claim.",
  "Only include an announcement, event, product change, role, price, law, schedule, or other current fact when retrieved evidence supports it.",
  "For relative windows such as the last 7 days, verify that every included item falls inside that exact window.",
  "Prefer official or primary sources. Use reputable reporting only when a primary source is unavailable.",
  "Every distinct current item must have its own provider-backed citation.",
  "Include the relevant date for each current item.",
  "Never invent an announcement, product name, operating-system release, model release, source, date, or quotation.",
  "When enough supported items cannot be found, state that limitation instead of filling the requested count with guesses.",
  "</current_research_contract>",
].join("\n");

type Body = {
  sessionId?: string;
  role?: "user" | "assistant" | "system" | "tool";
  content?: string;
  message?: string;
  status?: string;
  metadata?: Record<string, any>;
  runAssistant?: boolean;
  userId?: string;
  idempotencyKey?: string;
  turnId?: string;
  mode?: string;
  provider?: string;
  attachments?: any[];
};

type Send = (event: string, payload: Record<string, unknown>) => void;

type ProviderResult = {
  content: string;
  citationCount: number;
  webSearchUsed: boolean;
};

function sse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function emit(controller: ReadableStreamDefaultController<Uint8Array>, event: string, payload: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
}

function chunks(text: string, size = 180) {
  const out: string[] = [];
  for (let i = 0; i < String(text || "").length; i += size) out.push(String(text || "").slice(i, i + size));
  return out.length ? out : [""];
}

function streamExistingMessage(message: any) {
  return sse(new ReadableStream<Uint8Array>({
    start(controller) {
      emit(controller, "activity", { phase: "complete", statusText: "Ready", sessionId: message.session_id });
      for (const token of chunks(String(message.content || ""))) emit(controller, "response", { token });
      emit(controller, "complete", {
        ok: true,
        sessionId: message.session_id,
        assistantMessageId: message.id,
        duplicatePrevented: true,
        idempotencyKey: message.idempotency_key || null,
      });
      controller.close();
    },
  }));
}

export function extractProviderResponse(payload: any): ProviderResult {
  const output = Array.isArray(payload?.output) ? payload.output : [];
  const renderedParts: string[] = [];
  const distinctCitationUrls = new Set<string>();
  let webSearchUsed = false;

  for (const item of output) {
    if (String(item?.type || "").includes("web_search")) webSearchUsed = true;
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type !== "output_text" || !part?.text) continue;
      const citations = collectProviderCitations(Array.isArray(part?.annotations) ? part.annotations : []);
      citations.forEach((citation) => distinctCitationUrls.add(citation.url));
      const rendered = renderProviderCitations(String(part.text), citations);
      renderedParts.push(rendered.content);
    }
  }

  const fallback = renderedParts.length ? renderedParts.join("") : String(payload?.output_text || "");
  const citationCount = distinctCitationUrls.size;
  return {
    content: fallback.trim(),
    citationCount,
    webSearchUsed: webSearchUsed || citationCount > 0,
  };
}

async function callResponsesText(input: {
  apiKey: string;
  model: string;
  systemText: string;
  prompt: string;
  imageUrls: string[];
  enableWebSearch: boolean;
  signal?: AbortSignal;
}): Promise<ProviderResult> {
  const effectivePrompt = input.enableWebSearch ? `${input.prompt}\n\n${CURRENT_RESEARCH_CONTRACT}` : input.prompt;
  const userContent: Array<Record<string, unknown>> = [{ type: "input_text", text: effectivePrompt }];
  for (const imageUrl of input.imageUrls) userContent.push({ type: "input_image", image_url: imageUrl, detail: "high" });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${input.apiKey}` },
    signal: input.signal,
    body: JSON.stringify({
      model: input.model,
      input: [
        { role: "system", content: input.systemText },
        { role: "user", content: userContent },
      ],
      ...(input.enableWebSearch ? { tools: [{ type: "web_search_preview" }] } : {}),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || error?.message || `Responses request failed: ${response.status}`);
  }
  const payload = await response.json();
  const result = extractProviderResponse(payload);
  if (!result.content) throw new Error("The response completed without text output");
  return result;
}

async function judgeCandidatesWithModel(input: {
  apiKey: string;
  model: string;
  systemText: string;
  userInstruction: string;
  candidates: StreamsGeneratedCandidate[];
  signal?: AbortSignal;
}) {
  const prompt = [
    "Select the single strongest candidate for the user's request.",
    "Evaluate intent match, factual coverage, instruction adherence, grounding, uncertainty, structure, tone, citation visibility, and usefulness.",
    "Reject candidates that make current claims without visible provider-backed citations.",
    "Return JSON only in this exact shape: {\"selectedIndex\":0,\"reason\":\"brief\"}.",
    `<user_instruction>\n${input.userInstruction}\n</user_instruction>`,
    ...input.candidates.map((candidate, index) => `<candidate index="${index}">\n${candidate.content}\n</candidate>`),
  ].join("\n\n");
  const result = await callResponsesText({ apiKey: input.apiKey, model: input.model, systemText: input.systemText, prompt, imageUrls: [], enableWebSearch: false, signal: input.signal });
  try {
    const parsed = JSON.parse(result.content.replace(/^```json\s*|\s*```$/g, ""));
    const selectedIndex = Number(parsed?.selectedIndex);
    return Number.isInteger(selectedIndex) ? selectedIndex : null;
  } catch {
    return null;
  }
}

async function repairCandidateWithModel(input: {
  apiKey: string;
  model: string;
  systemText: string;
  userInstruction: string;
  candidate: StreamsGeneratedCandidate;
  defects: unknown;
  evidenceDefects: unknown;
  deterministicDefects?: unknown;
  imageUrls: string[];
  enableWebSearch: boolean;
  signal?: AbortSignal;
}) {
  const prompt = [
    "Repair the candidate response so it fully satisfies the user's request and every listed quality, evidence, and deterministic defect.",
    "For current research, run live web search again and ensure every distinct current item has a visible provider-backed citation and a date.",
    "Delete every unsupported claim. Never preserve a claim merely because it appeared in the rejected candidate.",
    "Return only the repaired final answer. Do not explain the repair.",
    `<user_instruction>\n${input.userInstruction}\n</user_instruction>`,
    `<quality_defects>\n${JSON.stringify(input.defects)}\n</quality_defects>`,
    `<evidence_defects>\n${JSON.stringify(input.evidenceDefects)}\n</evidence_defects>`,
    `<deterministic_defects>\n${JSON.stringify(input.deterministicDefects || [])}\n</deterministic_defects>`,
    `<candidate>\n${input.candidate.content}\n</candidate>`,
  ].join("\n\n");
  return callResponsesText({
    apiKey: input.apiKey,
    model: input.model,
    systemText: input.systemText,
    prompt,
    imageUrls: input.imageUrls,
    enableWebSearch: input.enableWebSearch,
    signal: input.signal,
  });
}

async function verifyAssistantOnlyRequest(scope: any, body: Body, requestedContent: string) {
  if (body.metadata?.skipUserPersistence !== true) return { content: requestedContent, attachments: body.attachments || [] };
  const sessionId = String(body.sessionId || "").trim();
  const sourceUserMessageId = String(body.metadata?.sourceUserMessageId || "").trim();
  const regeneratedFromMessageId = String(body.metadata?.regeneratedFromMessageId || "").trim();
  if (!sessionId || !sourceUserMessageId || !regeneratedFromMessageId) throw new Error("Assistant-only execution requires verified source message identifiers.");

  const rows = await messages.list(scope, sessionId);
  const userIndex = rows.findIndex((row: any) => String(row.id) === sourceUserMessageId && row.role === "user");
  const assistantIndex = rows.findIndex((row: any) => String(row.id) === regeneratedFromMessageId && row.role === "assistant");
  if (userIndex < 0 || assistantIndex < 0 || userIndex >= assistantIndex) throw new Error("Assistant-only execution source messages are invalid.");
  const sourceUser = rows[userIndex];
  const content = String(sourceUser.content || "").trim();
  if (!content || content !== requestedContent.trim()) throw new Error("Assistant-only execution content does not match the verified source request.");
  return { content, attachments: Array.isArray(sourceUser?.metadata?.attachments) ? sourceUser.metadata.attachments : [] };
}

export async function memoryMessagesGET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return streamsAIJson({ ok: false, error: "sessionId is required" }, 400);
    const session = await sessions.get(scope, sessionId);
    if (!session) return streamsAIJson({ ok: true, messages: [], missingSession: true, sessionId });
    return streamsAIJson({ ok: true, messages: await messages.list(scope, sessionId) });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function memoryMessagesPOST(request: NextRequest) {
  try {
    const body = await readJsonBody<Body>(request);
    const rawUserContent = body.content || body.message || "";
    let userContent = rawUserContent.trim();
    if (!userContent) return streamsAIJson({ ok: false, error: "content or message is required" }, 400);

    const scope = await requireStreamsAIScope(request);
    const verified = await verifyAssistantOnlyRequest(scope, body, userContent);
    userContent = verified.content;
    body.content = userContent;
    body.message = userContent;
    body.attachments = verified.attachments;

    const effectiveInstruction = userContent === ATTACHMENT_ONLY_SENTINEL
      ? `Review the attached file${Array.isArray(body.attachments) && body.attachments.length === 1 ? "" : "s"}.`
      : userContent;
    const idempotencyBase = resolveIdempotencyBase(body);
    const turnId = resolveTurnId(body);

    if (body.runAssistant === false) {
      const sessionId = await ensureSession(scope, body.sessionId || "", userContent);
      const role = body.role || "user";
      const message = await messages.create(scope, {
        sessionId,
        role,
        content: userContent,
        status: body.status || "complete",
        metadata: { ...buildUserMetadata(body), turnId },
        turnId,
        idempotencyKey: idempotencyBase ? `${idempotencyBase}:${role}` : null,
      });
      return streamsAIJson({ ok: true, sessionId, message, messages: [message] }, 201);
    }

    if (idempotencyBase) {
      const existingAssistant = await messages.findByIdempotencyKey(scope, `${idempotencyBase}:assistant`);
      if (existingAssistant) return streamExistingMessage(existingAssistant);
    }

    const normalizedBody: Body = { ...body, turnId, idempotencyKey: idempotencyBase || undefined };

    return sse(new ReadableStream<Uint8Array>({
      async start(controller) {
        const send: Send = (event, payload) => emit(controller, event, payload);
        const startedAt = Date.now();
        const serverTimestamp = new Date(startedAt).toISOString();
        let sessionId = normalizedBody.sessionId || "";

        try {
          send("activity", { phase: "created", statusText: "Reviewing your request…", source: SOURCE, sessionId });
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) throw new Error("The assistant service is not configured");

          const history = await getHistoryForPrompt(scope, sessionId, userContent);
          const attachmentContext = await buildAttachmentContext(scope, normalizedBody, sessionId, send);
          const imageUrls = attachmentContext.imageParts.map((part: any) => String(part?.image_url?.url || "")).filter(Boolean);
          const authoritativeTurn = await prepareAuthoritativeStreamsTurn({
            scope,
            sessionId,
            projectId: String(normalizedBody.metadata?.projectId || normalizedBody.metadata?.project_id || scope.defaultProjectId || "") || null,
            userMessage: effectiveInstruction,
            attachments: normalizedBody.attachments || [],
            turnId,
            taskId: String(normalizedBody.metadata?.taskId || normalizedBody.metadata?.task_id || "") || null,
            requestedMode: normalizedBody.mode || null,
            recentMessages: history,
            attachmentText: attachmentContext.text,
            imageUrls,
            selectedContext: normalizedBody.metadata?.selectedContext || null,
            activeArtifact: normalizedBody.metadata?.activeArtifact || null,
            unresolvedTaskState: normalizedBody.metadata?.unresolvedTaskState || null,
          });
          const systemText = buildStreamsParitySystemPrompt(serverTimestamp);

          const result = await executeAuthoritativeStreamsTurn({
            turn: authoritativeTurn,
            signal: request.signal,
            emitState: (state, statusText) => send("activity", { phase: state, statusText, source: SOURCE, sessionId }),
            generate: async ({ model, prompt, imageUrls: candidateImages, signal, candidateIndex }) => {
              const researching = authoritativeTurn.intent.needsCurrentInformation;
              send("activity", {
                phase: researching ? "searching" : "generating",
                statusText: researching ? "Searching current sources…" : candidateIndex === 0 ? "Preparing the response…" : "Comparing response candidates…",
                source: SOURCE,
                sessionId,
              });
              return callResponsesText({ apiKey, model, systemText, prompt, imageUrls: candidateImages, enableWebSearch: researching, signal });
            },
            judgeWithModel: ({ model, candidates, signal }) => judgeCandidatesWithModel({ apiKey, model, systemText, userInstruction: effectiveInstruction, candidates, signal }),
            repairWithModel: async ({ model, candidate, judgment, evidence, deterministic, signal }) => repairCandidateWithModel({
              apiKey,
              model,
              systemText,
              userInstruction: effectiveInstruction,
              candidate,
              defects: judgment.defects,
              evidenceDefects: evidence.defects,
              deterministicDefects: deterministic.defects,
              imageUrls,
              enableWebSearch: authoritativeTurn.intent.needsCurrentInformation,
              signal,
            }),
            persistAccepted: async ({ turn, candidate, judgment, evidence, deterministic, repairAttempts }) => {
              const persisted = await persistChatTurn({
                scope,
                sessionId,
                userContent,
                assistantContent: candidate.content,
                body: normalizedBody,
                assistantStatus: "complete",
                assistantMetadata: {
                  source: SOURCE,
                  providerStatus: "ok",
                  imageGrounded: imageUrls.length > 0,
                  imageCount: imageUrls.length,
                  webGrounded: candidate.webSearchUsed,
                  citationCount: candidate.citationCount,
                  serverTimestamp,
                  regeneratedFromMessageId: normalizedBody.metadata?.regeneratedFromMessageId || null,
                  parityProfile: STREAMS_PARITY_PROFILE_VERSION,
                  controllerVersion: turn.controllerVersion,
                  taskId: turn.taskId,
                  orchestratorMode: turn.context.runtimeContext?.plan?.mode || turn.intent.primaryIntent,
                  intentDecision: turn.intent,
                  modelRouteVersion: turn.modelRoute.routeVersion,
                  modelRouteReason: turn.modelRoute.reason,
                  contextPackageVersion: turn.context.version,
                  contextSnapshot: turn.context.snapshot,
                  contextBudget: turn.context.tokenBudget,
                  parityQuality: judgment,
                  evidenceValidation: evidence,
                  deterministicValidation: deterministic,
                  repairAttempts,
                },
              });
              sessionId = persisted.sessionId;
              await learnFromStreamsTurn(scope, {
                sessionId,
                projectId: turn.projectId,
                userContent,
                assistantContent: candidate.content,
                sourceMessageId: persisted.assistantMessageId,
                provider: "streams-authoritative-runtime",
                providerStatus: "ok",
                metadata: { taskId: turn.taskId, parityProfile: STREAMS_PARITY_PROFILE_VERSION },
              }).catch(() => null);
              return persisted;
            },
          });

          send("activity", { phase: "streaming", statusText: "Writing…", source: SOURCE, sessionId });
          for (const token of chunks(result.candidate.content)) send("response", { token });
          send("complete", {
            ok: true,
            sessionId,
            assistantMessageId: (result.persisted as any).assistantMessageId,
            turnId: (result.persisted as any).turnId,
            taskId: result.turn.taskId,
            imageGrounded: imageUrls.length > 0,
            imageCount: imageUrls.length,
            webGrounded: result.candidate.webSearchUsed,
            citationCount: result.candidate.citationCount,
            serverTimestamp,
            parityProfile: STREAMS_PARITY_PROFILE_VERSION,
            qualityScore: result.judgment.overallScore,
            qualityAccepted: true,
            repairAttempts: result.repairAttempts,
            elapsedMs: Date.now() - startedAt,
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          const cancelled = request.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
          send("error", {
            message: cancelled ? "Streams stopped this response." : detail.startsWith("STREAMS_RESPONSE_REJECTED") ? "Streams could not produce a response that met the required quality and evidence checks." : "Streams could not complete this response. Please retry.",
            detailCode: cancelled ? "STREAMS_RESPONSE_CANCELLED" : detail.startsWith("STREAMS_RESPONSE_REJECTED") ? "STREAMS_RESPONSE_REJECTED" : "STREAMS_RESPONSE_FAILED",
            debugDetail: detail,
            sessionId,
            elapsedMs: Date.now() - startedAt,
          });
          console.error("[streams-ai/messages] response failed", detail);
        } finally {
          controller.close();
        }
      },
    }));
  } catch (error) {
    return streamsAIError(error);
  }
}
