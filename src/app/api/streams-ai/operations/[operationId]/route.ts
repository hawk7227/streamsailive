import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { createStreamsAIServiceClient, streamsAISchema } from "@/lib/streams-ai/server";
import { streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ operationId: string }> }) {
  try {
    const scope = await requireStreamsAIScope(request);
    const { operationId } = await context.params;
    const db = streamsAISchema(createStreamsAIServiceClient());
    const { data: operation, error } = await db.from("streams_ai_operations").select("*").eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", operationId).maybeSingle();
    if (error) throw error;
    if (!operation) return streamsAIJson({ ok: false, error: "Operation not found" }, 404);
    const { data: events, error: eventsError } = await db.from("streams_ai_operation_events").select("*").eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("operation_id", operationId).order("created_at", { ascending: true });
    if (eventsError) throw eventsError;
    return streamsAIJson({ ok: true, operation, events: events || [] });
  } catch (error) { return streamsAIError(error); }
}
