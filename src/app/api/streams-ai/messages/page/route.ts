import { NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIMessagesRepository } from "@/lib/streams-ai/repositories/messages-repository";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";

const messages = new StreamsAIMessagesRepository();
const sessions = new StreamsAISessionsRepository();

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const sessionId = String(request.nextUrl.searchParams.get("sessionId") || "").trim();
    if (!sessionId) return Response.json({ ok: false, error: "sessionId is required" }, { status: 400 });
    const session = await sessions.get(scope, sessionId);
    if (!session) return Response.json({ ok: false, error: "Session not found" }, { status: 404 });

    const limit = Number(request.nextUrl.searchParams.get("limit") || 100);
    const before = request.nextUrl.searchParams.get("before");
    const page = await messages.listPage(scope, sessionId, { limit, before });
    return Response.json({ ok: true, sessionId, ...page });
  } catch (error) {
    console.error("[streams-ai/messages/page] failed", error);
    return Response.json({ ok: false, error: "Unable to load message history." }, { status: 400 });
  }
}
