import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { streamsAIError } from "@/lib/streams-ai/api";
import { forgetStreamsMemory, listStreamsMemories, rememberStreamsMemory } from "@/lib/streams-ai/memory-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const url = request.nextUrl;
    const query = url.searchParams.get("q") || "";
    const sessionId = url.searchParams.get("sessionId");
    const projectId = url.searchParams.get("projectId");
    const limit = Number(url.searchParams.get("limit") || 25);
    const memories = await listStreamsMemories(scope, query, { sessionId, projectId, limit });
    return Response.json({ ok: true, ...memories });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({}));
    const result = await rememberStreamsMemory(scope, {
      scope: body.scope || "user",
      memoryType: body.memoryType || body.type || "fact",
      content: String(body.content || body.summary || ""),
      summary: body.summary ? String(body.summary) : undefined,
      projectId: body.projectId || null,
      sessionId: body.sessionId || null,
      sourceMessageId: body.sourceMessageId || null,
      sourceEventId: body.sourceEventId || null,
      confidence: typeof body.confidence === "number" ? body.confidence : undefined,
      importance: typeof body.importance === "number" ? body.importance : undefined,
      expiresAt: body.expiresAt || null,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const url = request.nextUrl;
    const body = await request.json().catch(() => ({}));
    const result = await forgetStreamsMemory(scope, body.memoryId || url.searchParams.get("memoryId") || undefined, body.query || url.searchParams.get("q") || undefined);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return streamsAIError(error);
  }
}
