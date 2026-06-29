import { readBuilderSystemEvents, recordBuilderSystemEvent } from "@/lib/streams-builder/system-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") || "agent-1";
  const events = await readBuilderSystemEvents(sessionId);
  return Response.json({ ok: true, sessionId, events });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sessionId = String(body.sessionId || "agent-1");
  const incoming = Array.isArray(body.events) ? body.events : body.event ? [body.event] : [];
  let stored = 0;
  for (const raw of incoming) {
    const item = raw || {};
    await recordBuilderSystemEvent({
      sessionId,
      phase: String(item.phase || "builder-event"),
      message: String(item.message || "Builder event"),
      source: String(item.source || "streams-builder-ui"),
      severity: item.severity === "error" ? "error" : "info",
      repo: String(item.repo || item.repository || ""),
      branch: String(item.branch || ""),
      filePath: String(item.filePath || item.path || ""),
      route: String(item.route || ""),
      status: String(item.status || item.patchState || ""),
      previewId: String(item.previewId || ""),
      previewUrl: String(item.previewUrl || ""),
    });
    stored += 1;
  }
  const events = await readBuilderSystemEvents(sessionId);
  return Response.json({ ok: true, sessionId, stored, events });
}
