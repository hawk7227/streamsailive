import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

function extractOutputText(data: any) {
  if (!data) return "";

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts: string[] = [];

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") parts.push(content.text);
      if (typeof content.output_text === "string") parts.push(content.output_text);
    }
  }

  return parts.join("\n").trim();
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return jsonError("OPENAI_API_KEY is not configured for the admin generation helper.", 503);
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return jsonError("Invalid helper request body.", 400);
  }

  const message = String(body.message || body.prompt || "").trim();
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const context = body.context || {};

  if (!message) {
    return jsonError("Helper message is required.", 400);
  }

  const system = `You are the STREAMS AI Helper for /admingeneration.

You are a production movie-generation assistant. Help the user create high-end AI movies, image/video/audio generations, voice projects, and launch assets.

Responsibilities:
- Talk conversationally with the user.
- Analyze uploaded files, URLs, YouTube links, scripts, and references when provided by the frontend.
- Proof prompts before generation so the user does not waste tokens or credits.
- Suggest provider-specific improvements for fal.ai, Runway, Kling, Veo, OpenAI, and ElevenLabs.
- Ask for missing details when the prompt is weak.
- Explain blocked states truthfully.
- Give step-by-step first-time guides for every studio card/workflow.
- Keep answers practical and short enough for the right-side helper console.
- Never claim a provider ran unless runtime proof is present in the supplied context.
- If the user asks to generate, first check provider, duration, aspect ratio, style, and reference readiness.`;

  const conversation = messages
    .filter((entry: any) => entry && typeof entry.text === "string")
    .map((entry: any) => ({
      role: entry.role === "user" ? "user" : "assistant",
      content: entry.text,
    }));

  const payload = {
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: system,
      },
      ...conversation,
      {
        role: "user",
        content: `${message}

Current builder context:
${JSON.stringify(context, null, 2)}`,
      },
    ],
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    const text = extractOutputText(data);

    if (!response.ok) {
      return jsonError("OpenAI helper request failed.", response.status, data);
    }

    if (!text) {
      return jsonError("OpenAI helper returned no readable text.", 502, data);
    }

    return NextResponse.json({
      ok: true,
      route: "admingeneration-helper",
      text,
      result: data,
    });
  } catch (error) {
    return jsonError("Admin generation helper failed.", 500, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
