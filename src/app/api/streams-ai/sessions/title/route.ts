import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAISessionsRepository } from "@/lib/streams-ai/repositories/sessions-repository";
import { generateAITitle } from "@/lib/streams-ai/services/title-generator";

const sessions = new StreamsAISessionsRepository();

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      sessionId?: string;
      content: string;
    }>(request);

    if (!body.content) {
      return streamsAIJson({ ok: false, error: "content is required" }, 400);
    }

    const title = await generateAITitle(body.content);

    if (body.sessionId) {
      await sessions.update(scope, body.sessionId, { title });
    }

    return streamsAIJson({ ok: true, title });
  } catch (error) {
    return streamsAIError(error);
  }
}
