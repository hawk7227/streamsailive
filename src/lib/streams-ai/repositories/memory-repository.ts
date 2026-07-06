import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "../server";
import type { StreamsAIScope } from "../auth";

export type StreamsAIMemoryInput = {
  projectId?: string | null;
  sessionId?: string | null;
  sourceMessageId?: string | null;
  scope?: "user" | "project" | "session" | "system" | "file" | "codebase";
  memoryType?: string;
  title?: string;
  content: string;
  summary?: string;
  keywords?: string[];
  confidenceScore?: number;
  importanceScore?: number;
  recencyScore?: number;
  isUserVisible?: boolean;
  isUserEditable?: boolean;
  isSensitive?: boolean;
  metadata?: Record<string, unknown>;
};

export type StreamsAIMemorySearch = {
  query?: string;
  projectId?: string | null;
  scopes?: string[];
  memoryTypes?: string[];
  limit?: number;
};

function cleanKeywords(values: unknown[] = []) {
  return Array.from(new Set(values.map((value) => String(value || "").toLowerCase().trim()).filter((value) => value.length >= 2))).slice(0, 32);
}

function keywordsFromText(text = "") {
  const stop = new Set(["the", "and", "for", "that", "this", "with", "from", "you", "your", "are", "was", "were", "have", "has", "not", "but", "can", "will", "should", "into", "about"]);
  return cleanKeywords(String(text).toLowerCase().match(/[a-z0-9_/-]{3,}/g)?.filter((word) => !stop.has(word)) || []);
}

function scoreMemory(row: any, queryKeywords: string[]) {
  const content = `${row.title || ""} ${row.content || ""} ${row.summary || ""}`.toLowerCase();
  const rowKeywords = Array.isArray(row.keywords) ? row.keywords.map((x: unknown) => String(x).toLowerCase()) : [];
  const matches = queryKeywords.reduce((sum, keyword) => sum + (content.includes(keyword) || rowKeywords.includes(keyword) ? 1 : 0), 0);
  const importance = Number(row.importance_score || 0.5);
  const confidence = Number(row.confidence_score || 0.75);
  const used = Math.min(Number(row.use_count || 0), 10) / 20;
  return matches * 2 + importance + confidence + used;
}

export class StreamsAIMemoryRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  async create(scope: StreamsAIScope, input: StreamsAIMemoryInput) {
    const content = String(input.content || "").trim();
    if (!content) return null;
    const keywords = cleanKeywords([...(input.keywords || []), ...keywordsFromText(`${input.title || ""} ${content}`)]);
    const { data, error } = await this.db()
      .from(streamsAITables.memories)
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        project_id: input.projectId || null,
        session_id: input.sessionId || null,
        source_message_id: input.sourceMessageId || null,
        scope: input.scope || "user",
        memory_type: input.memoryType || "fact",
        title: input.title || "",
        content,
        summary: input.summary || "",
        keywords,
        confidence_score: input.confidenceScore ?? 0.75,
        importance_score: input.importanceScore ?? 0.5,
        recency_score: input.recencyScore ?? 1,
        is_user_visible: input.isUserVisible ?? true,
        is_user_editable: input.isUserEditable ?? true,
        is_sensitive: input.isSensitive ?? false,
        metadata: input.metadata || {},
      })
      .select("*")
      .single();
    if (error) throw new Error(`Failed to create STREAMS AI memory: ${error.message}`);
    return data;
  }

  async createChunk(scope: StreamsAIScope, input: { memoryId?: string | null; projectId?: string | null; sourceTable?: string | null; sourceId?: string | null; chunkIndex?: number; content: string; keywords?: string[]; metadata?: Record<string, unknown> }) {
    const content = String(input.content || "").trim();
    if (!content) return null;
    const { data, error } = await this.db()
      .from(streamsAITables.memoryChunks)
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        project_id: input.projectId || null,
        memory_id: input.memoryId || null,
        source_table: input.sourceTable || null,
        source_id: input.sourceId || null,
        chunk_index: input.chunkIndex || 0,
        content,
        keywords: cleanKeywords([...(input.keywords || []), ...keywordsFromText(content)]),
        metadata: input.metadata || {},
      })
      .select("*")
      .single();
    if (error) throw new Error(`Failed to create STREAMS AI memory chunk: ${error.message}`);
    return data;
  }

  async search(scope: StreamsAIScope, input: StreamsAIMemorySearch = {}) {
    const queryKeywords = keywordsFromText(input.query || "");
    let request = this.db()
      .from(streamsAITables.memories)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .is("expires_at", null)
      .order("updated_at", { ascending: false })
      .limit(Math.max(1, Math.min(input.limit || 18, 50)) * 4);

    if (input.projectId) request = request.or(`project_id.eq.${input.projectId},project_id.is.null`);
    if (input.scopes?.length) request = request.in("scope", input.scopes);
    if (input.memoryTypes?.length) request = request.in("memory_type", input.memoryTypes);

    const { data, error } = await request;
    if (error) throw new Error(`Failed to search STREAMS AI memories: ${error.message}`);
    const rows = Array.isArray(data) ? data : [];
    const ranked = rows
      .map((row) => ({ row, score: scoreMemory(row, queryKeywords) }))
      .filter((item) => !queryKeywords.length || item.score > 0.9)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(input.limit || 12, 30)))
      .map((item) => item.row);

    if (ranked.length) {
      await this.db()
        .from(streamsAITables.memories)
        .update({ last_used_at: new Date().toISOString() })
        .in("id", ranked.map((row: any) => row.id));
    }

    return ranked;
  }

  async listVisible(scope: StreamsAIScope, limit = 100) {
    const { data, error } = await this.db()
      .from(streamsAITables.memories)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("is_user_visible", true)
      .order("updated_at", { ascending: false })
      .limit(Math.max(1, Math.min(limit, 250)));
    if (error) throw new Error(`Failed to list STREAMS AI memories: ${error.message}`);
    return data || [];
  }
}

export function deriveMemoryKeywords(text = "") {
  return keywordsFromText(text);
}
