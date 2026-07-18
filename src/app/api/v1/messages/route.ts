import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIMessagesRepository } from "@/lib/streams-ai/repositories/messages-repository";
import { assertNoProtectedFields, sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "@/lib/streams-ai/protected-reasoning";
import type { CreateMessageInput } from "@/lib/streams-ai/repositories/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const messages = new StreamsAIMessagesRepository();
const MESSAGE_ROLES: CreateMessageInput["role"][] = ["user", "assistant", "system", "tool"];

function failure(error: unknown, status = 500) {
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown messages error" }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const sessionId = request.nextUrl.searchParams.get("sessionId") || "";
    if (!sessionId) return failure(new Error("sessionId is required"), 400);
    const limit = Number(request.nextUrl.searchParams.get("limit") || 100);
    const before = request.nextUrl.searchParams.get("before");
    const page = await messages.listPage(scope, sessionId, { limit, before });
    return NextResponse.json({ ok: true, apiVersion: "v1", sessionId, ...page });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = sanitizeStreamsAIPayload(await request.json().catch(() => ({}))) as {
      sessionId?: string;
      role?: string;
      content?: string;
      status?: string;
      metadata?: Record<string, unknown>;
      idempotencyKey?: string | null;
      turnId?: string | null;
    };
    assertNoProtectedFields(body);
    if (!body.sessionId || !body.role) return failure(new Error("sessionId and role are required"), 400);
    if (!MESSAGE_ROLES.includes(body.role as CreateMessageInput["role"])) {
      return failure(new Error("role must be user, assistant, system, or tool"), 400);
    }
    const message = await messages.create(scope, {
      sessionId: body.sessionId,
      role: body.role as CreateMessageInput["role"],
      content: sanitizeStreamsAIText(body.content || ""),
      status: body.status,
      metadata: body.metadata || {},
      idempotencyKey: body.idempotencyKey,
      turnId: body.turnId,
    });
    return NextResponse.json({ ok: true, apiVersion: "v1", message }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = sanitizeStreamsAIPayload(await request.json().catch(() => ({}))) as {
      messageId?: string;
      content?: string;
      metadata?: Record<string, unknown>;
    };
    assertNoProtectedFields(body);
    if (!body.messageId) return failure(new Error("messageId is required"), 400);
    const message = typeof body.content === "string"
      ? await messages.updateContent(scope, body.messageId, body.content, body.metadata || {})
      : await messages.updateMetadata(scope, body.messageId, body.metadata || {});
    return NextResponse.json({ ok: true, apiVersion: "v1", message });
  } catch (error) {
    return failure(error);
  }
}
