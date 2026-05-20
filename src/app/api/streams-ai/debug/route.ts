import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function firstEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return { name, value: value.trim() };
  }
  return { name: "", value: "" };
}

function projectRefFromUrl(url: string) {
  try {
    return new URL(url).host.split(".")[0] || null;
  } catch {
    return null;
  }
}

function masked(value: string) {
  if (!value) return "MISSING";
  if (value.length <= 10) return `SET len=${value.length}`;
  return `SET ${value.slice(0, 4)}...${value.slice(-4)} len=${value.length}`;
}

export async function GET() {
  const supabaseUrl = firstEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "DATABASE_SUPABASE_URL");
  const anonKey = firstEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY", "SUPABASE_PUBLIC_ANON_KEY");
  const serviceKey = firstEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_SERVICE_ROLE",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SECRET",
    "SERVICE_ROLE_KEY",
  );

  const base = {
    ok: false,
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelUrl: process.env.VERCEL_URL || null,
    supabaseUrlEnv: supabaseUrl.name || null,
    supabaseProjectRef: projectRefFromUrl(supabaseUrl.value),
    anonKeyEnv: anonKey.name || null,
    serviceKeyEnv: serviceKey.name || null,
    anonKeyStatus: masked(anonKey.value),
    serviceKeyStatus: masked(serviceKey.value),
    streamsAiTestMode: process.env.STREAMS_AI_TEST_MODE || null,
    streamsAiTestUserId: process.env.STREAMS_AI_TEST_USER_ID || null,
  };

  if (!supabaseUrl.value || !serviceKey.value) {
    return NextResponse.json({
      ...base,
      error: "Missing Supabase URL or service role key in this Vercel deployment.",
    }, { status: 500 });
  }

  try {
    const service = createClient(supabaseUrl.value, serviceKey.value, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await service
      .schema("streams_ai")
      .from("memberships")
      .select("id, tenant_id, user_id, role, created_at")
      .limit(1);

    if (error) {
      return NextResponse.json({
        ...base,
        ok: false,
        streamsAiSchemaVisible: false,
        supabaseError: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
      }, { status: 500 });
    }

    return NextResponse.json({
      ...base,
      ok: true,
      streamsAiSchemaVisible: true,
      membershipsSampleCount: Array.isArray(data) ? data.length : 0,
      membershipsSample: data || [],
    });
  } catch (error) {
    return NextResponse.json({
      ...base,
      ok: false,
      exception: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
