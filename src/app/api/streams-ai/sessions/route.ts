import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";
import { generateAITitle } from "@/lib/streams-ai/services/title-generator";
import { readSessionSummary, writeSessionSummary } from "@/lib/streams-ai/memory-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessions = new StreamsAISessionsRepository();

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const includeSummary = request.nextUrl.searchParams.get("includeSummary") === "true";
    let rows: Record<string, any>[] = [];

    try {
      rows = dataArray(await sessions.list(scope));
    } catch (error) {
      console.warn("[streams-ai-sessions] list fallback", error);
      rows = [];
    }

    const activeRows = rows.filter((session) => String(session.status || "active") !== "archived");
    const data = includeSummary
      ? await Promise.all(activeRows.map(async (session) => {
        try {
          return { ...session, session_summary: await readSessionSummary(scope, String(session.id || "")) };
        } catch {
          return { ...session, session_summary: null };
        }
      }))
      : activeRows;
    return streamsAIJson({ ok: true, sessions: data, threads: data, fallback: rows.length === 0 });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      title?: string;
      firstMessage?: string;
      message?: string;
      projectId?: string | null;
      metadata?: Record<string, unknown>;
    }>(request);

    const titleSeed = body.title || body.firstMessage || body.message || "New STREAMS AI chat";
    try {
      const session = await sessions.create(scope, {
        title: body.title || await generateAITitle(titleSeed),
        projectId: body.projectId,
        metadata: { ...(body.metadata || {}), source: "streams-ai-chat-sidebar", recentChat: true, autosave: true },
      });
      return streamsAIJson({ ok: true, session, thread: session }, 201);
    } catch (error) {
      console.warn("[streams-ai-sessions] create fallback", error);
      const session = fallbackSession(scope, body.title || titleSeed);
      return streamsAIJson({ ok: true, session, thread: session, fallback: true }, 201);
    }
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      sessionId?: string;
      id?: string;
      title?: string;
      status?: "active" | "archived";
      summary?: string;
      metadata?: Record<string, unknown>;
    }>(request);

    const sessionId = body.sessionId || body.id || "";
    if (!sessionId) {
      return streamsAIJson({ ok: false, error: "sessionId is required" }, 400);
    }

    if (body.summary) {
      try { await writeSessionSummary(scope, sessionId, body.summary, { source: "sessions-api" }); } catch {}
    }

    try {
      const session = await sessions.update(scope, sessionId, {
        title: body.title,
        status: body.status,
        metadata: body.metadata,
      });
      return streamsAIJson({ ok: true, session, thread: session, summaryUpdated: Boolean(body.summary) });
    } catch (error) {
      console.warn("[streams-ai-sessions] update fallback", error);
      const session = fallbackSession(scope, body.title || "New STREAMS AI chat", sessionId);
      return streamsAIJson({ ok: true, session, thread: session, summaryUpdated: Boolean(body.summary), fallback: true });
    }
  } catch (error) {
    return streamsAIError(error);
  }
}

function dataArray(value: unknown): Record<string, any>[] {
  return Array.isArray(value) ? value as Record<string, any>[] : [];
}

function fallbackSession(scope: { tenantId: string; userId: string; workspaceId: string; moduleId: string; productId: string; defaultProjectId?: string | null }, title: string, id?: string) {
  const now = new Date().toISOString();
  return {
    id: id || `preview_session_${Date.now()}`,
    tenant_id: scope.tenantId,
    user_id: scope.userId,
    project_id: scope.defaultProjectId || null,
    workspace_id: scope.workspaceId,
    module_id: scope.moduleId,
    product_id: scope.productId,
    title: String(title || "New STREAMS AI chat").slice(0, 80),
    status: "active",
    metadata: { source: "streams-ai-preview-fallback", autosave: false },
    created_at: now,
    updated_at: now,
  };
}
