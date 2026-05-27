type StreamsRealtimeSessionInput = {
  userId?: string;
  workspaceId?: string;
  instructions?: string;
};

const DEFAULT_REALTIME_MODEL = "gpt-realtime-2";

function buildSafetyIdentifier(input: StreamsRealtimeSessionInput) {
  const source = input.userId || input.workspaceId || "anonymous-streams-user";
  return `streams:${source}`;
}

export async function createStreamsRealtimeClientSecret(input: StreamsRealtimeSessionInput = {}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      ok: false as const,
      status: 500,
      error: "Blocked: OPENAI_API_KEY is required to create an OpenAI Realtime voice session.",
    };
  }

  const model = process.env.OPENAI_REALTIME_MODEL || DEFAULT_REALTIME_MODEL;
  const safetyIdentifier = buildSafetyIdentifier(input);

  const body = {
    session: {
      type: "realtime",
      model,
      instructions:
        input.instructions ||
        "You are STREAMS AI. Speak naturally, be concise, and help the user continue their current chat conversation. Do not claim tools or actions are complete unless they are actually available.",
      audio: {
        output: {
          voice: process.env.OPENAI_REALTIME_VOICE || "marin",
        },
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": safetyIdentifier,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      error:
        data?.error?.message ||
        data?.message ||
        "Blocked: OpenAI Realtime client secret request failed.",
      details: data,
    };
  }

  const value = data?.value || data?.client_secret?.value || data?.client_secret;

  if (!value || typeof value !== "string") {
    return {
      ok: false as const,
      status: 502,
      error: "Blocked: OpenAI Realtime response did not include a usable ephemeral client secret.",
      details: data,
    };
  }

  return {
    ok: true as const,
    model,
    value,
    expiresAt: data?.expires_at || data?.expiresAt || null,
  };
}
