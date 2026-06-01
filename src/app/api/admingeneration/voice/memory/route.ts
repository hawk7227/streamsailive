import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

function internalUrl(request: Request, pathname: string) {
  return new URL(pathname, new URL(request.url).origin).toString();
}

async function readJson(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json().catch(() => null);
  const text = await response.text().catch(() => "");
  return text ? { text } : null;
}

async function forward(request: Request, pathname: string, payload: unknown) {
  const cookie = request.headers.get("cookie") || "";

  try {
    const response = await fetch(internalUrl(request, pathname), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    return {
      ok: response.ok,
      target: pathname,
      status: response.status,
      result: await readJson(response),
    };
  } catch (error) {
    return {
      ok: false,
      target: pathname,
      status: 0,
      result: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("Invalid voice memory request body.", 400);
  }

  const payload = body as Record<string, unknown>;
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const role = typeof payload.role === "string" ? payload.role : "user";

  if (!text) {
    return jsonError("Voice transcript text is required.", 400);
  }

  const memoryPayload = {
    role,
    content: text,
    text,
    message: text,
    source: "admingeneration-voice",
    metadata: {
      ...(typeof payload.metadata === "object" && payload.metadata ? payload.metadata : {}),
      transcriptType: payload.transcriptType || "final",
      eventType: payload.eventType || "transcript",
      vapiCallId: payload.vapiCallId || null,
      memoryMode: payload.memoryMode || "session",
      responseStyle: payload.responseStyle || "natural",
      context: payload.context || {},
    },
  };

  const attempts = [];
  attempts.push(await forward(request, "/api/streams-ai/messages", memoryPayload));
  if (!attempts.some((attempt) => attempt.ok)) {
    attempts.push(await forward(request, "/api/streams/chat", memoryPayload));
  }
  if (!attempts.some((attempt) => attempt.ok)) {
    attempts.push(await forward(request, "/api/streams/memory", memoryPayload));
  }

  const accepted = attempts.find((attempt) => attempt.ok);

  if (!accepted) {
    return NextResponse.json(
      {
        ok: false,
        route: "admingeneration-voice-memory",
        error: "STREAMS memory persistence blocked or unavailable.",
        attempts,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    route: "admingeneration-voice-memory",
    accepted,
    attempts,
  });
}
