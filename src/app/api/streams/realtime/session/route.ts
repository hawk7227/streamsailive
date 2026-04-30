import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  userId?: string;
};

const TEST_USER_ID = process.env.TEST_USER_ID || "streams-test-user";

export async function POST(request: Request): Promise<NextResponse> {
  let body: Body = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const isTestUser = body.userId === TEST_USER_ID;

  if (!isTestUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is missing" }, { status: 500 });
  }

  const model = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model,
        output_modalities: ["audio"],
        audio: {
          input: {
            turn_detection: {
              type: "server_vad",
              interrupt_response: true,
            },
          },
          output: {
            voice: "marin",
          },
        },
        instructions:
          "You are Streams voice mode. Speak naturally and briefly. If the user asks to generate an image, acknowledge that image generation is being routed through Streams tools.",
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      { error: data?.error?.message || "Failed to create realtime session" },
      { status: response.status },
    );
  }

  return NextResponse.json(data);
}
