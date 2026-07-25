import { describe, expect, it } from "vitest";
import { AdaptiveModelRouter, ExecutionTrace, transact, truthGate, verifyDeployment, type TransactionalStore, type VersionedRecord } from "@/lib/streams-builder/autonomous-runtime-completion";

describe("autonomous runtime completion", () => {
  it("routes around unhealthy providers", () => {
    const router = new AdaptiveModelRouter([
      { provider: "a", model: "fast", available: true, quality: 0.8, latencyMs: 100, costPerMillionTokens: 1, failures: 0 },
      { provider: "b", model: "best", available: true, quality: 0.95, latencyMs: 300, costPerMillionTokens: 2, failures: 0 },
      { provider: "c", model: "open-circuit", available: true, quality: 1, latencyMs: 10, costPerMillionTokens: 0.1, failures: 0, circuitOpenUntil: Date.now() + 60_000 },
    ]);
    expect(router.route({ task: "coding", contextTokens: 20_000, minimumQuality: 0.9 }).model).toBe("best");
  });

  it("records explainable evidence-backed traces", () => {
    const trace = new ExecutionTrace();
    trace.append({ stage: "verify", action: "typecheck", reason: "changed exported type", input: { files: ["a.ts"] }, outputDigest: "ok", evidence: [{ kind: "log", uri: "evidence://typecheck", sha256: "abc", createdAt: new Date().toISOString() }] });
    expect(trace.verifyClaim("verify", "typecheck").evidence).toHaveLength(1);
    expect(trace.explain()).toContain("changed exported type");
  });

  it("verifies deployment commit, URL and health", async () => {
    const result = await verifyDeployment({
      async deploy() { return { deploymentId: "dep-1", url: "https://example.test" }; },
      async inspect() { return { status: "ready", commitSha: "abc", url: "https://example.test" }; },
      async fetch() { return { status: 200, body: "healthy" }; },
    }, { provider: "test", projectId: "p", commitSha: "abc", expectedUrl: "https://example.test" });
    expect(result.evidence).toHaveLength(1);
    expect(result.healthStatus).toBe(200);
  });

  it("retries compare-and-swap transactions", async () => {
    let record: VersionedRecord<{ count: number }> = { key: "k", version: 1, value: { count: 0 } };
    let conflict = true;
    const store: TransactionalStore<{ count: number }> = {
      async get() { return structuredClone(record); },
      async create(next) { record = next; },
      async compareAndSwap(_key, expected, next) {
        if (conflict) { conflict = false; record = { ...record, version: record.version + 1 }; return false; }
        if (record.version !== expected) return false;
        record = structuredClone(next); return true;
      },
    };
    const next = await transact(store, "k", (value) => ({ count: value.count + 1 }));
    expect(next.value.count).toBe(1);
  });

  it("fails closed without required evidence", () => {
    expect(() => truthGate({ buildPassed: true, testsPassed: true, typecheckPassed: true, lintPassed: true, browserRequired: true, deploymentRequired: false })).toThrow("browser evidence");
  });
});
