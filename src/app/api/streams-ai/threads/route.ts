import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { streamsAIError } from "@/lib/streams-ai/api";
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
    const threads = includeSummary
      ? await Promise.all(rows.map(async (thread: Record<string, unknown>) => ({ ...thread, session_summary: await readSessionSummary(scope, String(thread.id || "")) })))
      : rows;
    return Response.json({ ok: true, threads });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({}));
    const title = body.title ? String(body.title) : await generateAITitle(String(body.firstMessage || "New chat"));
    const thread = await sessions.create(scope, { title, projectId: body.projectId || undefined, metadata: { ...(body.metadata || {}), source: "streams-ai-recent-chats", recentChat: true } });
    return Response.json({ ok: true, thread });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({}));
    const sessionId = String(body.sessionId || body.id || "");
    if (!sessionId) return Response.json({ ok: false, error: "sessionId is required" }, { status: 400 });
    if (body.summary) await writeSessionSummary(scope, sessionId, String(body.summary), { source: "threads-api" });
    const thread = await sessions.update(scope, sessionId, { title: body.title, status: body.status, metadata: body.metadata });
    return Response.json({ ok: true, thread, summaryUpdated: Boolean(body.summary) });
  } catch (error) {
    return streamsAIError(error);
  }
}
