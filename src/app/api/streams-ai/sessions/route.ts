import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";

const sessions = new StreamsAISessionsRepository();

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const data = await sessions.list(scope);
    return streamsAIJson({ ok: true, sessions: data });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      title?: string;
      projectId?: string | null;
      metadata?: Record<string, unknown>;
    }>(request);

    const session = await sessions.create(scope, {
      title: body.title,
      projectId: body.projectId,
      metadata: body.metadata,
    });

    return streamsAIJson({ ok: true, session }, 201);
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      sessionId?: string;
      title?: string;
      status?: "active" | "archived";
      metadata?: Record<string, unknown>;
    }>(request);

    if (!body.sessionId) {
      return streamsAIJson({ ok: false, error: "sessionId is required" }, 400);
    }

    const session = await sessions.update(scope, body.sessionId, {
      title: body.title,
      status: body.status,
      metadata: body.metadata,
    });

    return streamsAIJson({ ok: true, session });
  } catch (error) {
    return streamsAIError(error);
  }
}
