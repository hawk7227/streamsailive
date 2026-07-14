import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "../server";
import type { StreamsAIScope } from "../auth";
import type { CreateMessageInput } from "./types";

type IdempotentMessageInput = CreateMessageInput & {
  idempotencyKey?: string | null;
  turnId?: string | null;
};

type MessagePageOptions = {
  limit?: number;
  before?: string | null;
};

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;

function boundedLimit(value?: number) {
  const numeric = Number(value || DEFAULT_PAGE_SIZE);
  if (!Number.isFinite(numeric)) return DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.trunc(numeric)));
}

export class StreamsAIMessagesRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  async listPage(scope: StreamsAIScope, sessionId: string, options: MessagePageOptions = {}) {
    const limit = boundedLimit(options.limit);
    let query = this.db()
      .from(streamsAITables.chatMessages)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (options.before) query = query.lt("created_at", options.before);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list STREAMS AI messages: ${error.message}`);

    const rows = data || [];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const nextCursor = hasMore ? String(page[page.length - 1]?.created_at || "") : null;
    return { messages: page.reverse(), nextCursor, hasMore };
  }

  async list(scope: StreamsAIScope, sessionId: string, options: MessagePageOptions = {}) {
    const page = await this.listPage(scope, sessionId, { limit: options.limit || MAX_PAGE_SIZE, before: options.before });
    return page.messages;
  }

  async listAll(scope: StreamsAIScope, sessionId: string, maximum = 10000) {
    const result: any[] = [];
    let before: string | null = null;
    while (result.length < maximum) {
      const page = await this.listPage(scope, sessionId, { limit: MAX_PAGE_SIZE, before });
      result.unshift(...page.messages);
      if (!page.hasMore || !page.nextCursor) break;
      before = page.nextCursor;
    }
    if (result.length >= maximum) throw new Error("Conversation exceeds the supported branch-copy limit.");
    return result;
  }

  async findByIdempotencyKey(scope: StreamsAIScope, idempotencyKey: string) {
    if (!idempotencyKey) return null;
    const { data, error } = await this.db()
      .from(streamsAITables.chatMessages)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (error) throw new Error(`Failed to read STREAMS AI message idempotency record: ${error.message}`);
    return data || null;
  }

  async create(scope: StreamsAIScope, input: IdempotentMessageInput) {
    const db = this.db();
    const idempotencyKey = String(input.idempotencyKey || "").trim() || null;

    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKey(scope, idempotencyKey);
      if (existing) return existing;
    }

    const { data: session, error: sessionError } = await db
      .from(streamsAITables.chatSessions)
      .select("id, project_id")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", input.sessionId)
      .maybeSingle();

    if (sessionError) throw new Error(`Failed to verify STREAMS AI session: ${sessionError.message}`);
    if (!session?.id) throw new Error("STREAMS AI session not found or not owned by user.");

    const row = {
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      project_id: session.project_id,
      session_id: input.sessionId,
      role: input.role,
      content: input.content || "",
      status: input.status || "complete",
      metadata: input.metadata || {},
      turn_id: input.turnId || null,
      idempotency_key: idempotencyKey,
    };

    const query = idempotencyKey
      ? db.from(streamsAITables.chatMessages).upsert(row, { onConflict: "tenant_id,user_id,idempotency_key", ignoreDuplicates: true })
      : db.from(streamsAITables.chatMessages).insert(row);

    const { data, error } = await query.select("*").maybeSingle();
    if (error) throw new Error(`Failed to create STREAMS AI message: ${error.message}`);

    const persisted = data || (idempotencyKey ? await this.findByIdempotencyKey(scope, idempotencyKey) : null);
    if (!persisted) throw new Error("STREAMS AI message persistence returned no record.");

    await db
      .from(streamsAITables.chatSessions)
      .update({ updated_at: new Date().toISOString() })
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", input.sessionId);

    return persisted;
  }

  async updateMetadata(scope: StreamsAIScope, id: string, metadata: Record<string, any>) {
    const { data, error } = await this.db()
      .from(streamsAITables.chatMessages)
      .update({ metadata })
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to update STREAMS AI message metadata: ${error.message}`);
    return data;
  }
}
