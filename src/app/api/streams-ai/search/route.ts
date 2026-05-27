import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type SearchRequestBody = {
  query?: string;
};

async function getAuthenticatedUser(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  const bearerClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user: bearerUser },
  } = await bearerClient.auth.getUser(token);

  return bearerUser || null;
}

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
  const seen = new Set<string>();

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (!Array.isArray(content.annotations)) continue;

      for (const annotation of content.annotations) {
        const url = String(annotation.url || annotation.href || "");
        const title = String(annotation.title || "");
        const key = url || title;

        if (!key || seen.has(key)) continue;

        seen.add(key);
        annotations.push(annotation);
      }
    }
  }

  return annotations.slice(0, 6);
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
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Unauthorized: sign in before using web search. Server did not receive a Supabase cookie or bearer session.",
      },
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
