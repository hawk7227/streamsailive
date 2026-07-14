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

function normalizeAction(value: unknown): MessageActionName | "" {
  const raw = String(value || "").trim().toLowerCase();
  const aliases: Record<string, MessageActionName> = {
    copy: "copied",
    copied: "copied",
    share: "shared",
    shared: "shared",
    like: "feedback_up",
    dislike: "feedback_down",
    clear_feedback: "feedback_cleared",
    more: "more_menu_opened",
    read_aloud: "read_aloud_started",
  };
  return (aliases[raw] || raw) as MessageActionName;
}

function isMissingActionStorage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /streams_ai_message_(feedback|action_receipts)|relation .* does not exist|schema cache|could not find the table/i.test(message);
}

function legacyIdempotencyKey(scope: any, input: any, action: MessageActionName) {
  const supplied = String(input.idempotencyKey || "").trim();
  if (supplied) return supplied;
  const sessionId = String(input.sessionId || "").trim();
  const messageId = String(input.messageId || "").trim();
  if (action === "branch") return `branch:${scope.tenantId}:${scope.userId}:${sessionId}:${messageId || "legacy"}`;
  return `${action}:${scope.tenantId}:${scope.userId}:${sessionId}:${messageId || crypto.randomUUID()}:${crypto.randomUUID()}`;
}

async function getSource(scope: any, sessionId: string, messageId?: string, content?: string) {
  const rows = await messages.list(scope, sessionId);
  let sourceIndex = messageId
    ? rows.findIndex((row: any) => String(row.id) === String(messageId) && row.role === "assistant")
    : -1;

  if (sourceIndex < 0 && content) {
    const needle = String(content).trim();
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row: any = rows[index];
      if (row?.role === "assistant" && String(row?.content || "").trim() === needle) {
        sourceIndex = index;
        break;
      }
    }
  }

  if (sourceIndex < 0) throw new Error("Source response was not found");
  let userIndex = sourceIndex - 1;
  while (userIndex >= 0 && (rows[userIndex] as any)?.role !== "user") userIndex -= 1;
  if (userIndex < 0) throw new Error("The source user request was not found");
  return { rows, source: rows[sourceIndex] as any, sourceIndex, userMessage: rows[userIndex] as any, userIndex };
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
  const idempotencyKey = legacyIdempotencyKey(scope, input, action);
  try {
    const acquired = await actions.beginReceipt(scope, {
      sessionId: input.sessionId || null,
      messageId: input.messageId || null,
      action,
      idempotencyKey,
    });
    if (!acquired.acquired) {
      if (acquired.receipt?.status === "completed") {
        return { idempotencyKey, duplicateResult: acquired.receipt.result || {}, receiptBacked: true };
      }
      throw new Error("The same message action is already in progress");
    }
    return { idempotencyKey, duplicateResult: null, receiptBacked: true };
  } catch (error) {
    if (!isMissingActionStorage(error)) throw error;
    return { idempotencyKey, duplicateResult: null, receiptBacked: false };
  }
}

async function completeReceipt(scope: any, idempotencyKey: string, result: Record<string, unknown>, receiptBacked: boolean) {
  if (!receiptBacked) return;
  await actions.completeReceipt(scope, idempotencyKey, result);
}

async function failReceipt(scope: any, idempotencyKey: string, result: Record<string, unknown>, receiptBacked: boolean) {
  if (!receiptBacked) return;
  await actions.failReceipt(scope, idempotencyKey, result).catch(() => null);
}

async function branch(scope: any, input: any) {
  const sourceSessionId = requireString(input.sessionId, "sessionId");
  const { rows, source, sourceIndex } = await getSource(scope, sourceSessionId, input.messageId, input.content);
  const messageId = String(source.id);
  input.messageId = messageId;
  const { idempotencyKey, duplicateResult, receiptBacked } = await acquireAction(scope, input, "branch");
  if (duplicateResult) return { ...duplicateResult, duplicatePrevented: true };

  try {
    const existing = (await sessions.list(scope)).find((row: any) =>
      row?.metadata?.branchedFromSessionId === sourceSessionId
      && row?.metadata?.branchedFromMessageId === messageId,
    );
    if (existing) {
      const existingResult = { sessionId: existing.id, href: `/streams-ai/${existing.id}`, duplicatePrevented: true };
      await completeReceipt(scope, idempotencyKey, existingResult, receiptBacked);
      return existingResult;
    }

    const copied = rows.slice(0, sourceIndex + 1);
    const created = await sessions.create(scope, {
      title: `Branch: ${String((copied.find((row: any) => row.role === "user") as any)?.content || "Conversation").slice(0, 48)}`,
      metadata: {
        branchedFromSessionId: sourceSessionId,
        branchedFromMessageId: source.id,
        branchIdempotencyKey: idempotencyKey,
      },
    });

    for (const row of copied as any[]) {
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
    await completeReceipt(scope, idempotencyKey, result, receiptBacked);
    await logAction(scope, { ...input, metadata: { newSessionId: created.id } }, "branch_created");
    return result;
  } catch (error) {
    await failReceipt(scope, idempotencyKey, { error: error instanceof Error ? error.message : "Branch failed" }, receiptBacked);
    throw error;
  }
}

async function regenerate(scope: any, request: NextRequest, input: any) {
  const sessionId = requireString(input.sessionId, "sessionId");
  const resolved = await getSource(scope, sessionId, input.messageId, input.content);
  const messageId = String(resolved.source.id);
  input.messageId = messageId;
  const { idempotencyKey, duplicateResult, receiptBacked } = await acquireAction(scope, input, "regenerate");
  if (duplicateResult) return { ...duplicateResult, duplicatePrevented: true };

  try {
    const { source, userMessage } = resolved;
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
    await completeReceipt(scope, idempotencyKey, result, receiptBacked);
    await logAction(scope, { ...input, metadata: { newMessageId: assistantMessageId, structureRepaired: validated.repaired } }, "regenerate_completed");
    return result;
  } catch (error) {
    await failReceipt(scope, idempotencyKey, { error: error instanceof Error ? error.message : "Regeneration failed" }, receiptBacked);
    throw error;
  }
}

async function fallbackFeedback(scope: any, source: any, rating: -1 | 1 | null) {
  const current = source?.metadata || {};
  const metadata = { ...current, userFeedback: rating, feedbackUpdatedAt: new Date().toISOString() };
  await messages.updateMetadata(scope, String(source.id), metadata);
  return rating === null ? null : { rating };
}

async function feedback(scope: any, input: any, action: MessageActionName) {
  const sessionId = requireString(input.sessionId, "sessionId");
  const resolved = await getSource(scope, sessionId, input.messageId, input.content);
  const messageId = String(resolved.source.id);
  input.messageId = messageId;
  const rating = action === "feedback_up" ? 1 : action === "feedback_down" ? -1 : null;
  let saved: any = null;
  try {
    saved = await actions.setFeedback(scope, {
      sessionId,
      messageId,
      rating,
      metadata: input.metadata || {},
    });
  } catch (error) {
    if (!isMissingActionStorage(error)) throw error;
    saved = await fallbackFeedback(scope, resolved.source, rating);
  }
  await logAction(scope, input, action);
  return { rating: saved?.rating ?? null };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const messageId = requireString(request.nextUrl.searchParams.get("messageId"), "messageId");
    try {
      const row = await actions.getFeedback(scope, messageId);
      return json({ ok: true, rating: row?.rating ?? null });
    } catch (error) {
      if (!isMissingActionStorage(error)) throw error;
      const sessionId = String(request.nextUrl.searchParams.get("sessionId") || "").trim();
      if (!sessionId) return json({ ok: true, rating: null });
      const resolved = await getSource(scope, sessionId, messageId);
      return json({ ok: true, rating: resolved.source?.metadata?.userFeedback ?? null });
    }
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Unable to load feedback" }, 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const input = await request.json().catch(() => ({}));
    const action = normalizeAction(input.action);
    if (!action || !MESSAGE_ACTIONS.has(action)) return json({ ok: false, error: "Unsupported message action." }, 400);
    input.action = action;

    if (action === "branch") return json({ ok: true, ...(await branch(scope, input)) });
    if (action === "regenerate") return json({ ok: true, ...(await regenerate(scope, request, input)) });
    if (action === "feedback_up" || action === "feedback_down" || action === "feedback_cleared") {
      return json({ ok: true, ...(await feedback(scope, input, action)) });
    }

    await logAction(scope, input, action);
    return json({ ok: true });
  } catch (error) {
    console.error("[streams-ai/message-actions] failed", error);
    const message = error instanceof Error ? error.message : "The message action could not be completed.";
    const code = /Source response|source user request/.test(message)
      ? "MESSAGE_NOT_FOUND"
      : /sessionId/.test(message)
        ? "SESSION_REQUIRED"
        : /already in progress/.test(message)
          ? "ACTION_IN_PROGRESS"
          : "MESSAGE_ACTION_FAILED";
    return json({ ok: false, error: "The message action could not be completed.", code }, 400);
  }
}
