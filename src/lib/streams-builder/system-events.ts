import { getSupabaseServiceClient } from "@/lib/supabase/service";

export type BuilderSystemEvent = {
  sessionId?: string;
  phase?: string;
  message?: string;
  source?: string;
  severity?: "info" | "warning" | "error";
  repo?: string;
  branch?: string;
  filePath?: string;
  route?: string;
  status?: string;
  previewId?: string;
  previewUrl?: string;
  error?: string;
  logs?: string[];
  metadata?: Record<string, unknown>;
};

const memoryEvents = new Map<string, BuilderSystemEvent[]>();
const MAX_EVENTS = 200;

export function normalizeBuilderSystemEvent(input: BuilderSystemEvent): BuilderSystemEvent {
  const message = String(input.message || input.error || "Builder system event").trim();
  return {
    ...input,
    sessionId: input.sessionId || "agent-1",
    phase: input.phase || "system-event",
    source: input.source || "streams-builder-backend",
    severity: input.severity || (input.error ? "error" : "info"),
    message,
    metadata: { ...(input.metadata || {}), at: new Date().toISOString() },
  };
}

export async function recordBuilderSystemEvent(input: BuilderSystemEvent) {
  const event = normalizeBuilderSystemEvent(input);
  const key = event.sessionId || "agent-1";
  const current = memoryEvents.get(key) || [];
  memoryEvents.set(key, [...current, event].slice(-MAX_EVENTS));

  try {
    const supabase = getSupabaseServiceClient();
    await supabase.from("builder_context_events").insert({
      session_id: key,
      phase: event.phase,
      source: event.source,
      severity: event.severity,
      message: event.message,
      repo: event.repo || null,
      branch: event.branch || null,
      file_path: event.filePath || null,
      route: event.route || null,
      status: event.status || null,
      preview_id: event.previewId || null,
      preview_url: event.previewUrl || null,
      logs: event.logs || [],
      metadata: event.metadata || {},
    });
  } catch {
    // Supabase table/env is optional. In-memory events still preserve same-request awareness.
  }

  return { ok: true, event };
}

export async function readBuilderSystemEvents(sessionId = "agent-1") {
  try {
    const supabase = getSupabaseServiceClient();
    const { data } = await supabase
      .from("builder_context_events")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(MAX_EVENTS);
    if (Array.isArray(data)) return data.reverse();
  } catch {
    // fall back below
  }
  return memoryEvents.get(sessionId) || [];
}
