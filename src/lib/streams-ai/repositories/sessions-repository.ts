import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "../server";
import type { StreamsAIScope } from "../auth";
import type { CreateSessionInput, UpdateSessionInput } from "./types";

const DEFAULT_SESSION_LIMIT = 100;
const MAX_SESSION_LIMIT = 200;

export class StreamsAISessionsRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  async list(scope: StreamsAIScope, limit = DEFAULT_SESSION_LIMIT) {
    const bounded = Math.max(1, Math.min(MAX_SESSION_LIMIT, Math.trunc(Number(limit) || DEFAULT_SESSION_LIMIT)));
    const { data, error } = await this.db()
      .from(streamsAITables.chatSessions)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("workspace_id", scope.workspaceId)
      .eq("module_id", scope.moduleId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(bounded);

    if (error) throw new Error(`Failed to list STREAMS AI sessions: ${error.message}`);
    return data || [];
  }

  async create(scope: StreamsAIScope, input: CreateSessionInput = {}) {
    const { data, error } = await this.db()
      .from(streamsAITables.chatSessions)
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        project_id: input.projectId ?? scope.defaultProjectId,
        workspace_id: scope.workspaceId,
        module_id: scope.moduleId,
        product_id: scope.productId,
        title: input.title?.trim() || "New STREAMS AI chat",
        metadata: input.metadata || {},
      })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create STREAMS AI session: ${error.message}`);
    return data;
  }

  async get(scope: StreamsAIScope, sessionId: string) {
    const { data, error } = await this.db()
      .from(streamsAITables.chatSessions)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", sessionId)
      .maybeSingle();

    if (error) throw new Error(`Failed to read STREAMS AI session: ${error.message}`);
    return data;
  }

  async update(scope: StreamsAIScope, sessionId: string, input: UpdateSessionInput) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof input.title === "string") patch.title = input.title.trim() || "New STREAMS AI chat";
    if (typeof input.status === "string") patch.status = input.status;
    if (input.metadata) patch.metadata = input.metadata;

    const { data, error } = await this.db()
      .from(streamsAITables.chatSessions)
      .update(patch)
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", sessionId)
      .select("*")
      .single();

    if (error) throw new Error(`Failed to update STREAMS AI session: ${error.message}`);
    return data;
  }
}
