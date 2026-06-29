export const runtime = "nodejs";

const events = new Map<string, unknown[]>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") || "agent-1";
  return Response.json({ ok: true, sessionId, events: events.get(sessionId) || [] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sessionId = body.sessionId || "agent-1";
  const current = events.get(sessionId) || [];
  const incoming = Array.isArray(body.events) ? body.events : body.event ? [body.event] : [];
  const next = [...current, ...incoming].slice(-120);
  events.set(sessionId, next);
  return Response.json({ ok: true, sessionId, stored: incoming.length, events: next });
}
