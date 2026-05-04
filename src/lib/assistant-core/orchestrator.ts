import { NextRequest } from "next/server";
import "@/lib/env";
import { OPENAI_MODEL, OPENAI_MINI_MODEL, STREAMS_TOOL_TIMEOUT_MS } from "@/lib/env";
import type OpenAI from "openai";
import { routeRequest } from "./router";
import { buildContext } from "./context";
import { client } from "./openai";
import { buildAssistantTools, executeAssistantTool } from "./tools";
import { TurnTimer } from "./timing";
import { isChatQueryComplex } from "./complexQuerySignals";
import { classifyIntent, applyCostPreventionPolicy, buildPromptCacheParts, runPostCallGuards, updateCostMetrics } from "@/lib/streams/openai-prevention";
import { buildContextPacket } from "@/lib/streams/build-runtime/context-packet-builder";
import { runBuildQualityGate } from "@/lib/streams/build-runtime/build-quality-gate";
import { runSingleCorrectionPass } from "@/lib/streams/build-runtime/correction-loop";
import type {
  AssistantMode,
  ChatMessage,
  NormalizedAssistantRequest,
} from "./contracts";

type RequestBody = {
  message?: string;
  messages?: Array<{ role?: string; content?: unknown }>;
  context?: Record<string, unknown>;
};

type FunctionCallItem = {
  call_id: string;
  name: string;
  arguments: string;
};

type MediaArtifact = {
  kind: "image" | "video" | "i2v";
  url: string;
  artifactId: string | null;
  mimeType: string;
  title: string | null;
  result: Record<string, unknown>;
};

const encoder = new TextEncoder();

// ── Tool timeout ──────────────────────────────────────────────────────────
// Tool timeout: env var STREAMS_TOOL_TIMEOUT_MS, default 30s, capped at 90s.
// generate_media gets its own extended timeout — gpt-image-1/1.5 takes 20-60s.
const TOOL_TIMEOUT_MS = Math.min(
  Number(STREAMS_TOOL_TIMEOUT_MS ?? "30000") || 30_000,
  90_000,
);
const MEDIA_TOOL_TIMEOUT_MS = 90_000; // gpt-image-1/1.5 can take up to 60s

function withToolTimeout<T>(
  promise: Promise<T>,
  toolName: string,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`TOOL_TIMEOUT: ${toolName} exceeded ${timeoutMs}ms limit`)),
      timeoutMs,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!));
}

function sse(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function normalizeMessages(value: RequestBody["messages"]): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { role: string; content: unknown } =>
      !!item && typeof item.role === "string",
    )
    .map((item) => {
      const role =
        item.role === "system" || item.role === "assistant" || item.role === "user"
          ? item.role
          : "user";
      let content = "";
      if (typeof item.content === "string") {
        content = item.content;
      } else if (Array.isArray(item.content)) {
        content = item.content
          .map((part) => {
            if (typeof part === "string") return part;
            if (part && typeof part === "object" && "text" in part && typeof (part as { text?: unknown }).text === "string") {
              return String((part as { text: string }).text);
            }
            return "";
          })
          .join("\n");
      }
      return { role, content };
    })
    .filter((item) => item.content.trim().length > 0) as ChatMessage[];
}

function normalizeRequest(body: RequestBody): NormalizedAssistantRequest {
  const messages = normalizeMessages(body.messages);
  const latestUserMessage =
    messages.slice().reverse().find((m) => m.role === "user")?.content ?? "";
  const userText =
    typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : latestUserMessage;
  return {
    userText,
    messages,
    context: body.context && typeof body.context === "object" ? body.context : {},
  };
}

function extractTextFromContent(
  content: Array<OpenAI.Responses.ResponseOutputText | OpenAI.Responses.ResponseOutputRefusal>,
): string[] {
  return content
    .filter((part): part is OpenAI.Responses.ResponseOutputText => part.type === "output_text")
    .map((part) => part.text)
    .filter((text) => text.trim().length > 0);
}

function getTextFromResponse(response: OpenAI.Responses.Response): string {
  if (response.output_text.trim()) return response.output_text.trim();
  const chunks: string[] = [];
  for (const item of response.output) {
    if (item.type === "message") chunks.push(...extractTextFromContent(item.content));
  }
  return chunks.join("\n").trim();
}

function getFunctionCalls(response: OpenAI.Responses.Response): FunctionCallItem[] {
  return response.output
    .filter((item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === "function_call")
    .map((item) => ({ call_id: item.call_id, name: item.name, arguments: item.arguments }))
    .filter((item) => item.call_id && item.name);
}

// ── Context window (§4) ───────────────────────────────────────────────────
const CONTEXT_WINDOW_SIZE = 20;

function applyMessageWindow(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= CONTEXT_WINDOW_SIZE) return messages;
  return messages.slice(-CONTEXT_WINDOW_SIZE);
}

// ── Model selection ──────────────────────────────────────────────────────────
// Two-phase strategy: gpt-4o-mini first, escalate to full model when needed.
//
// Upfront full-model routes:
//   build — code generation requires consistent quality
//   file  — workspace operations need reliable tool-use reasoning
//   Any route with file context — semantic synthesis over chunks
//
// Post-stream escalation:
//   When mini calls tools (no text was streamed), the continuation response
//   uses the full model. The user sees the continuation text — it must be
//   high quality. Tool calls produce no text.delta events, so no partial
//   text has been shown when this decision is made.
//
// Env overrides:
//   OPENAI_MODEL      — full model (default: gpt-4.1)
//   OPENAI_MINI_MODEL — fast model (default: gpt-4o-mini)

const FULL_MODEL_ROUTES = new Set<AssistantMode>(["build", "file"]);

// isChatQueryComplex imported from ./complexQuerySignals.
// To add new keywords or update thresholds, edit that module.
// See its header for the routing miss procedure.

function selectInitialModel(
  route: AssistantMode,
  hasFileContext: boolean,
  isComplexChat: boolean,
): string {
  // File context requires semantic synthesis over retrieved chunks — full model
  if (hasFileContext) return OPENAI_MODEL;
  // Build and file workspace routes — full model for reliability and consistency
  if (FULL_MODEL_ROUTES.has(route)) return OPENAI_MODEL;
  // Chat route: escalate when query signals complex reasoning (pre-computed)
  if (isComplexChat) return OPENAI_MODEL;
  // All other routes (chat simple, image, video) start with mini
  return OPENAI_MINI_MODEL;
}

function selectContinuationModel(
  initialModel: string,
  firstCallHadTools: boolean,
): string {
  // When mini called tools, escalate to full model for the synthesis response.
  // This is the text the user actually reads — it should be high quality.
  if (initialModel === OPENAI_MINI_MODEL && firstCallHadTools) return OPENAI_MODEL;
  return initialModel;
}

// ── Multimodal content (§21) ──────────────────────────────────────────────
type InputTextPart  = { type: "input_text";  text: string };
type InputImagePart = { type: "input_image"; image_url: string; detail: "auto" };
type InputContentPart = InputTextPart | InputImagePart;

function buildUserContent(text: string, imageUrls: string[]): string | InputContentPart[] {
  if (imageUrls.length === 0) return text;
  const parts: InputContentPart[] = [{ type: "input_text", text }];
  for (const url of imageUrls) parts.push({ type: "input_image", image_url: url, detail: "auto" });
  return parts;
}

function extractImageUrls(context: Record<string, unknown>): string[] {
  const attachments = context.attachments;
  if (!Array.isArray(attachments)) return [];
  return attachments
    .filter((a): a is { kind: string; payload: string } =>
      !!a && typeof a === "object" &&
      (a as Record<string, unknown>).kind === "image" &&
      typeof (a as Record<string, unknown>).payload === "string" &&
      String((a as Record<string, unknown>).payload).startsWith("http"),
    )
    .map((a) => a.payload);
}

function buildInputMessages(
  systemPrompt: string,
  messages: ChatMessage[],
  userText: string,
  imageUrls: string[] = [],
): Array<{ role: "system" | "user" | "assistant"; content: string | InputContentPart[] }> {
  const windowed = applyMessageWindow(messages);
  let base: Array<{ role: "system" | "user" | "assistant"; content: string | InputContentPart[] }>;
  if (windowed.length > 0) {
    const lastUserIdx = windowed.map((m) => m.role).lastIndexOf("user");
    base = windowed.map((m, i) => {
      if (i === lastUserIdx && imageUrls.length > 0) {
        return { role: m.role, content: buildUserContent(m.content, imageUrls) };
      }
      return { role: m.role, content: m.content };
    });
  } else {
    const content = userText ? buildUserContent(userText, imageUrls) : ("" as string);
    base = userText ? [{ role: "user" as const, content }] : [];
  }
  if (!systemPrompt.trim()) return base;
  return [{ role: "system", content: systemPrompt }, ...base];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>) : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeMediaKind(value: unknown): "image" | "video" | "i2v" {
  if (value === "video") return "video";
  if (value === "i2v") return "i2v";
  return "image";
}

function extractMediaArtifact(result: unknown): MediaArtifact | null {
  const root = asRecord(result);
  if (!root) return null;
  const payload = asRecord(root.payload);
  const data = asRecord(root.data);

  const url = firstString(
    root.outputUrl, root.url, root.assetUrl, root.videoUrl, root.imageUrl,
    payload?.outputUrl, payload?.url, payload?.assetUrl, payload?.videoUrl, payload?.imageUrl,
    data?.outputUrl, data?.url, data?.assetUrl, data?.videoUrl, data?.imageUrl,
  );
  if (!url) return null;

  const kind = normalizeMediaKind(firstString(root.type, payload?.type, data?.type));

  // externalId is the artifactId written by finalizeImageArtifact /
  // finalizeVideoArtifact during the tool execution — available on result.
  const artifactId = firstString(root.externalId, payload?.externalId) ?? null;

  // mimeType: images are always png from gpt-image-1; video defaults to mp4.
  const mimeType =
    kind === "image" ? "image/png"
    : kind === "i2v"  ? "video/mp4"
    : "video/mp4";

  // title: the generation prompt, truncated for display.
  // Pulled from plan.prompt (MediaGenerationExecution shape) or root.prompt.
  const planRecord = asRecord(root.plan);
  const title = firstString(planRecord?.prompt, root.prompt) ?? null;

  return { kind, url, artifactId, mimeType, title, result: root };
}

// ── Streaming first-pass response ─────────────────────────────────────────
// Calls OpenAI with stream:true. Emits text.delta SSE events per token as
// they arrive. Returns the final Response object from response.completed
// for function call extraction — identical to the blocking path.
//
// PRD §3: first token <200ms. Streaming mode is required to achieve this.
// The realtime server already handles multiple text.delta events; previously
// it was receiving only one (the full response in a single event).
async function streamFirstResponse(
  params: {
    model: string;
    input: Parameters<typeof client.responses.create>[0]["input"];
    tools: Parameters<typeof client.responses.create>[0]["tools"];
  },
  send: (event: string, data: unknown) => void,
  timer: TurnTimer,
): Promise<OpenAI.Responses.Response> {
  const stream = await client.responses.create({
    model: params.model,
    input: params.input,
    tools: params.tools,
    stream: true,
  });

  let firstTokenEmitted = false;
  let completedResponse: OpenAI.Responses.Response | null = null;

  for await (const event of stream) {
    switch (event.type) {
      case "response.output_text.delta": {
        // §3: first token instrumentation
        if (!firstTokenEmitted) {
          timer.mark("first_text_ready");
          firstTokenEmitted = true;
        }
        if (event.delta) {
          send("text_delta", { delta: event.delta });
        }
        break;
      }

      case "response.completed": {
        completedResponse = event.response;
        break;
      }

      case "response.failed":
      case "response.incomplete": {
        // Surface failure — caller will handle it
        break;
      }

      default:
        // All other events (function_call_arguments.delta, etc.) are
        // accumulated inside the final Response on response.completed.
        break;
    }
  }

  if (!completedResponse) {
    throw new Error("OpenAI stream completed without a response.completed event");
  }

  // If no text was emitted via deltas (pure tool-call response),
  // mark first_text_ready now so timing is still recorded.
  if (!firstTokenEmitted) {
    timer.mark("first_text_ready");
  }

  return completedResponse;
}

// ── Main orchestrator ─────────────────────────────────────────────────────

export async function runOrchestrator(req: NextRequest) {
  const body = (await req.json()) as RequestBody;
  const normalized = normalizeRequest(body);
  const intent = classifyIntent(normalized.userText);
  const preCall = applyCostPreventionPolicy(intent, normalized.userText);

  // Each turn gets a timer. turnId derived from context if present, else new UUID.
  const turnId =
    typeof normalized.context.turnId === "string"
      ? normalized.context.turnId
      : crypto.randomUUID();
  const timer = new TurnTimer(turnId);

  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        let streamClosed = false;

        const send = (event: string, data: unknown) => {
          if (streamClosed) return;
          controller.enqueue(sse(event, data));
        };

        const closeStream = (donePayload: Record<string, unknown>) => {
          if (streamClosed) return;
          timer.mark("turn_complete");
          timer.flush();
          send("done", donePayload);
          streamClosed = true;
          controller.close();
        };

        try {
          send("phase", { phase: "routing" });
          const route = routeRequest(normalized);

          send("phase", { phase: "building_context", route });

          // ── Context build — measured ──────────────────────────────────
          const assembledContext = await buildContext({
            route,
            userText: normalized.userText,
            messages: normalized.messages,
            context: normalized.context,
            workspaceId:
              typeof normalized.context.workspaceId === "string"
                ? normalized.context.workspaceId : undefined,
            conversationId:
              typeof normalized.context.conversationId === "string"
                ? normalized.context.conversationId : undefined,
          });

          timer.mark("context_built");
          const contextPacket = buildContextPacket({
            activeSlice: "Full Build Only API Enforcement / OpenAI Call Prevention and Cost Control Runtime",
            allowedFiles: [], forbiddenFiles: [], proofRequirements: ["runtime proof", "output proof"],
            snippets: [{ path: "src/lib/assistant-core/orchestrator.ts", excerpt: normalized.userText.slice(0, 400) }],
          });

          // Computed once — used in both timer annotation and model selection
          const isComplexChat = route === "chat" && isChatQueryComplex(normalized.userText);

          // annotation updated after first response (escalated + continuation_model fields added below)
          timer.annotate({
            route,
            msg_length: normalized.userText.length,
            had_file_ctx: !!assembledContext.fileContext,
            complex_query: isComplexChat,
            windowed_messages: Math.min(normalized.messages.length, CONTEXT_WINDOW_SIZE),
          });

          const tools = buildAssistantTools({ route, context: assembledContext });
          // Select initial model based on route, context, and query complexity
          const initialModel = selectInitialModel(
            route,
            !!assembledContext.fileContext,
            isComplexChat,
          );
          const imageUrls = extractImageUrls(normalized.context);
          const initialInput = buildInputMessages(
            assembledContext.systemPrompt,
            normalized.messages,
            normalized.userText,
            imageUrls,
          );

          if (!preCall.shouldCallModel) {
            send("phase", { phase: "tool_first_skip", reason: preCall.reason });
            closeStream({ ok: true, skippedModelCall: true, reason: preCall.reason });
            return;
          }
          const cacheParts = buildPromptCacheParts("streams-full-build-rulepack-v1", JSON.stringify(contextPacket));
          send("phase", { phase: "calling_openai", model: initialModel, promptCacheKey: cacheParts.prompt_cache_key });

          // ── First OpenAI call — streaming, measured ───────────────────
          // Uses mini for chat/image/video routes; full model for build/file
          // and file-backed turns. See selectInitialModel().
          timer.mark("openai_called");

          let response = await streamFirstResponse(
            { model: initialModel, input: initialInput, tools },
            send,
            timer,
          );

          // Determine continuation model after the first response.
          // If mini called tools (no text was streamed), escalate to full model
          // for the synthesis response the user actually reads.
          const firstCallHadTools = getFunctionCalls(response).length > 0;
          const continuationModel = selectContinuationModel(initialModel, firstCallHadTools);
          const escalated = continuationModel !== initialModel;

          // Annotate timing with model selection outcome
          timer.annotate({
            model: initialModel,
            continuation_model: continuationModel,
            escalated,
          });

          let loopCount = 0;
          const maxLoops = 12;
          let mediaResolved = false;

          // ── Tool loop — blocking calls (tool responses are fast) ──────
          while (loopCount < maxLoops && !streamClosed) {
            const calls = getFunctionCalls(response);
            if (calls.length === 0) break;

            loopCount++;

            const toolOutputs: Array<{
              type: "function_call_output";
              call_id: string;
              output: string;
            }> = [];

            for (const call of calls) {
              if (streamClosed) return;

              send("tool_call", { call_id: call.call_id, name: call.name });

              let parsedArgs: Record<string, unknown> = {};
              try { parsedArgs = JSON.parse(call.arguments || "{}"); } catch { parsedArgs = {}; }

              // generate_media gets extended timeout — gpt-image-1/1.5 takes 20-60s
              const toolTimeoutMs = call.name === "generate_media"
                ? MEDIA_TOOL_TIMEOUT_MS
                : TOOL_TIMEOUT_MS;

              try {
                const result = await withToolTimeout(
                  executeAssistantTool(
                    { name: call.name, args: parsedArgs, route: route as AssistantMode, context: assembledContext },
                    {
                      onProgress: (text: string) => {
                        if (text?.trim()) send("tool_progress", { name: call.name, text });
                      },
                    },
                  ),
                  call.name,
                  toolTimeoutMs,
                );

                send("tool_result", { name: call.name, result });

                if (result && typeof result === "object" && ("action" in result || "payload" in result)) {
                  send("tool_result", result);
                }

                // Detect file write operations — emit file_written so the client
                // can render the content inline. Must happen before the media check.
                if (
                  call.name === "write_workspace_file" ||
                  call.name === "apply_workspace_patch"
                ) {
                  const r = asRecord(result);
                  const preview = firstString(r?.contentPreview);
                  const filePath = firstString(r?.path);
                  if (preview && filePath) {
                    send("file_written", {
                      path: filePath,
                      operation: typeof r?.operation === "string" ? r.operation : "write",
                      contentPreview: preview,
                      bytesWritten: typeof r?.bytesWritten === "number" ? r.bytesWritten : 0,
                      language: typeof r?.language === "string" ? r.language : null,
                    });
                  }
                }

                const mediaArtifact =
                  call.name === "generate_media" ? extractMediaArtifact(result) : null;

                if (mediaArtifact) {
                  mediaResolved = true;
                  send("phase", { phase: "media_ready", kind: mediaArtifact.kind });
                  send("media", { kind: mediaArtifact.kind, url: mediaArtifact.url, result: mediaArtifact.result });
                  if (mediaArtifact.kind === "image") {
                    send("image", {
                      url: mediaArtifact.url,
                      artifactId: mediaArtifact.artifactId,
                      mimeType: mediaArtifact.mimeType,
                      mediaType: mediaArtifact.kind,
                      title: mediaArtifact.title,
                      result: mediaArtifact.result,
                    });
                  } else {
                    send("video", {
                      url: mediaArtifact.url,
                      artifactId: mediaArtifact.artifactId,
                      mimeType: mediaArtifact.mimeType,
                      mediaType: mediaArtifact.kind,
                      title: mediaArtifact.title,
                      result: mediaArtifact.result,
                    });
                  }
                  timer.annotate({ tool_count: loopCount });
                  closeStream({ ok: true, media: true, kind: mediaArtifact.kind });
                  return;
                }

                toolOutputs.push({
                  type: "function_call_output",
                  call_id: call.call_id,
                  output: JSON.stringify(result ?? null),
                });
              } catch (error) {
                const message = error instanceof Error ? error.message : "tool execution failed";
                send("tool_error", { name: call.name, error: message });
                toolOutputs.push({
                  type: "function_call_output",
                  call_id: call.call_id,
                  output: JSON.stringify({ ok: false, error: message }),
                });
              }
            }

            if (streamClosed) return;
            if (mediaResolved) return;

            send("phase", { phase: "continuing_after_tools" });

            // Post-tool continuation — blocking mode is correct here.
            // Uses continuationModel: full model when mini called tools (escalated),
            // or the initial model when full model was used from the start.
            response = await client.responses.create({
              model: continuationModel,
              previous_response_id: response.id,
              input: toolOutputs,
            });

            // Emit any text from the continuation response
            const continuationText = getTextFromResponse(response);
            if (continuationText) {
              send("text_delta", { delta: continuationText });
            }
          }

          if (streamClosed) return;

          timer.annotate({ tool_count: loopCount });
          send("phase", { phase: "finalizing" });

          // Fallback: if no text was streamed and no tools ran, the model returned
          // an empty or unrecognised output. Surface it explicitly.
          // Normal case (loopCount === 0, text already streamed via text_delta events
          // in streamFirstResponse): no action needed here.
          if (loopCount === 0 && !getTextFromResponse(response)) {
            const outputTypes = Array.isArray(response?.output)
              ? response.output.map((item: OpenAI.Responses.ResponseOutputItem) => item.type).join(", ")
              : "none";
            send("text_delta", {
              delta: `I received your message, but no text content was returned by the model. [output types: ${outputTypes}]`,
            });
          }

          let finalText = getTextFromResponse(response);
          let gate = route === "build" ? runBuildQualityGate({ userRequest: normalized.userText, assistantOutput: finalText, checksRun: ["tsc"], classification: "Implemented but unproven" }) : { passed: true, failures: [] as string[] };
          let post = runPostCallGuards(finalText);
          if (route === "build" && (!gate.passed || !post.passed)) {
            const failures = [...(gate.failures || []), ...(post.failures || [])];
            const correctionPrompt = `Full Build Only Gate failed. Fix all failures and return complete build response. Failures: ${failures.join(", ")}`;
            const corrected = await client.responses.create({ model: continuationModel, input: [{ role: "user", content: correctionPrompt }] });
            finalText = getTextFromResponse(corrected);
            const correction = runSingleCorrectionPass({ userRequest: normalized.userText, assistantOutput: finalText, checksRun: ["tsc"], classification: "Implemented but unproven" }, finalText);
            gate = correction.final;
            post = runPostCallGuards(finalText);
            if (!gate.passed || !post.passed) {
              closeStream({ ok: false, classification: "Blocked", reason: "Full Build Only Gate failed.", failures: [...(gate.failures||[]), ...(post.failures||[])] });
              return;
            }
            if (finalText) send("text_delta", { delta: finalText });
          } else if (!gate.passed || !post.passed) {
            closeStream({ ok: false, classification: "Blocked", failures: [...(gate.failures||[]), ...(post.failures||[])] });
            return;
          }
          closeStream({ ok: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : "orchestrator failed";
          timer.mark("turn_complete");
          timer.flush();
          send("tool_error", { error: message });
          closeStream({ ok: false, error: message });
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    },
  );
}
