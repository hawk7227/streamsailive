import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = Boolean(process.env.OPENAI_API_KEY);

  return NextResponse.json({
    ok: true,
    configured,
    provider: configured ? "openai_responses_web_search" : null,
    route: "/api/streams-ai/search",
    blockedReason: configured
      ? null
      : "Blocked: OPENAI_API_KEY is required for real web search.",
  });
}
