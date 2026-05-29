import crypto from "node:crypto";

export type NormalizedVapiVoiceEvent = {
  callId: string;
  sessionId: string;
  projectId: string;
  userId: string;
  role: "user" | "assistant";
  transcript: string;
  timestamp: string;
  eventType: string;
  rawType: string;
  raw: unknown;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function findFirstString(...values: unknown[]): string {
  for (const value of values) {
    const text = readString(value);
    if (text) return text;
  }
  return "";
}

function inferRole(value: unknown): "user" | "assistant" {
  const text = String(value || "").toLowerCase();

  if (
    text.includes("assistant") ||
    text.includes("bot") ||
    text.includes("ai") ||
    text.includes("system")
  ) {
    return "assistant";
  }

  return "user";
}

function getNested(body: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, body);
}

export function verifyVapiWebhookRequest(args: {
  rawBody: string;
  headers: Headers;
  secret: string;
}) {
  const secret = args.secret.trim();

  if (!secret) {
    return {
      ok: false,
      mode: "missing-secret",
      error: "VAPI_WEBHOOK_SECRET is not configured.",
    };
  }

  const auth = args.headers.get("authorization") || "";
  const directSecret =
    args.headers.get("x-vapi-secret") ||
    args.headers.get("x-webhook-secret") ||
    args.headers.get("x-vapi-signature") ||
    args.headers.get("x-signature") ||
    "";

  if (auth === `Bearer ${secret}` || directSecret === secret) {
    return { ok: true, mode: "shared-secret" };
  }

  const signature =
    args.headers.get("x-vapi-signature") ||
    args.headers.get("x-signature") ||
    args.headers.get("x-hub-signature-256") ||
    "";

  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(args.rawBody)
    .digest("hex");

  const expectedSha = `sha256=${expectedHex}`;
  const normalizedSignature = signature.replace(/^sha256=/, "");

  try {
    if (
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSha)) ||
      crypto.timingSafeEqual(Buffer.from(normalizedSignature), Buffer.from(expectedHex))
    ) {
      return { ok: true, mode: "hmac-sha256" };
    }
  } catch {
    // fall through to unauthorized
  }

  return {
    ok: false,
    mode: "invalid-signature",
    error:
      "Vapi webhook signature/auth did not match. Configure Vapi to send Authorization: Bearer VAPI_WEBHOOK_SECRET, x-vapi-secret, or HMAC SHA256 signature.",
  };
}

export function normalizeVapiWebhookEvent(body: unknown): NormalizedVapiVoiceEvent | null {
  if (!body || typeof body !== "object") return null;

  const payload = body as Record<string, unknown>;
  const message = (payload.message && typeof payload.message === "object"
    ? payload.message
    : payload) as Record<string, unknown>;

  const rawType = findFirstString(
    payload.type,
    message.type,
    payload.event,
    message.event,
    payload.status,
    message.status,
  );

  const call = (message.call && typeof message.call === "object"
    ? message.call
    : payload.call && typeof payload.call === "object"
      ? payload.call
      : {}) as Record<string, unknown>;

  const metadata = (call.metadata && typeof call.metadata === "object"
    ? call.metadata
    : message.metadata && typeof message.metadata === "object"
      ? message.metadata
      : payload.metadata && typeof payload.metadata === "object"
        ? payload.metadata
        : {}) as Record<string, unknown>;

  const transcript = findFirstString(
    message.transcript,
    payload.transcript,
    message.text,
    payload.text,
    message.content,
    payload.content,
    getNested(message, "artifact.transcript"),
    getNested(payload, "artifact.transcript"),
  );

  if (!transcript) return null;

  const role = inferRole(
    findFirstString(
      message.role,
      payload.role,
      message.speaker,
      payload.speaker,
      message.transcriptRole,
      payload.transcriptRole,
      getNested(message, "message.role"),
      getNested(payload, "message.role"),
    ),
  );

  const callId = findFirstString(
    message.callId,
    payload.callId,
    message.call_id,
    payload.call_id,
    message.id,
    call.id,
    metadata.callId,
  );

  const sessionId = findFirstString(
    message.sessionId,
    payload.sessionId,
    metadata.sessionId,
    metadata.streamsSessionId,
    metadata.conversationId,
  );

  const projectId = findFirstString(
    message.projectId,
    payload.projectId,
    metadata.projectId,
    metadata.streamsProjectId,
  );

  const userId = findFirstString(
    message.userId,
    payload.userId,
    metadata.userId,
    metadata.streamsUserId,
    metadata.ownerId,
  );

  if (!callId || !sessionId || !projectId || !userId) {
    return null;
  }

  const timestamp = findFirstString(
    message.timestamp,
    payload.timestamp,
    message.createdAt,
    payload.createdAt,
    message.startedAt,
    payload.startedAt,
  );

  return {
    callId,
    sessionId,
    projectId,
    userId,
    role,
    transcript,
    timestamp: timestamp || new Date().toISOString(),
    eventType: "vapi.transcript",
    rawType: rawType || "unknown",
    raw: body,
  };
}
