import { NextResponse } from "next/server";
import {
  normalizeVapiWebhookEvent,
  verifyVapiWebhookRequest,
} from "@/lib/voice/vapi-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

function internalUrl(request: Request, pathname: string) {
  return new URL(pathname, new URL(request.url).origin).toString();
}

async function readResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  return text ? { text } : null;
}

async function forwardToStreams(request: Request, payload: Record<string, unknown>) {
  const cookie = request.headers.get("cookie") || "";

  const targets = [
    "/api/admingeneration/voice/memory",
    "/api/streams-ai/messages",
    "/api/streams/chat",
    "/api/streams/memory",
  ];

  const attempts = [];

  for (const target of targets) {
    try {
      const response = await fetch(internalUrl(request, target), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const result = await readResponse(response);
      const attempt = {
        target,
        ok: response.ok,
        status: response.status,
        result,
      };

      attempts.push(attempt);

      if (response.ok) {
        return { accepted: attempt, attempts };
      }
    } catch (error) {
      attempts.push({
        target,
        ok: false,
        status: 0,
        result: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  return { accepted: null, attempts };
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return jsonError("Empty Vapi webhook body.", 400);
  }

  const verify = verifyVapiWebhookRequest({
    rawBody,
    headers: request.headers,
    secret: process.env.VAPI_WEBHOOK_SECRET || "",
  });

  if (!verify.ok) {
    return jsonError(verify.error || "Unauthorized Vapi webhook request.", 401, {
      mode: verify.mode,
    });
  }

  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonError("Vapi webhook body is not valid JSON.", 400);
  }

  const normalized = normalizeVapiWebhookEvent(body);

  if (!normalized) {
    return jsonError(
      "Vapi webhook did not include a complete transcript event with callId, sessionId, projectId, userId, role, and transcript.",
      422,
      { receivedType: typeof body === "object" && body ? (body as Record<string, unknown>).type : null },
    );
  }

  const streamsPayload = {
    callId: normalized.callId,
    sessionId: normalized.sessionId,
    projectId: normalized.projectId,
    userId: normalized.userId,
    role: normalized.role,
    side: normalized.role,
    text: normalized.transcript,
    transcript: normalized.transcript,
    content: normalized.transcript,
    message: normalized.transcript,
    timestamp: normalized.timestamp,
    source: "vapi-webhook",
    eventType: normalized.eventType,
    metadata: {
      provider: "vapi",
      source: "server-webhook",
      rawType: normalized.rawType,
      durableSourceOfTruth: true,
      callId: normalized.callId,
      sessionId: normalized.sessionId,
      projectId: normalized.projectId,
      userId: normalized.userId,
    },
  };

  const persistence = await forwardToStreams(request, streamsPayload);

  if (!persistence.accepted) {
    return NextResponse.json(
      {
        ok: false,
        route: "vapi-webhook",
        verified: true,
        normalized,
        error: "Transcript was normalized but no STREAMS persistence route accepted it.",
        attempts: persistence.attempts,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    route: "vapi-webhook",
    verified: true,
    signatureMode: verify.mode,
    normalized: {
      callId: normalized.callId,
      sessionId: normalized.sessionId,
      projectId: normalized.projectId,
      userId: normalized.userId,
      role: normalized.role,
      transcript: normalized.transcript,
      timestamp: normalized.timestamp,
    },
    persistence,
  });
}
