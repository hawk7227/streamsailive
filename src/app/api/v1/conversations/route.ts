import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";
import { sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "@/lib/streams-ai/protected-reasoning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessions = new StreamsAISessionsRepository();

function failure(error: unknown, status = 500) {
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown conversations error" }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const conversationId = request.nextUrl.searchParams.get("conversationId");
    if (conversationId) {
      const conversation = await sessions.get(scope, conversationId);
      if (!conversation) return failure(new Error("Conversation not found"), 404);
      return NextResponse.json({ ok: true, apiVersion: "v1", conversation });
    }
    const limit = Number(request.nextUrl.searchParams.get("limit") || 100);
    return NextResponse.json({ ok: true, apiVersion: "v1", conversations: await sessions.list(scope, limit), nextCursor: null });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = sanitizeStreamsAIPayload(await request.json().catch(() => ({}))) as {
      projectId?: string | null;
      title?: string;
      metadata?: Record<string, unknown>;
    };
    const conversation = await sessions.create(scope, {
      projectId: body.projectId,
      title: sanitizeStreamsAIText(String(body.title || "New STREAMS AI chat"), 300),
      metadata: body.metadata || {},
    });
    return NextResponse.json({ ok: true, apiVersion: "v1", conversation }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = sanitizeStreamsAIPayload(await request.json().catch(() => ({}))) as {
      conversationId?: string;
      title?: string;
      status?: string;
      metadata?: Record<string, unknown>;
    };
    if (!body.conversationId) return failure(new Error("conversationId is required"), 400);
    const conversation = await sessions.update(scope, body.conversationId, {
      title: typeof body.title === "string" ? sanitizeStreamsAIText(body.title, 300) : undefined,
      status: body.status,
      metadata: body.metadata,
    });
    return NextResponse.json({ ok: true, apiVersion: "v1", conversation });
  } catch (error) {
    return failure(error);
  }
}
