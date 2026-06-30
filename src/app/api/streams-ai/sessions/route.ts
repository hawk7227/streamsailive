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
    const rows = await sessions.list(scope);
    const activeRows = (dataArray(rows)).filter((session) => String(session.status || "active") !== "archived");
    const data = includeSummary
      ? await Promise.all(activeRows.map(async (session) => ({ ...session, session_summary: await readSessionSummary(scope, String(session.id || "")) })))
      : activeRows;
    return streamsAIJson({ ok: true, sessions: data, threads: data });
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
    const session = await sessions.create(scope, {
      title: body.title || await generateAITitle(titleSeed),
      projectId: body.projectId,
      metadata: { ...(body.metadata || {}), source: "streams-ai-chat-sidebar", recentChat: true, autosave: true },
    });

    return streamsAIJson({ ok: true, session, thread: session }, 201);
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

    if (body.summary) await writeSessionSummary(scope, sessionId, body.summary, { source: "sessions-api" });

    const session = await sessions.update(scope, sessionId, {
      title: body.title,
      status: body.status,
      metadata: body.metadata,
    });

    return streamsAIJson({ ok: true, session, thread: session, summaryUpdated: Boolean(body.summary) });
  } catch (error) {
    return streamsAIError(error);
  }
}

function dataArray(value: unknown): Record<string, any>[] {
  return Array.isArray(value) ? value as Record<string, any>[] : [];
}
