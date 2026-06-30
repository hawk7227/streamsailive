import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { streamsAIError } from "@/lib/streams-ai/api";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";
import { StreamsAIMessagesRepository } from "@/lib/streams-ai/repositories/messages-repository";
import { listStreamsMemories, readSessionSummary } from "@/lib/streams-ai/memory-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessions = new StreamsAISessionsRepository();
const messages = new StreamsAIMessagesRepository();

function norm(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function includes(haystack: string, query: string) {
  return haystack.toLowerCase().includes(query.toLowerCase());
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const query = norm(request.nextUrl.searchParams.get("q") || request.nextUrl.searchParams.get("query") || "");
    const limit = Math.max(1, Math.min(50, Number(request.nextUrl.searchParams.get("limit") || 20)));
    const allSessions = await sessions.list(scope);
    const memoryResult = query ? await listStreamsMemories(scope, query, { limit: 25 }) : { memories: [] as Record<string, unknown>[] };
    const results: Record<string, unknown>[] = [];

    for (const session of allSessions.slice(0, 200) as Record<string, unknown>[]) {
      if (String(session.status || "active") === "archived") continue;
      const sessionId = String(session.id || "");
      if (!sessionId) continue;
      const [rows, summary] = await Promise.all([
        messages.list(scope, sessionId).catch(() => []),
        readSessionSummary(scope, sessionId).catch(() => ""),
      ]);
      const text = [session.title, session.id, summary, JSON.stringify(session.metadata || {}), ...rows.map((row: Record<string, unknown>) => row.content || "")].join("\n");
      const matchedMessages = query ? rows.filter((row: Record<string, unknown>) => includes(String(row.content || ""), query)).slice(0, 3) : rows.slice(-1);
      const matched = !query || includes(text, query);
      if (matched) {
        results.push({
          ...session,
          session_summary: summary,
          matchCount: matchedMessages.length,
          matchedMessages: matchedMessages.map((row: Record<string, unknown>) => ({ id: row.id, role: row.role, content: String(row.content || "").slice(0, 400), created_at: row.created_at })),
        });
      }
      if (results.length >= limit) break;
    }

    return Response.json({ ok: true, query, results, memories: memoryResult.memories || [] });
  } catch (error) {
    return streamsAIError(error);
  }
}
