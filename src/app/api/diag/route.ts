import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * DIAGNOSTIC ROUTE — safe to add, safe to delete.
 *
 * Install:  src/app/api/diag/route.ts
 * Visit:    https://streamsailive.vercel.app/api/diag?key=YOUR_SECRET
 *
 * Set DIAG_KEY in Vercel env vars to any random string first.
 * Without a matching key this route returns 401 and reveals nothing.
 *
 * It never prints secret VALUES — only whether each one is present,
 * its length, and its first 4 characters.
 */

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const IMPORTANT = [
  "OPENAI_MODEL",
  "NEXT_PUBLIC_APP_URL",
  "ADMIN_GENERATION_KEY",
  "GITHUB_TOKEN",
  "STREAMS_AI_WORKER_SECRET",
  "STREAMS_AI_TEST_MODE",
  "STREAMS_AI_TEST_USER_ID",
  "STREAMS_AI_PUBLIC_GUEST_MODE",
  "STREAMS_AI_PUBLIC_GUEST_USER_ID",
  "STREAMS_CREDENTIAL_KEY",
  "CRON_SECRET",
  "FAL_KEY",
  "FAL_API_KEY",
  "GH_TOKEN",
  "VERCEL_TOKEN",
  "VERCEL_PROJECT_ID",
];

function describe(name: string) {
  const v = process.env[name];
  if (v === undefined) return { name, set: false };
  if (v === "") return { name, set: false, note: "present but empty string" };
  return {
    name,
    set: true,
    length: v.length,
    startsWith: v.slice(0, 4),
  };
}

async function pingOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, reason: "OPENAI_API_KEY not set" };
  try {
    const started = Date.now();
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    const ms = Date.now() - started;
    if (!res.ok) {
      return { ok: false, status: res.status, ms, reason: await res.text().then((t) => t.slice(0, 200)) };
    }
    const data = await res.json();
    const ids: string[] = (data?.data ?? []).map((m: { id: string }) => m.id);
    const wanted = process.env.OPENAI_MODEL || "(OPENAI_MODEL unset)";
    return {
      ok: true,
      ms,
      modelCount: ids.length,
      configuredModel: wanted,
      configuredModelAvailable: process.env.OPENAI_MODEL ? ids.includes(process.env.OPENAI_MODEL) : null,
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

async function pingSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) return { ok: false, reason: "no Supabase URL set" };
  if (!key) return { ok: false, reason: "SUPABASE_SERVICE_ROLE_KEY not set" };
  try {
    const started = Date.now();
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    return { ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(request: Request) {
  const expected = process.env.DIAG_KEY;
  const provided = new URL(request.url).searchParams.get("key");

  if (!expected) {
    return NextResponse.json(
      { error: "DIAG_KEY is not set. Add it to your Vercel environment variables, redeploy, then retry." },
      { status: 503 }
    );
  }
  if (provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const required = REQUIRED.map(describe);
  const important = IMPORTANT.map(describe);
  const missingRequired = required.filter((r) => !r.set).map((r) => r.name);

  const supabaseUrlMismatch =
    Boolean(process.env.SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    process.env.SUPABASE_URL !== process.env.NEXT_PUBLIC_SUPABASE_URL;

  const [openai, supabase] = await Promise.all([pingOpenAI(), pingSupabase()]);

  return NextResponse.json(
    {
      checkedAt: new Date().toISOString(),

      runtime: {
        NODE_ENV: process.env.NODE_ENV ?? null,
        VERCEL_ENV: process.env.VERCEL_ENV ?? null,
        VERCEL_REGION: process.env.VERCEL_REGION ?? null,
        isProductionRuntime:
          process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production",
      },

      verdict: {
        missingRequired,
        allRequiredPresent: missingRequired.length === 0,
        supabaseUrlMismatch,
        openaiReachable: openai.ok,
        supabaseReachable: supabase.ok,
      },

      connectivity: { openai, supabase },

      env: { required, important },

      notes: [
        "isProductionRuntime true means guest/test auth fallback is DISABLED and every /api/streams-ai/ call needs a Bearer token.",
        "supabaseUrlMismatch true means SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL point at different projects.",
        "configuredModelAvailable false means OPENAI_MODEL names a model this key cannot access.",
      ],
    },
    { status: 200 }
  );
}
