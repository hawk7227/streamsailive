"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

type CheckStatus = "pass" | "fail" | "warn";

type CheckResult = {
  status: CheckStatus;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
};

type SystemStatusData = {
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

type BuildReport = {
  generatedAt: string;
  commit: string;
  branch: string;
  environment: string;
  ok: boolean;
  issues: string[];
};

type UIState =
  | { phase: "auth" }
  | { phase: "loading"; key: string }
  | { phase: "error"; message: string; key: string }
  | { phase: "ready"; data: SystemStatusData; build: BuildReport | null; key: string };

const REFRESH_INTERVAL_MS = 30_000;

const CHECK_LABELS: Record<string, string> = {
  env: "Environment",
  openai: "OpenAI API",
  supabase: "Supabase",
  fal: "FAL / Video",
  realtime: "Realtime Service",
};

// ── Auth gate ──────────────────────────────────────────────────────────────

function AuthGate({ onSubmit }: { onSubmit: (key: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <span className="text-lg">⬡</span>
          </div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/40">
            System Status
          </h1>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.15em] text-white/40">
            Admin Key
          </label>
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
            }}
            placeholder="Enter admin secret key"
            className="mb-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-white/20"
            autoFocus
          />
          <button
            onClick={() => value.trim() && onSubmit(value.trim())}
            className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Access Status
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status dot ─────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: CheckStatus }) {
  const color =
    status === "pass"
      ? "bg-emerald-400"
      : status === "fail"
        ? "bg-red-500"
        : "bg-amber-400";
  const pulse = status === "fail" ? "animate-pulse" : "";
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${color} ${pulse}`} />
  );
}

// ── Check row ──────────────────────────────────────────────────────────────

function CheckRow({
  name,
  result,
}: {
  name: string;
  result: CheckResult;
}) {
  const statusText =
    result.status === "pass"
      ? "Operational"
      : result.status === "fail"
        ? "Failing"
        : "Warning";

  const statusColor =
    result.status === "pass"
      ? "text-emerald-400"
      : result.status === "fail"
        ? "text-red-400"
        : "text-amber-400";

  return (
    <div className="flex items-center justify-between border-b border-white/5 py-4 last:border-0">
      <div className="flex items-center gap-3">
        <StatusDot status={result.status} />
        <span className="text-sm font-medium text-white/80">
          {CHECK_LABELS[name] ?? name}
        </span>
        {result.message ? (
          <span className="hidden max-w-xs truncate text-[11px] text-white/30 sm:block">
            {result.message}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-4">
        {result.latencyMs !== undefined ? (
          <span className="text-[11px] tabular-nums text-white/30">
            {result.latencyMs}ms
          </span>
        ) : null}
        <span className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${statusColor}`}>
          {statusText}
        </span>
      </div>
    </div>
  );
}

// ── Overall banner ─────────────────────────────────────────────────────────

function OverallBanner({ ok }: { ok: boolean }) {
  if (ok) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-sm font-semibold text-emerald-300">
          All systems operational
        </span>
      </div>
    );
  }
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4">
      <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
      <span className="text-sm font-semibold text-red-300">
        System degraded — one or more checks failing
      </span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function SystemStatusPage() {
  const [state, setState] = useState<UIState>({ phase: "auth" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef<string>("");

  const fetchStatus = useCallback(async (adminKey: string) => {
    setState((prev) =>
      prev.phase === "ready"
        ? prev
        : { phase: "loading", key: adminKey },
    );

    try {
      const [statusRes, buildRes] = await Promise.all([
        fetch("/api/system-status", {
          headers: { "x-admin-secret-key": adminKey },
          cache: "no-store",
        }),
        fetch("/build-report.json", { cache: "no-store" }).catch(() => null),
      ]);

      if (statusRes.status === 401) {
        setState({ phase: "auth" });
        return;
      }

      if (!statusRes.ok) {
        setState({
          phase: "error",
          message: `HTTP ${statusRes.status} from /api/system-status`,
          key: adminKey,
        });
        return;
      }

      const data = (await statusRes.json()) as SystemStatusData;
      const build = buildRes?.ok
        ? ((await buildRes.json()) as BuildReport)
        : null;

      setState({ phase: "ready", data, build, key: adminKey });
    } catch (e) {
      setState({
        phase: "error",
        message: e instanceof Error ? e.message : "Failed to fetch status",
        key: adminKey,
      });
    }
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (state.phase !== "ready" && state.phase !== "loading") return;
    const key = state.key;

    timerRef.current = setTimeout(() => {
      void fetchStatus(key);
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state, fetchStatus]);

  const handleAuth = useCallback(
    (key: string) => {
      keyRef.current = key;
      void fetchStatus(key);
    },
    [fetchStatus],
  );

  const handleRefresh = useCallback(() => {
    const key = "key" in state ? state.key : keyRef.current;
    if (key) void fetchStatus(key);
  }, [state, fetchStatus]);

  // ── Auth gate
  if (state.phase === "auth") {
    return <AuthGate onSubmit={handleAuth} />;
  }

  // ── Loading
  if (state.phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
          <span className="text-[11px] uppercase tracking-[0.15em] text-white/30">
            Checking systems…
          </span>
        </div>
      </div>
    );
  }

  // ── Error
  if (state.phase === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="w-full max-w-sm text-center">
          <p className="mb-4 text-sm text-red-400">{state.message}</p>
          <button
            onClick={handleRefresh}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Ready
  const { data, build } = state;
  const checks = Object.entries(data.checks) as [string, CheckResult][];
  const nextRefreshIn = Math.round(REFRESH_INTERVAL_MS / 1000);

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-10 flex items-start justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sm">
                ⬡
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">
                STREAMS
              </span>
            </div>
            <h1 className="text-xl font-semibold text-white">System Status</h1>
            <p className="mt-1 text-[11px] text-white/30">
              Auto-refreshes every {nextRefreshIn}s ·{" "}
              {new Date(data.timestamp).toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="rounded-xl border border-white/10 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.1em] text-white/40 transition hover:border-white/20 hover:text-white/70"
          >
            Refresh
          </button>
        </div>

        {/* Overall banner */}
        <OverallBanner ok={data.ok} />

        {/* Checks */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] px-5">
          {checks.map(([name, result]) => (
            <CheckRow key={name} name={name} result={result} />
          ))}
        </div>

        {/* Build report */}
        {build ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">
              Build
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
              {[
                { label: "Commit", value: build.commit.slice(0, 8) },
                { label: "Branch", value: build.branch },
                { label: "Env", value: build.environment },
                {
                  label: "Built",
                  value: new Date(build.generatedAt).toLocaleDateString(),
                },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-white/25">
                    {label}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-white/60">
                    {value}
                  </div>
                </div>
              ))}
            </div>
            {!build.ok && build.issues.length > 0 ? (
              <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
                {build.issues.map((issue) => (
                  <p key={issue} className="text-[11px] text-red-400">
                    {issue}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="mt-6 text-center text-[10px] text-white/20">
          Admin-only · STREAMS internal tooling
        </p>
      </div>
    </div>
  );
}
