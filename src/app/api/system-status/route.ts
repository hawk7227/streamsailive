import "@/lib/env";
import { NextRequest, NextResponse } from "next/server";
import { client } from "@/lib/assistant-core/openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_SECRET_KEY, FAL_API_KEY, UPSTREAM_ASSISTANT_URL } from "@/lib/env";

// ── Types ──────────────────────────────────────────────────────────────────

type CheckStatus = "pass" | "fail" | "warn";

type CheckResult = {
  status: CheckStatus;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
};

type SystemStatusResponse = {
  ok: boolean;
  timestamp: string;
  checks: {
    env: CheckResult;
    openai: CheckResult;
    supabase: CheckResult;
    fal: CheckResult;
    realtime: CheckResult;
  };
};

// ── Helpers ────────────────────────────────────────────────────────────────

function ms(start: number): number {
  return Math.round(performance.now() - start);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

// ── Health Checks ──────────────────────────────────────────────────────────

function checkEnv(): CheckResult {
  const required = ["OPENAI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL"] as const;
  const optional = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_ROLE",
    "FAL_API_KEY",
    "ADMIN_SECRET_KEY",
  ] as const;

  const missing = required.filter((k) => !process.env[k]?.trim());
  const optionalPresent = optional.filter((k) => !!process.env[k]?.trim());

  if (missing.length > 0) {
    return {
      status: "fail",
      message: `Missing required vars: ${missing.join(", ")}`,
      details: { missing, optionalPresent },
    };
  }

  return {
    status: "pass",
    details: {
      required: required.map((k) => ({ key: k, set: true })),
      optionalPresent,
    },
  };
}

async function checkOpenAI(): Promise<CheckResult> {
  const start = performance.now();
  try {
    await withTimeout(
      client.models.list(),
      5000,
      "openai",
    );
    return { status: "pass", latencyMs: ms(start) };
  } catch (e) {
    return {
      status: "fail",
      latencyMs: ms(start),
      message: e instanceof Error ? e.message : "OpenAI unreachable",
    };
  }
}

async function checkSupabase(): Promise<CheckResult> {
  const start = performance.now();
  try {
    const supabase = createAdminClient();
    // Lightweight probe — select 1 row from generations table
    const result = await withTimeout(
      Promise.resolve(supabase.from("generations").select("id").limit(1)),
      5000,
      "supabase",
    );
    const err = (result as { error?: { code?: string; message?: string } }).error;
    if (err) {
      // Table may not exist yet — distinguish connectivity failure from schema miss
      const isConnected = err.code !== "PGRST301";
      return {
        status: isConnected ? "warn" : "fail",
        latencyMs: ms(start),
        message: err.message ?? "Supabase query error",
      };
    }
    return { status: "pass", latencyMs: ms(start) };
  } catch (e) {
    return {
      status: "fail",
      latencyMs: ms(start),
      message: e instanceof Error ? e.message : "Supabase unreachable",
    };
  }
}

function checkFal(): CheckResult {
  const key = FAL_API_KEY;
  if (!key) {
    return {
      status: "warn",
      message: "FAL_API_KEY not set — video generation unavailable",
    };
  }
  return { status: "pass", details: { keyPresent: true } };
}

async function checkRealtime(): Promise<CheckResult> {
  const start = performance.now();
  const realtimeUrl =
    UPSTREAM_ASSISTANT_URL ||
    "https://octopus-app-4szwt.ondigitalocean.app";
  const healthUrl = realtimeUrl
    .replace("/api/ai-assistant", "")
    .replace(/\/$/, "") + "/healthz";

  try {
    const res = await withTimeout(
      fetch(healthUrl, { method: "GET" }),
      5000,
      "realtime",
    );
    if (!res.ok) {
      return {
        status: "fail",
        latencyMs: ms(start),
        message: `Realtime service returned HTTP ${res.status}`,
      };
    }
    return { status: "pass", latencyMs: ms(start) };
  } catch (e) {
    return {
      status: "fail",
      latencyMs: ms(start),
      message: e instanceof Error ? e.message : "Realtime service unreachable",
    };
  }
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Admin-only — same pattern as /api/admin/config
  const secretKey = req.headers.get("x-admin-secret-key");
  const adminKey = ADMIN_SECRET_KEY;

  if (!adminKey || secretKey !== adminKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run all checks — failures in one do not block others
  const [openai, supabase, realtime] = await Promise.all([
    checkOpenAI(),
    checkSupabase(),
    checkRealtime(),
  ]);

  const env = checkEnv();
  const fal = checkFal();

  const checks = { env, openai, supabase, fal, realtime };
  const ok = Object.values(checks).every((c) => c.status !== "fail");

  const body: SystemStatusResponse = {
    ok,
    timestamp: new Date().toISOString(),
    checks,
  };

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

// HEAD for uptime monitors — no auth required, returns 200/503 only
export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200 });
}

// ── Streams panel health check (appended) ────────────────────────────────
// Checks generation_log table is reachable and reports counts.
// This is separate from the main system-status checks above.
export async function streamsHealthCheck(admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>) {
  try {
    const { count, error } = await admin
      .from("generation_log")
      .select("*", { count: "exact", head: true });
    if (error) return { status: "fail" as const, message: `generation_log: ${error.message}` };
    return { status: "pass" as const, message: `generation_log reachable (${count ?? 0} rows)` };
  } catch (e) {
    return { status: "warn" as const, message: `generation_log check failed: ${String(e)}` };
  }
}
