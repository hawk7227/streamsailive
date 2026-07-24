import { describe, expect, it } from "vitest";
import {
  createIncrementalVerificationPlan,
  createWorkspaceState,
  diagnoseRepairFailure,
  routeBuilderModel,
  summarizeRuntimeBenchmark,
  synchronizeWorkspaceState,
  type WorkspaceStateStore,
  type WorkspaceVersionedState,
} from "@/lib/streams-builder/production-runtime-services";

class MemoryWorkspaceStateStore implements WorkspaceStateStore {
  private records = new Map<string, WorkspaceVersionedState>();
  async get(id: string) { return this.records.get(id) ?? null; }
  async create(state: WorkspaceVersionedState) { this.records.set(state.workspaceId, structuredClone(state)); }
  async compareAndSwap(id: string, generation: number, next: WorkspaceVersionedState) {
    const current = this.records.get(id);
    if (!current || current.generation !== generation) return false;
    this.records.set(id, structuredClone(next));
    return true;
  }
}

describe("production runtime services", () => {
  it("routes high-risk repair work to a deep tool-capable model", () => {
    const selected = routeBuilderModel({ task: "repair", estimatedInputTokens: 20_000, requiresTools: true, risk: "high" }, [
      { id: "fast", tier: "fast", maxContextTokens: 64_000, supportsTools: true, supportsVision: false, costWeight: 1, latencyWeight: 1 },
      { id: "deep", tier: "deep", maxContextTokens: 128_000, supportsTools: true, supportsVision: true, costWeight: 5, latencyWeight: 5 },
    ]);
    expect(selected.id).toBe("deep");
  });

  it("plans only relevant incremental verification stages", () => {
    const plan = createIncrementalVerificationPlan({
      changedFiles: ["src/components/streams-builder/Panel.tsx"],
      affectedFiles: ["src/app/streams-ai/streams-builder/page.tsx"],
      hasFrontendChanges: true,
      deploymentRequested: false,
    });
    expect(plan.find((stage) => stage.stage === "browser")?.required).toBe(true);
    expect(plan.find((stage) => stage.stage === "deployment")?.required).toBe(false);
  });

  it("synchronizes workspace revisions with compare-and-swap generations", async () => {
    const store = new MemoryWorkspaceStateStore();
    const initial = createWorkspaceState("workspace-1", "2026-01-01T00:00:00.000Z");
    await store.create(initial);
    const next = await synchronizeWorkspaceState({ store, workspaceId: "workspace-1", expectedGeneration: 1, patch: { codeRevision: "abc", previewRevision: "preview-abc", steeringRevision: 1 } });
    expect(next.generation).toBe(2);
    expect(next.codeRevision).toBe("abc");
    await expect(synchronizeWorkspaceState({ store, workspaceId: "workspace-1", expectedGeneration: 1, patch: { gitRevision: "stale" } })).rejects.toThrow("generation conflict");
  });

  it("stops repeated bounded repair attempts with the same fingerprint", () => {
    const first = diagnoseRepairFailure({ command: "pnpm typecheck", stderr: "error TS2322: Type string is not assignable" });
    const repeated = diagnoseRepairFailure({ command: "pnpm typecheck", stderr: "error TS2322: Type string is not assignable", priorFingerprints: [first.fingerprint] });
    expect(first.category).toBe("type");
    expect(first.retryable).toBe(true);
    expect(repeated.retryable).toBe(false);
    expect(repeated.boundedActions).toEqual([]);
  });

  it("summarizes benchmark correctness latency repair and hallucination rates", () => {
    const summary = summarizeRuntimeBenchmark([
      { latencyMs: 10, success: true, repaired: false, hallucination: false },
      { latencyMs: 20, success: true, repaired: true, hallucination: false },
      { latencyMs: 100, success: false, repaired: false, hallucination: true },
    ]);
    expect(summary.count).toBe(3);
    expect(summary.successRate).toBeCloseTo(2 / 3);
    expect(summary.hallucinationRate).toBeCloseTo(1 / 3);
    expect(summary.latencyMs.p95).toBe(100);
  });
});
