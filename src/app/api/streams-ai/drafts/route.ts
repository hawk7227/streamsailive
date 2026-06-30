import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { streamsAIError } from "@/lib/streams-ai/api";
import { createStreamsAIServiceClient, streamsAISchema } from "@/lib/streams-ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  return streamsAISchema(createStreamsAIServiceClient());
}

function clean(value: unknown, max = 12000) {
  return String(value || "").slice(0, max);
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const sessionId = request.nextUrl.searchParams.get("sessionId") || "new";
    const { data, error } = await db()
      .from("streams_ai_thread_drafts")
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error) throw error;
    return Response.json({ ok: true, sessionId, draft: data?.draft || "", row: data || null });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({}));
    const sessionId = clean(body.sessionId || "new", 200) || "new";
    const draft = clean(body.draft || body.content || "");
    const now = new Date().toISOString();

    if (!draft.trim()) {
      await db()
        .from("streams_ai_thread_drafts")
        .delete()
        .eq("tenant_id", scope.tenantId)
        .eq("user_id", scope.userId)
        .eq("session_id", sessionId);
      return Response.json({ ok: true, sessionId, draft: "", deleted: true });
    }

    const { data, error } = await db()
      .from("streams_ai_thread_drafts")
      .upsert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        project_id: scope.defaultProjectId,
        session_id: sessionId,
        draft,
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
        updated_at: now,
      }, { onConflict: "tenant_id,user_id,session_id" })
      .select("*")
      .single();
    if (error) throw error;
    return Response.json({ ok: true, sessionId, draft: data?.draft || draft, row: data });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const sessionId = request.nextUrl.searchParams.get("sessionId") || "new";
    await db()
      .from("streams_ai_thread_drafts")
      .delete()
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("session_id", sessionId);
    return Response.json({ ok: true, sessionId, deleted: true });
  } catch (error) {
    return streamsAIError(error);
  }
}
