export async function recordBuilderSystemEvent(event: { sessionId?: string; phase?: string; message?: string; source?: string; severity?: string }) {
  return { ok: true, event };
}
