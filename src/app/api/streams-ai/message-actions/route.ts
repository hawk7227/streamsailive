import { NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIMessagesRepository } from "@/lib/streams-ai/repositories/messages-repository";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";
import { StreamsAIUsageEventsRepository } from "@/lib/streams-ai/repositories/usage-events-repository";
import { buildAttachmentContext } from "@/lib/streams-ai/routes/messages-memory-provider-support";

const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();
const usage = new StreamsAIUsageEventsRepository();

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function extractText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  const parts: string[] = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const block of Array.isArray(item?.content) ? item.content : []) {
      if (typeof block?.text === "string") parts.push(block.text);
    }
  }
  return parts.join("\n\n").trim();
}

function findMessage(rows: any[], messageId?: string, content?: string) {
  if (messageId) {
    const exact = rows.find((row) => String(row.id) === String(messageId));
    if (exact) return exact;
  }
  const needle = String(content || "").trim();
  if (!needle) return null;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row?.role === "assistant" && String(row?.content || "").trim() === needle) return row;
  }
  return null;
}

async function logAction(scope: any, input: any) {
  await usage.create(scope, {
    sessionId: input.sessionId || null,
    eventType: `message.${String(input.action || "unknown")}`,
    productId: scope.productId,
    metadata: {
      messageId: input.messageId || null,
      source: "streams-chat-message-actions",
      freeAllowance: true,
      ...(input.metadata || {}),
    },
  });
}

async function branch(scope: any, input: any) {
  const sourceSessionId = String(input.sessionId || "");
  if (!sourceSessionId) throw new Error("sessionId is required");
  const rows = await messages.list(scope, sourceSessionId);
  const source = findMessage(rows, input.messageId, input.content);
  if (!source) throw new Error("Source response was not found");
  const sourceIndex = rows.findIndex((row: any) => row.id === source.id);
  const copied = rows.slice(0, sourceIndex + 1);
  const created = await sessions.create(scope, {
    title: `Branch: ${String(copied.find((row: any) => row.role === "user")?.content || "Conversation").slice(0, 48)}`,
    metadata: {
      branchedFromSessionId: sourceSessionId,
      branchedFromMessageId: source.id,
    },
  });
  for (const row of copied) {
    await messages.create(scope, {
      sessionId: created.id,
      role: row.role,
      content: row.content || "",
      status: row.status || "complete",
      metadata: {
        ...(row.metadata || {}),
        branchedCopy: true,
        sourceMessageId: row.id,
      },
    });
  }
  await logAction(scope, { ...input, action: "branch_created", messageId: source.id, metadata: { newSessionId: created.id } });
  return { sessionId: created.id, href: `/streams-ai/${created.id}` };
}

async function regenerate(scope: any, input: any) {
  const sessionId = String(input.sessionId || "");
  if (!sessionId) throw new Error("sessionId is required");
  const rows = await messages.list(scope, sessionId);
  const source = findMessage(rows, input.messageId, input.content);
  if (!source) throw new Error("Source response was not found");
  const sourceIndex = rows.findIndex((row: any) => row.id === source.id);
  let userIndex = sourceIndex - 1;
  while (userIndex >= 0 && rows[userIndex]?.role !== "user") userIndex -= 1;
  if (userIndex < 0) throw new Error("The source user request was not found");
  const userMessage = rows[userIndex];
  const idempotencyKey = String(input.idempotencyKey || `regenerate:${source.id}`);
  const existing = rows.find((row: any) => row?.role === "assistant" && row?.metadata?.regenerateIdempotencyKey === idempotencyKey);
  if (existing) return { message: existing, duplicatePrevented: true };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("The assistant service is unavailable");
  const attachmentContext = await buildAttachmentContext(scope, {
    sessionId,
    attachments: userMessage?.metadata?.attachments || [],
  } as any, sessionId);
  const historyText = rows.slice(Math.max(0, userIndex - 12), userIndex).map((row: any) => `${row.role}: ${row.content || ""}`).join("\n");
  const text = [
    "Answer the user request again as a fresh alternative. Preserve the conversation context and explicit output-format requirements. Do not mention regeneration.",
    historyText ? `<conversation_history>\n${historyText}\n</conversation_history>` : "",
    attachmentContext.text,
    `<user_request>\n${userMessage.content || ""}\n</user_request>`,
  ].filter(Boolean).join("\n\n");
  const userContent: any[] = [{ type: "input_text", text }];
  for (const image of attachmentContext.imageParts as any[]) {
    userContent.push({ type: "input_image", image_url: image.image_url?.url, detail: "high" });
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_RESPONSES_MODEL_NEXT || process.env.OPENAI_RESPONSES_MODEL || "gpt-4.1-mini",
      input: [{ role: "user", content: userContent }],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Regeneration did not complete");
  const content = extractText(payload);
  if (!content) throw new Error("Regeneration returned no response");
  const created = await messages.create(scope, {
    sessionId,
    role: "assistant",
    content,
    status: "complete",
    metadata: {
      regeneratedFromMessageId: source.id,
      regenerateIdempotencyKey: idempotencyKey,
      attachmentsPreserved: Boolean((userMessage?.metadata?.attachments || []).length),
    },
  });
  await sessions.update(scope, sessionId, { metadata: { ...(await sessions.get(scope, sessionId))?.metadata, lastRegeneratedAt: new Date().toISOString() } });
  await logAction(scope, { ...input, action: "regenerate_completed", messageId: source.id, metadata: { newMessageId: created.id } });
  return { message: created, duplicatePrevented: false };
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const input = await request.json().catch(() => ({}));
    const action = String(input.action || "");
    if (action === "branch") return json({ ok: true, ...(await branch(scope, input)) });
    if (action === "regenerate") return json({ ok: true, ...(await regenerate(scope, input)) });
    await logAction(scope, input);
    return json({ ok: true });
  } catch (error) {
    console.error("[streams-ai/message-actions] failed", error);
    return json({ ok: false, error: "The message action could not be completed." }, 400);
  }
}
