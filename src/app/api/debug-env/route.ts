import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = [
    "OPENAI_API_KEY","OPENAI_API_KEY_IMAGES","OPENAI_API_KEY_VOICE",
    "KLING_API_KEY","KLING_ASSESS_API_KEY","RUNWAY_API_KEY","SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "AI_PROVIDER_IMAGE","AI_PROVIDER_VIDEO","AI_PROVIDER_I2V",
    "CLICKSEND_USERNAME","CLICKSEND_PASSWORD","CLICKSEND_API_KEY","CLICKSEND_FROM_NUMBER","CLICKSEND_SENDER_ID",
  ];

  const defaults: Record<string, string> = {
    AI_PROVIDER_IMAGE: "openai (default)",
    AI_PROVIDER_VIDEO: "kling (default)",
    AI_PROVIDER_I2V: "kling (default)",
  };

  const envStatus: Record<string, string> = {};
  for (const key of keys) {
    const val = process.env[key];
    if (!val) envStatus[key] = defaults[key] ? `MISSING — using ${defaults[key]}` : "MISSING";
    else envStatus[key] = `SET (${val.slice(0,4)}...${val.slice(-4)}, len=${val.length})`;
  }

  // Live DALL-E test
  let dalleTest = "skipped";
  const apiKey = process.env.OPENAI_API_KEY_IMAGES || process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "dall-e-3", prompt: "A plain white square", n: 1, size: "1024x1024" }),
      });
      const body = await res.json() as { data?: unknown[]; error?: { message?: string } };
      dalleTest = res.ok && body.data?.[0]
        ? "SUCCESS"
        : `FAILED: ${body.error?.message ?? res.status}`;
    } catch (e) {
      dalleTest = `EXCEPTION: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    dalleTest = "NO KEY";
  }

  // Check actual auth session
  let authStatus = "unknown";
  try {
    const { data: { user } } = await supabase.auth.getUser();
    authStatus = user ? `LOGGED IN as ${user.email}` : "NOT LOGGED IN — session missing";
  } catch(e) {
    authStatus = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({ envStatus, dalleTest, authStatus });
}
