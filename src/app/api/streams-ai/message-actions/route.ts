import { NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIMessagesRepository } from "@/lib/streams-ai/repositories/messages-repository";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";
import { StreamsAIUsageEventsRepository } from "@/lib/streams-ai/repositories/usage-events-repository";
import { MESSAGE_ACTIONS, StreamsAIMessageActionsRepository, type MessageActionName } from "@/lib/streams-ai/repositories/message-actions-repository";
import { memoryMessagesPOST } from "@/lib/streams-ai/routes/messages-memory-active";
import { collectSseResponse, validateAndRepairResponse } from "@/lib/streams-ai/routes/structured-response-service";

const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();
const usage = new StreamsAIUsageEventsRepository();
const actions = new StreamsAIMessageActionsRepository();

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function canonicalValidationInstruction(userContent: string, attachments: any[]) {
  const hasImage = attachments.some((attachment) => {
    const mime = String(attachment?.mimeType || attachment?.mime_type || "").toLowerCase();
    const kind = String(attachment?.kind || "").toLowerCase();
    return kind === "image" || mime.startsWith("image/");
  });
  if (!hasImage) return userContent;
  return [
    userContent || "Review the attached screenshot.",
    "This request includes an image attachment and must use the canonical screenshot-review structure.",
    "Include a short summary, a Markdown table with exactly these columns: Visible claim | Verified by screenshot? | Evidence still required, a fenced code block, a blockquote warning, explicit screenshot attribution, and a verification note. Do not add a generic follow-up closing.",
  ].join("\n\n");
}

function requireString(value: unknown, name: string) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${name} is required`);
  return text;
}

async function getSource(scope: any, sessionId: string, messageId: string) {
  const rows = await messages.list(scope, sessionId);
  const sourceIndex = rows.findIndex((row: any) => String(row.id) === messageId && row.role === "assistant");
  if (sourceIndex < 0) throw new Error("Source response was not found");
  let userIndex = sourceIndex - 1;
  while (userIndex >= 0 && rows[userIndex]?.role !== "user") userIndex -= 1;
  if (userIndex < 0) throw new Error("The source user request was not found");
  return { rows, source: rows[sourceIndex], sourceIndex, userMessage: rows[userIndex], userIndex };
}

async function logAction(scope: any, input: any, action: MessageActionName) {
  await usage.create(scope, {
    sessionId: input.sessionId || null,
    eventType: `message.${action}`,
    productId: scope.productId,
    metadata: {
      messageId: input.messageId || null,
      source: "streams-chat-message-actions",
      freeAllowance: true,
      idempotencyKey: input.idempotencyKey || null,
      ...(input.metadata || {}),
    },
  });
}

async function acquireAction(scope: any, input: any, action: MessageActionName) {
  const idempotencyKey = requireString(input.idempotencyKey, "idempotencyKey");
  const acquired = await actions.beginReceipt(scope, {
    sessionId: input.sessionId || null,
    messageId: input.messageId || null,
    action,
    idempotencyKey,
  });
  if (!acquired.acquired) {
    if (acquired.receipt?.status === "completed") {
      return { idempotencyKey, duplicateResult: acquired.receipt.result || {} };
    }
    throw new Error("The same message action is already in progress");
  }
  return { idempotencyKey, duplicateResult: null };
}

async function branch(scope: any, input: any) {
  const sourceSessionId = requireString(input.sessionId, "sessionId");
  const messageId = requireString(input.messageId, "messageId");
  const { idempotencyKey, duplicateResult } = await acquireAction(scope, input, "branch");
  if (duplicateResult) return { ...duplicateResult, duplicatePrevented: true };

  try {
    const { rows, source, sourceIndex } = await getSource(scope, sourceSessionId, messageId);
    const copied = rows.slice(0, sourceIndex + 1);
    const created = await sessions.create(scope, {
      title: `Branch: ${String(copied.find((row: any) => row.role === "user")?.content || "Conversation").slice(0, 48)}`,
      metadata: {
        branchedFromSessionId: sourceSessionId,
        branchedFromMessageId: source.id,
        branchIdempotencyKey: idempotencyKey,
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
        turnId: row.turn_id || row.metadata?.turnId || null,
        idempotencyKey: `branch:${created.id}:${row.id}`,
      });
    }

    const result = { sessionId: created.id, href: `/streams-ai/${created.id}`, duplicatePrevented: false };
    await actions.completeReceipt(scope, idempotencyKey, result);
    await logAction(scope, { ...input, metadata: { newSessionId: created.id } }, "branch_created");
    return result;
  } catch (error) {
    await actions.failReceipt(scope, idempotencyKey, { error: error instanceof Error ? error.message : "Branch failed" }).catch(() => null);
    throw error;
  }
}

async function regenerate(scope: any, request: NextRequest, input: any) {
  const sessionId = requireString(input.sessionId, "sessionId");
  const messageId = requireString(input.messageId, "messageId");
  const { idempotencyKey, duplicateResult } = await acquireAction(scope, input, "regenerate");
  if (duplicateResult) return { ...duplicateResult, duplicatePrevented: true };

  try {
    const { source, userMessage } = await getSource(scope, sessionId, messageId);
    const attachments = Array.isArray(userMessage?.metadata?.attachments) ? userMessage.metadata.attachments : [];
    const turnId = crypto.randomUUID();
    await logAction(scope, input, "regenerate_started");

    const headers = new Headers(request.headers);
    headers.set("Content-Type", "application/json");
    const internalRequest = new NextRequest(request.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sessionId,
        content: userMessage.content || "",
        message: userMessage.content || "",
        role: "user",
        userId: idempotencyKey,
        idempotencyKey,
        turnId,
        attachments,
        metadata: {
          skipUserPersistence: true,
          sourceUserMessageId: userMessage.id,
          regeneratedFromMessageId: source.id,
          regenerationAttemptId: idempotencyKey,
        },
      }),
    });

    const upstream = await memoryMessagesPOST(internalRequest);
    const collected = await collectSseResponse(upstream);
    if (collected.errorPayload || !collected.content.trim()) {
      throw new Error(String(collected.errorPayload?.message || "Regeneration did not complete"));
    }

    const validationInstruction = canonicalValidationInstruction(String(userMessage.content || ""), attachments);
    const validated = await validateAndRepairResponse({
      instruction: validationInstruction,
      draft: collected.content,
      forceRepair: !collected.completePayload?.ok,
    });

    let assistantMessageId = String(collected.completePayload?.assistantMessageId || "");
    if (validated.repaired || !assistantMessageId) {
      const created = await messages.create(scope, {
        sessionId,
        role: "assistant",
        content: validated.content,
        status: "complete",
        turnId,
        idempotencyKey: `${idempotencyKey}:assistant-repaired`,
        metadata: {
          regeneratedFromMessageId: source.id,
          regenerationAttemptId: idempotencyKey,
          sourceUserMessageId: userMessage.id,
          attachmentsPreserved: attachments.length > 0,
          structureValidated: true,
          structureRepaired: validated.repaired,
          turnId,
        },
      });
      assistantMessageId = created.id;
    }

    const result = {
      messageId: assistantMessageId,
      sessionId,
      duplicatePrevented: false,
      structureRepaired: validated.repaired,
    };
    await actions.completeReceipt(scope, idempotencyKey, result);
    await logAction(scope, { ...input, metadata: { newMessageId: assistantMessageId, structureRepaired: validated.repaired } }, "regenerate_completed");
    return result;
  } catch (error) {
    await actions.failReceipt(scope, idempotencyKey, { error: error instanceof Error ? error.message : "Regeneration failed" }).catch(() => null);
    throw error;
  }
}

async function feedback(scope: any, input: any, action: MessageActionName) {
  const sessionId = requireString(input.sessionId, "sessionId");
  const messageId = requireString(input.messageId, "messageId");
  await getSource(scope, sessionId, messageId);
  const rating = action === "feedback_up" ? 1 : action === "feedback_down" ? -1 : null;
  const saved = await actions.setFeedback(scope, {
    sessionId,
    messageId,
    rating,
    metadata: input.metadata || {},
  });
  await logAction(scope, input, action);
  return { rating: saved?.rating ?? null };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const messageId = requireString(request.nextUrl.searchParams.get("messageId"), "messageId");
    const row = await actions.getFeedback(scope, messageId);
    return json({ ok: true, rating: row?.rating ?? null });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Unable to load feedback" }, 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const input = await request.json().catch(() => ({}));
    const action = String(input.action || "") as MessageActionName;
    if (!MESSAGE_ACTIONS.has(action)) return json({ ok: false, error: "Unsupported message action." }, 400);

    if (action === "branch") return json({ ok: true, ...(await branch(scope, input)) });
    if (action === "regenerate") return json({ ok: true, ...(await regenerate(scope, request, input)) });
    if (action === "feedback_up" || action === "feedback_down" || action === "feedback_cleared") {
      return json({ ok: true, ...(await feedback(scope, input, action)) });
    }

    await logAction(scope, input, action);
    return json({ ok: true });
  } catch (error) {
    console.error("[streams-ai/message-actions] failed", error);
    return json({ ok: false, error: "The message action could not be completed." }, 400);
  }
}
