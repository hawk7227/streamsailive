import { createStreamsAIServiceClient, streamsAISchema } from "@/lib/streams-ai/server";
import type { StreamsAIScope } from "@/lib/streams-ai/auth";

export type StreamsMemoryScope = "user" | "project" | "session" | "org";
export type StreamsMemoryType = "preference" | "fact" | "rule" | "task" | "decision" | "warning" | "workflow" | "style" | "summary";

export type StreamsMemoryInput = {
  scope: StreamsMemoryScope;
  memoryType: StreamsMemoryType;
  content: string;
  summary?: string;
  projectId?: string | null;
  sessionId?: string | null;
  sourceMessageId?: string | null;
  sourceEventId?: string | null;
  confidence?: number;
  importance?: number;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
};

const memoryByUser = new Map<string, Record<string, unknown>[]>();
const summaryBySession = new Map<string, string>();
const MAX_MEMORY = 500;
const SECRET_KEY = /api[_-]?key|secret|token|password|authorization|bearer|credential/i;

function db() {
  return streamsAISchema(createStreamsAIServiceClient());
}

function now() {
  return new Date().toISOString();
}

function cleanText(value: unknown, max = 12000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 80).map(sanitize);
  if (!value || typeof value !== "object") return typeof value === "string" ? value.slice(0, 12000) : value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) continue;
    output[key] = sanitize(item);
  }
  return output;
}

function key(scope: StreamsAIScope) {
  return `${scope.tenantId}:${scope.userId}`;
}

function scoreMemory(memory: Record<string, unknown>, query: string) {
  const haystack = `${memory.content || ""} ${memory.summary || ""} ${memory.memory_type || memory.memoryType || ""}`.toLowerCase();
  const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2).slice(0, 30);
  const hits = terms.reduce((count, term) => count + (haystack.includes(term) ? 1 : 0), 0);
  const importance = Number(memory.importance || 0.5);
  return hits + importance;
}

export async function rememberStreamsMemory(scope: StreamsAIScope, input: StreamsMemoryInput) {
  const content = cleanText(input.content);
  if (!content) return { ok: false, error: "Memory content is required." };
  const row = {
    tenant_id: scope.tenantId,
    user_id: scope.userId,
    project_id: input.projectId ?? (input.scope === "project" ? scope.defaultProjectId : null),
    session_id: input.sessionId || null,
    scope: input.scope,
    memory_type: input.memoryType,
    content,
    summary: cleanText(input.summary || content, 2000),
    source_message_id: input.sourceMessageId || null,
    source_event_id: input.sourceEventId || null,
    confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0.7))),
    importance: Math.max(0, Math.min(1, Number(input.importance ?? 0.5))),
    expires_at: input.expiresAt || null,
    is_active: true,
    metadata: sanitize(input.metadata || {}),
    created_at: now(),
    updated_at: now(),
  };

  try {
    const { data, error } = await db().from("streams_ai_memories").insert(row).select("*").single();
    if (error) throw error;
    await logMemoryAccess(scope, "remember", data?.id || null, { scope: input.scope, memoryType: input.memoryType });
    return { ok: true, memory: data };
  } catch {
    const cacheKey = key(scope);
    const current = memoryByUser.get(cacheKey) || [];
    const memory = { id: `mem_${Date.now()}`, ...row };
    memoryByUser.set(cacheKey, [...current, memory].slice(-MAX_MEMORY));
    return { ok: true, memory, fallback: "memory-cache" };
  }
}

export async function listStreamsMemories(scope: StreamsAIScope, query = "", options: { sessionId?: string | null; projectId?: string | null; limit?: number; scopes?: StreamsMemoryScope[] } = {}) {
  const limit = Math.max(1, Math.min(50, options.limit || 12));
  try {
    let request = db()
      .from("streams_ai_memories")
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(200);
    const { data, error } = await request;
    if (error) throw error;
    const filtered = (data || []).filter((memory) => {
      if (options.scopes?.length && !options.scopes.includes(memory.scope)) return false;
      if (memory.scope === "session" && options.sessionId && memory.session_id !== options.sessionId) return false;
      if (memory.scope === "project" && options.projectId && memory.project_id !== options.projectId) return false;
      return true;
    });
    const ranked = filtered.sort((a, b) => scoreMemory(b, query) - scoreMemory(a, query)).slice(0, limit);
    await logMemoryAccess(scope, "read", null, { query, count: ranked.length });
    return { ok: true, memories: ranked };
  } catch {
    const cached = memoryByUser.get(key(scope)) || [];
    const ranked = cached.sort((a, b) => scoreMemory(b, query) - scoreMemory(a, query)).slice(0, limit);
    return { ok: true, memories: ranked, fallback: "memory-cache" };
  }
}

export async function forgetStreamsMemory(scope: StreamsAIScope, memoryId?: string, query?: string) {
  if (!memoryId && !query) return { ok: false, error: "memoryId or query is required." };
  try {
    let request = db().from("streams_ai_memories").update({ is_active: false, updated_at: now() }).eq("tenant_id", scope.tenantId).eq("user_id", scope.userId);
    if (memoryId) request = request.eq("id", memoryId);
    else request = request.ilike("content", `%${String(query).slice(0, 200)}%`);
    const { data, error } = await request.select("id");
    if (error) throw error;
    await logMemoryAccess(scope, "forget", memoryId || null, { query, count: data?.length || 0 });
    return { ok: true, forgotten: data?.length || 0 };
  } catch {
    const cacheKey = key(scope);
    const current = memoryByUser.get(cacheKey) || [];
    const next = current.filter((memory) => memoryId ? memory.id !== memoryId : !String(memory.content || "").toLowerCase().includes(String(query || "").toLowerCase()));
    memoryByUser.set(cacheKey, next);
    return { ok: true, forgotten: current.length - next.length, fallback: "memory-cache" };
  }
}

export async function readSessionSummary(scope: StreamsAIScope, sessionId: string) {
  try {
    const { data, error } = await db()
      .from("streams_ai_session_summaries")
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error) throw error;
    return data?.summary || "";
  } catch {
    return summaryBySession.get(`${key(scope)}:${sessionId}`) || "";
  }
}

export async function writeSessionSummary(scope: StreamsAIScope, sessionId: string, summary: string, metadata: Record<string, unknown> = {}) {
  const cleanSummary = cleanText(summary, 8000);
  if (!cleanSummary) return { ok: false, error: "Summary is required." };
  try {
    const { data, error } = await db().from("streams_ai_session_summaries").upsert({
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      project_id: scope.defaultProjectId,
      session_id: sessionId,
      summary: cleanSummary,
      metadata: sanitize(metadata),
      updated_at: now(),
    }, { onConflict: "tenant_id,user_id,session_id" }).select("*").single();
    if (error) throw error;
    return { ok: true, summary: data };
  } catch {
    summaryBySession.set(`${key(scope)}:${sessionId}`, cleanSummary);
    return { ok: true, summary: cleanSummary, fallback: "summary-cache" };
  }
}

export async function maybeExtractMemoryFromTurn(scope: StreamsAIScope, sessionId: string, userText: string) {
  const text = cleanText(userText, 2000);
  if (!text) return null;
  const rememberMatch = text.match(/\bremember\b[\s:,-]*(.+)$/i);
  const dontRemember = /don't remember|do not remember|dont remember|forget this|temporary/i.test(text);
  if (dontRemember) return null;
  if (rememberMatch?.[1]) {
    return rememberStreamsMemory(scope, { scope: "user", memoryType: "fact", content: rememberMatch[1], summary: rememberMatch[1], sessionId, importance: 0.8, confidence: 0.8, metadata: { source: "explicit-remember-command" } });
  }
  if (/do not touch|don't touch|locked|always|never|prefer|my style|my rule/i.test(text)) {
    return rememberStreamsMemory(scope, { scope: "user", memoryType: /prefer|style/i.test(text) ? "preference" : "rule", content: text, summary: text, sessionId, importance: 0.7, confidence: 0.55, metadata: { source: "auto-durable-instruction" } });
  }
  return null;
}

async function logMemoryAccess(scope: StreamsAIScope, action: string, memoryId: string | null, metadata: Record<string, unknown>) {
  try {
    await db().from("streams_ai_memory_access_log").insert({
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      memory_id: memoryId,
      action,
      metadata: sanitize(metadata),
      created_at: now(),
    });
  } catch {
    // Optional table; memory still functions without audit persistence.
  }
}

export function summarizeMemoriesForPrompt(memories: Record<string, unknown>[]) {
  if (!memories.length) return "No relevant durable memories retrieved.";
  return memories.map((memory, index) => `${index + 1}. [${memory.scope || "memory"}/${memory.memory_type || memory.memoryType || "fact"}] ${memory.summary || memory.content}`).join("\n");
}
