import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckResult = {
  id: string;
  status: "passed" | "failed" | "blocked" | "not_tested";
  detail: string;
  evidence?: Record<string, unknown>;
};

function configured(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function safeUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } finally {
    clearTimeout(timer);
  }
}

function authorized(request: NextRequest): boolean {
  const expected = configured("STREAMS_COMMISSIONING_TOKEN");
  if (!expected) return false;
  const supplied = request.headers.get("x-streams-commissioning-token")?.trim();
  return Boolean(supplied && supplied === expected);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "status");
  const tenantId = String(body.tenantId || "streams-commissioning");
  const projectId = String(body.projectId || "infrastructure");
  const results: CheckResult[] = [];

  const workerUrl = configured("STREAMS_BUILDER_WORKER_URL");
  const workerToken = configured("STREAMS_BUILDER_WORKER_TOKEN");
  const gatewayUrl = configured("STREAMS_PROVIDER_GATEWAY_URL");
  const gatewayToken = configured("STREAMS_PROVIDER_GATEWAY_TOKEN");

  if (!workerUrl || !workerToken) {
    results.push({
      id: "builder-worker-config",
      status: "blocked",
      detail: "STREAMS_BUILDER_WORKER_URL and STREAMS_BUILDER_WORKER_TOKEN must be configured in Vercel.",
    });
  } else {
    try {
      const { response, payload } = await fetchJson(`${safeUrl(workerUrl)}/health`, { method: "GET" });
      results.push({
        id: "builder-worker-health",
        status: response.ok && payload?.ok ? "passed" : "failed",
        detail: response.ok && payload?.ok ? "Builder Worker is reachable and workspace is writable." : "Builder Worker health check failed.",
        evidence: {
          httpStatus: response.status,
          service: payload?.service ?? null,
          version: payload?.version ?? null,
          workspaceWritable: payload?.workspaceWritable ?? null,
          authConfigured: payload?.authConfigured ?? null,
          uptimeSeconds: payload?.uptimeSeconds ?? null,
        },
      });
    } catch (error) {
      results.push({ id: "builder-worker-health", status: "failed", detail: error instanceof Error ? error.message : "Builder Worker request failed." });
    }

    if (action === "persistence_start" || action === "full") {
      try {
        const { response, payload } = await fetchJson(`${safeUrl(workerUrl)}/v1/commission`, {
          method: "POST",
          headers: { authorization: `Bearer ${workerToken}`, "content-type": "application/json" },
          body: JSON.stringify({ tenantId, projectId, phase: "write" }),
        });
        results.push({
          id: "builder-persistence-write",
          status: response.ok && payload?.ok ? "passed" : "failed",
          detail: response.ok && payload?.ok ? "Persistence probe was written and patched. Restart the Builder Worker, then run persistence_check." : "Persistence probe write failed.",
          evidence: {
            httpStatus: response.status,
            nonce: payload?.nonce ?? null,
            probePath: payload?.persistenceProbePath ?? null,
          },
        });
      } catch (error) {
        results.push({ id: "builder-persistence-write", status: "failed", detail: error instanceof Error ? error.message : "Persistence write failed." });
      }
    }

    if (action === "persistence_check") {
      const expectedNonce = String(body.expectedNonce || "").trim();
      if (!expectedNonce) {
        results.push({ id: "builder-persistence-restart", status: "blocked", detail: "expectedNonce is required for persistence_check." });
      } else {
        try {
          const { response, payload } = await fetchJson(`${safeUrl(workerUrl)}/v1/commission`, {
            method: "POST",
            headers: { authorization: `Bearer ${workerToken}`, "content-type": "application/json" },
            body: JSON.stringify({ tenantId, projectId, phase: "check", expectedNonce }),
          });
          results.push({
            id: "builder-persistence-restart",
            status: response.ok && payload?.persistedAcrossRestart ? "passed" : "failed",
            detail: response.ok && payload?.persistedAcrossRestart ? "Workspace data persisted across the service restart." : "The persistence probe did not survive the restart.",
            evidence: { httpStatus: response.status, probePath: payload?.persistenceProbePath ?? null },
          });
        } catch (error) {
          results.push({ id: "builder-persistence-restart", status: "failed", detail: error instanceof Error ? error.message : "Persistence check failed." });
        }
      }
    }
  }

  if (!gatewayUrl || !gatewayToken) {
    results.push({
      id: "provider-gateway-config",
      status: "blocked",
      detail: "STREAMS_PROVIDER_GATEWAY_URL and STREAMS_PROVIDER_GATEWAY_TOKEN must be configured in Vercel.",
    });
  } else {
    try {
      const { response, payload } = await fetchJson(`${safeUrl(gatewayUrl)}/health`, {
        method: "GET",
        headers: { authorization: `Bearer ${gatewayToken}` },
      });
      const providers = Array.isArray(payload?.providers) ? payload.providers : [];
      results.push({
        id: "provider-gateway-health",
        status: response.ok && payload?.ok ? "passed" : "failed",
        detail: response.ok && payload?.ok ? "Provider Gateway is reachable and authenticated." : "Provider Gateway health check failed.",
        evidence: {
          httpStatus: response.status,
          service: payload?.service ?? null,
          version: payload?.version ?? null,
          providers: providers.map((provider: Record<string, unknown>) => ({
            provider: provider.provider,
            configured: provider.configured,
            transport: provider.transport,
            adapterConfigured: provider.adapterConfigured,
          })),
          rateLimit: payload?.rateLimit ?? null,
        },
      });
    } catch (error) {
      results.push({ id: "provider-gateway-health", status: "failed", detail: error instanceof Error ? error.message : "Provider Gateway request failed." });
    }
  }

  const environmentChecks = [
    ["github", Boolean(configured("GITHUB_TOKEN") || configured("GH_TOKEN"))],
    ["vercel", Boolean(configured("VERCEL_TOKEN") && configured("VERCEL_PROJECT_ID"))],
    ["supabase", Boolean(configured("SUPABASE_URL") && configured("SUPABASE_SERVICE_ROLE_KEY"))],
    ["credential-encryption", Boolean(configured("STREAMS_CREDENTIAL_KEY"))],
    ["connector-encryption", Boolean(configured("CONNECTOR_ENCRYPTION_KEY"))],
  ] as const;

  for (const [id, isConfigured] of environmentChecks) {
    results.push({
      id,
      status: isConfigured ? "not_tested" : "blocked",
      detail: isConfigured ? "Credentials are configured; an authenticated operation has not yet been exercised by this endpoint." : "Required credentials are missing from the Vercel control plane.",
    });
  }

  const passed = results.filter((result) => result.status === "passed").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const blocked = results.filter((result) => result.status === "blocked").length;

  return NextResponse.json({
    ok: failed === 0 && blocked === 0,
    action,
    testedAt: new Date().toISOString(),
    summary: { passed, failed, blocked, notTested: results.length - passed - failed - blocked },
    results,
  });
}
