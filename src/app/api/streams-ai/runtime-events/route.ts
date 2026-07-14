import { NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";
import { readUniversalRuntimeEvents, recordUniversalRuntimeEvent, summarizeRuntimeEvents } from "@/lib/streams-ai/runtime-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessions = new StreamsAISessionsRepository();

async function requireOwnedSession(request: NextRequest, sessionId: string) {
  const scope = await requireStreamsAIScope(request);
  if (!sessionId) throw new Error("sessionId is required");
  const session = await sessions.get(scope, sessionId);
  if (!session) throw new Error("Session not found");
  return scope;
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId") || "";
    await requireOwnedSession(request, sessionId);
    const events = await readUniversalRuntimeEvents(sessionId);
    return Response.json({ ok: true, sessionId, summary: summarizeRuntimeEvents(events as Record<string, unknown>[]), events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Runtime events request failed";
    return Response.json({ ok: false, error: message }, { status: /not found/i.test(message) ? 404 : /required/i.test(message) ? 400 : 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const events = Array.isArray(body.events) ? body.events : body.event ? [body.event] : [body];
    const sessionId = String(body.sessionId || events[0]?.sessionId || "").trim();
    const scope = await requireOwnedSession(request, sessionId);
    let stored = 0;

    for (const event of events) {
      if (!event || typeof event !== "object") continue;
      const eventSessionId = String(event.sessionId || sessionId);
      if (eventSessionId !== sessionId) throw new Error("Cross-session runtime events are not allowed");
      await recordUniversalRuntimeEvent({
        ...event,
        sessionId,
        phase: String(event.phase || event.type || "runtime.event"),
        message: String(event.message || event.reason || "Runtime event"),
        source: String(event.source || "streams-runtime-api"),
        metadata: {
          ...(event.metadata && typeof event.metadata === "object" ? event.metadata : {}),
          tenantId: scope.tenantId,
          userId: scope.userId,
          authenticated: true,
        },
      });
      stored += 1;
    }

    const current = await readUniversalRuntimeEvents(sessionId);
    return Response.json({ ok: true, sessionId, stored, summary: summarizeRuntimeEvents(current as Record<string, unknown>[]), events: current });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Runtime events request failed";
    return Response.json({ ok: false, error: message }, { status: /not found/i.test(message) ? 404 : /required|cross-session/i.test(message) ? 400 : 401 });
  }
}
