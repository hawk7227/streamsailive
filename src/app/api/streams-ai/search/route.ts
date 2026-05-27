import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchRequestBody = {
  query?: string;
};

function extractSearchText(output: unknown): string {
  const data = output as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
      }>;
    }>;
  };

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const textParts: string[] = [];

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string" && content.text.trim()) {
        textParts.push(content.text);
      }
    }
  }

  return textParts.join("\n\n").trim();
}

function extractAnnotations(output: unknown) {
  const data = output as {
    output?: Array<{
      content?: Array<{
        annotations?: Array<Record<string, unknown>>;
      }>;
    }>;
  };

  const annotations: Array<Record<string, unknown>> = [];

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (Array.isArray(content.annotations)) {
        annotations.push(...content.annotations);
      }
    }
  }

  return annotations;
}

export async function GET() {
  const configured = Boolean(process.env.OPENAI_API_KEY);

  return NextResponse.json({
    ok: true,
    configured,
    provider: configured ? "openai_responses_web_search" : null,
    route: "/api/streams-ai/search",
    blockedReason: configured ? null : "OPENAI_API_KEY is required for real web search.",
  });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: sign in before using web search." },
      { status: 401 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY is required for real web search." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as SearchRequestBody;
  const query = String(body.query || "").trim();

  if (!query) {
    return NextResponse.json(
      { ok: false, error: "query is required" },
      { status: 400 }
    );
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": `streams:${user.id}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Use web search for current facts. Answer concisely. Include source-backed facts. Do not invent citations.",
        },
        {
          role: "user",
          content: query,
        },
      ],
      tools: [{ type: "web_search_preview" }],
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          data?.error?.message ||
          data?.message ||
          "OpenAI web search request failed.",
        details: data,
      },
      { status: response.status }
    );
  }

  return NextResponse.json({
    ok: true,
    source: "openai_responses_web_search",
    query,
    text: extractSearchText(data),
    annotations: extractAnnotations(data),
    rawResponseId: data?.id || null,
  });
}
