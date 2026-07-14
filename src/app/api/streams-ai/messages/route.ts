import { NextRequest } from "next/server";
import { memoryMessagesGET, memoryMessagesPOST } from "@/lib/streams-ai/routes/messages-memory-active";
import { requiresDeterministicStructureCheck, validateResponseStructure } from "@/lib/streams-ai/routes/response-structure-validator";

function encodeSse(event: string, payload: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function streamTextResponse(text: string, metadata: Record<string, unknown> = {}) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSse("activity", {
        phase: "writing",
        statusText: "Writing…",
      })));

      const chunks = String(text || "").match(/[\s\S]{1,240}/g) || [""];
      for (const token of chunks) controller.enqueue(encoder.encode(encodeSse("response", { token })));

      controller.enqueue(encoder.encode(encodeSse("complete", {
        ok: true,
        elapsedMs: Date.now() - startedAt,
        ...metadata,
      })));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function safeFallbackStream(_error: unknown) {
  return streamTextResponse(
    "Streams could not complete that response. Please retry.",
    { status: "error" },
  );
}

function isSimpleGreeting(_text: string) {
  return false;
}

function isStreamsSystemAuditPrompt(_text: string) {
  return false;
}

function buildStreamsAuditResponse() {
  return "Audit fast path disabled. Normal chat requests are delegated to the active assistant route.";
}

function hasImageAttachment(attachments: unknown) {
  if (!Array.isArray(attachments)) return false;
  return attachments.some((attachment: any) => {
    const mime = String(attachment?.mimeType || attachment?.mime_type || "").toLowerCase();
    const kind = String(attachment?.kind || "").toLowerCase();
    const name = String(attachment?.name || "").toLowerCase();
    return kind === "image" || mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif|bmp|tiff?)$/.test(name);
  });
}

function screenshotValidationInstruction(userContent: string) {
  return [
    userContent || "Review the attached screenshot.",
    "This request includes an image attachment and must use the canonical screenshot-review structure.",
    "Include a short summary, a Markdown table with exactly these columns: Visible claim | Verified by screenshot? | Evidence still required, a fenced code block, a blockquote warning, explicit screenshot attribution, and a verification note. Do not add a generic follow-up closing.",
  ].join("\n\n");
}

type ParsedSseEvent = { eventName: string; payload: Record<string, any> };

function parseSseBuffer(buffer: string) {
  const events: ParsedSseEvent[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() || "";

  for (const part of parts) {
    let eventName = "message";
    const dataLines: string[] = [];
    for (const rawLine of part.split("\n")) {
      const line = rawLine.trimEnd();
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    const raw = dataLines.join("\n");
    if (!raw) continue;
    try {
      events.push({ eventName, payload: JSON.parse(raw) });
    } catch {
      events.push({ eventName, payload: { message: raw } });
    }
  }

  return { events, rest };
}

async function collectUpstreamResponse(
  response: Response,
  onActivity: (payload: Record<string, unknown>) => void,
) {
  if (!response.body) throw new Error("Structured response stream was unavailable");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let completePayload: Record<string, any> | null = null;
  let errorPayload: Record<string, any> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseBuffer(buffer);
    buffer = parsed.rest;

    for (const event of parsed.events) {
      if (event.eventName === "activity") {
        const statusText = String(event.payload?.statusText || "").trim();
        if (statusText) onActivity({ phase: event.payload?.phase || "working", statusText });
      } else if (event.eventName === "response" || event.eventName === "reasoning") {
        content += String(event.payload?.token || event.payload?.delta || event.payload?.text || "");
      } else if (event.eventName === "complete") {
        completePayload = event.payload;
      } else if (event.eventName === "error") {
        errorPayload = event.payload;
      }
    }
  }

  return { content, completePayload, errorPayload };
}

function extractResponseText(json: any) {
  if (typeof json?.output_text === "string" && json.output_text.trim()) return json.output_text.trim();
  const parts: string[] = [];
  for (const item of Array.isArray(json?.output) ? json.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === "string" && content.text.trim()) parts.push(content.text.trim());
    }
  }
  return parts.join("\n\n").trim();
}

async function repairStructuredResponse(input: {
  instruction: string;
  draft: string;
  missing: string[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Assistant repair service is unavailable");
  const model = process.env.OPENAI_RESPONSES_MODEL_NEXT
    || process.env.OPENAI_RESPONSES_MODEL
    || process.env.OPENAI_SEARCH_MODEL
    || "gpt-4.1-mini";

  const repairInstruction = [
    "Repair the draft so it follows the user's requested output structure exactly.",
    `Missing requirements: ${input.missing.join(", ")}.`,
    "Preserve the draft's supported facts and conclusions. Do not add new factual claims.",
    "For screenshot claims, retain explicit attribution such as 'The screenshot shows' or 'The screenshot displays'.",
    "Return only the complete repaired answer, with no commentary about the repair.",
    "",
    "USER INSTRUCTION:",
    input.instruction,
    "",
    "DRAFT:",
    input.draft,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: repairInstruction,
    }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Structured response repair failed");
  const repaired = extractResponseText(json);
  if (!repaired) throw new Error("Structured response repair returned no text");
  return repaired;
}

async function persistRepairedTurn(request: NextRequest, body: Record<string, any>, userContent: string, repaired: string) {
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");

  const userRequest = new NextRequest(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...body,
      content: userContent,
      message: userContent,
      role: "user",
      runAssistant: false,
    }),
  });
  const userResponse = await memoryMessagesPOST(userRequest);
  const userData = await userResponse.json().catch(() => ({}));
  if (!userResponse.ok || !userData?.sessionId) throw new Error("Could not save repaired user turn");

  const assistantRequest = new NextRequest(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sessionId: userData.sessionId,
      content: repaired,
      message: repaired,
      role: "assistant",
      runAssistant: false,
      status: "complete",
      metadata: {
        structureValidated: true,
        structureRepaired: true,
      },
    }),
  });
  const assistantResponse = await memoryMessagesPOST(assistantRequest);
  if (!assistantResponse.ok) throw new Error("Could not save repaired assistant turn");

  return userData.sessionId as string;
}

function structuredResponse(
  request: NextRequest,
  body: Record<string, any>,
  userContent: string,
  validationInstruction: string,
) {
  const encoder = new TextEncoder();

  return new Response(new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(encodeSse(event, payload)));
      };

      try {
        const upstream = await memoryMessagesPOST(request);
        const collected = await collectUpstreamResponse(upstream, (payload) => send("activity", payload));
        let finalContent = collected.content;
        let validation = validateResponseStructure(validationInstruction, finalContent);
        let repaired = false;
        let sessionId = String(collected.completePayload?.sessionId || "");

        if (!validation.valid || !collected.completePayload?.ok || collected.errorPayload) {
          send("activity", { phase: "checking", statusText: "Preparing response…" });
          finalContent = await repairStructuredResponse({
            instruction: validationInstruction,
            draft: finalContent,
            missing: validation.missing.length ? validation.missing : ["valid completed response"],
          });
          validation = validateResponseStructure(validationInstruction, finalContent);
          if (!validation.valid) throw new Error("Repaired response did not satisfy requested structure");
          sessionId = await persistRepairedTurn(request, body, userContent, finalContent);
          repaired = true;
        }

        send("activity", { phase: "streaming", statusText: "Writing…" });
        for (const token of finalContent.match(/[\s\S]{1,240}/g) || [""]) {
          send("response", { token });
        }
        send("complete", {
          ok: true,
          sessionId,
          structureValidated: true,
          structureRepaired: repaired,
        });
      } catch (error) {
        console.error("[streams-ai/messages] structured response failed", error);
        send("error", {
          message: "Streams could not complete the requested response format. Please retry.",
          detailCode: "STRUCTURED_RESPONSE_FAILED",
        });
      } finally {
        controller.close();
      }
    },
  }), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET(request: NextRequest) {
  return memoryMessagesGET(request);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.clone().json().catch(() => ({}));
    const userContent = String(body?.content || body?.message || "").trim();
    const imageAttached = hasImageAttachment(body?.attachments);
    const validationInstruction = imageAttached
      ? screenshotValidationInstruction(userContent)
      : userContent;

    if (isSimpleGreeting(userContent)) {
      return streamTextResponse("Hey — I’m here. What are we building or fixing next?", {
        fastPath: "simple-greeting",
      });
    }

    if (isStreamsSystemAuditPrompt(userContent)) {
      return streamTextResponse(buildStreamsAuditResponse(), {
        fastPath: "streams-system-audit",
      });
    }

    if (imageAttached || requiresDeterministicStructureCheck(validationInstruction)) {
      return structuredResponse(request, body, userContent, validationInstruction);
    }

    const response = await memoryMessagesPOST(request);
    if (response.status >= 400) return safeFallbackStream(`messages route returned ${response.status}`);
    return response;
  } catch (error) {
    return safeFallbackStream(error);
  }
}
