import { NextResponse } from "next/server";

export async function GET() {
  const enabled = process.env.STREAMS_VISIONS_ENABLED !== "false";
  const providerConfigured = Boolean(process.env.OPENAI_API_KEY);
  return NextResponse.json({
    ok: enabled && providerConfigured,
    feature: "streams-visions",
    enabled,
    providerConfigured,
    route: "/streams-ai/Visions",
    isolatedFrom: "/streams-ai",
  }, { status: enabled && providerConfigured ? 200 : 503 });
}
