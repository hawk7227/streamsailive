import { createStreamsAIServiceClient, streamsAISchema } from "../server";
import type { StreamsAIScope } from "../auth";
import type { CreateMessageInput } from "./types";

export class StreamsAIMessagesRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  async list(scope: StreamsAIScope, sessionId: string) {
    const { data, error } = await this.db()
      .from("chat_messages")
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(`Failed to list STREAMS AI messages: ${error.message}`);
    return data || [];
  }

  async create(scope: StreamsAIScope, input: CreateMessageInput) {
    const db = this.db();

    const { data: session, error: sessionError } = await db
      .from("chat_sessions")
      .select("id, project_id")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", input.sessionId)
      .maybeSingle();

    if (sessionError) throw new Error(`Failed to verify STREAMS AI session: ${sessionError.message}`);
    if (!session?.id) throw new Error("STREAMS AI session not found or not owned by user.");

    const { data, error } = await db
      .from("chat_messages")
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        project_id: session.project_id,
        session_id: input.sessionId,
        role: input.role,
        content: input.content || "",
        status: input.status || "complete",
        metadata: input.metadata || {},
      })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create STREAMS AI message: ${error.message}`);

    await db
      .from("chat_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", input.sessionId);

    return data;
  }
}
