import { readUniversalRuntimeEvents, recordUniversalRuntimeEvent, summarizeRuntimeEvents } from "@/lib/streams-ai/runtime-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") || "agent-1";
  const events = await readUniversalRuntimeEvents(sessionId);
  return Response.json({ ok: true, sessionId, summary: summarizeRuntimeEvents(events as Record<string, unknown>[]), events });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const events = Array.isArray(body.events) ? body.events : body.event ? [body.event] : [body];
  let stored = 0;
  const sessionId = String(body.sessionId || events[0]?.sessionId || "agent-1");

  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    await recordUniversalRuntimeEvent({
      ...event,
      sessionId: String(event.sessionId || sessionId),
      phase: String(event.phase || event.type || "runtime.event"),
      message: String(event.message || event.reason || "Runtime event"),
      source: String(event.source || "streams-runtime-api"),
    });
    stored += 1;
  }

  const current = await readUniversalRuntimeEvents(sessionId);
  return Response.json({ ok: true, sessionId, stored, summary: summarizeRuntimeEvents(current as Record<string, unknown>[]), events: current });
}
