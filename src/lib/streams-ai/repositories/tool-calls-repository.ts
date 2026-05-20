import { createStreamsAIServiceClient, streamsAISchema } from "../server";
import type { StreamsAIScope } from "../auth";

export type CreateToolCallInput = {
  sessionId: string;
  messageId?: string | null;
  projectId?: string | null;
  toolName: string;
  productId?: string | null;
  inputJson?: Record<string, unknown>;
  status?: string;
};

export class StreamsAIToolCallsRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  async create(scope: StreamsAIScope, input: CreateToolCallInput) {
    const { data, error } = await this.db()
      .from("chat_tool_calls")
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        project_id: input.projectId ?? scope.defaultProjectId,
        session_id: input.sessionId,
        message_id: input.messageId ?? null,
        tool_name: input.toolName,
        product_id: input.productId ?? null,
        status: input.status || "queued",
        input_json: input.inputJson || {},
      })
      .select("*")
      .single();

    if (error) throw new Error(`Failed to create STREAMS AI tool call: ${error.message}`);
    return data;
  }

  async list(scope: StreamsAIScope, sessionId: string) {
    const { data, error } = await this.db()
      .from("chat_tool_calls")
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to list STREAMS AI tool calls: ${error.message}`);
    return data || [];
  }
}
