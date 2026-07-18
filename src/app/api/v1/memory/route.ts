import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIMemoryRepository } from "@/lib/streams-ai/repositories/memory-repository";
import { sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "@/lib/streams-ai/protected-reasoning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const memory = new StreamsAIMemoryRepository();

function failure(error: unknown, status = 500) {
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown memory error" }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const query = request.nextUrl.searchParams.get("query") || "";
    const projectId = request.nextUrl.searchParams.get("projectId");
    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 50)));
    const scopes = request.nextUrl.searchParams.getAll("scope").filter(Boolean);
    const memoryTypes = request.nextUrl.searchParams.getAll("memoryType").filter(Boolean);
    const memories = query || projectId || scopes.length || memoryTypes.length
      ? await memory.search(scope, { query, projectId, scopes, memoryTypes, limit })
      : await memory.listVisible(scope, limit);
    return NextResponse.json({ ok: true, apiVersion: "v1", memories });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = sanitizeStreamsAIPayload(await request.json().catch(() => ({}))) as {
      projectId?: string | null;
      sessionId?: string | null;
      sourceMessageId?: string | null;
      scope?: "user" | "project" | "session" | "system" | "file" | "codebase";
      memoryType?: string;
      title?: string;
      content?: string;
      summary?: string;
      keywords?: string[];
      confidenceScore?: number;
      importanceScore?: number;
      isUserVisible?: boolean;
      isUserEditable?: boolean;
      isSensitive?: boolean;
      metadata?: Record<string, unknown>;
    };
    const content = sanitizeStreamsAIText(String(body.content || ""), 20000).trim();
    if (!content) return failure(new Error("content is required"), 400);
    const row = await memory.create(scope, { ...body, content });
    return NextResponse.json({ ok: true, apiVersion: "v1", memory: row }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
