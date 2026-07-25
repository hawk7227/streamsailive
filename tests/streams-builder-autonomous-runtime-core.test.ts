import { describe, expect, it } from "vitest";
import { applyAstPatchPlan, createAstSymbolPatchPlan } from "@/lib/streams-builder/ast-patch-engine";
import { DistributedRuntimeScheduler, type DistributedSchedulerStore, type ScheduledRuntime, type SchedulerAssignment, type SchedulerWorker } from "@/lib/streams-builder/distributed-runtime-scheduler";
import { buildIncrementalSemanticIndex, searchSemanticIndex } from "@/lib/streams-builder/semantic-code-index";
import type { RepositoryGraph } from "@/lib/streams-builder/repository-graph";

const source = `export function add(a: number, b: number) {\n  return a + b;\n}\n`;
const graph: RepositoryGraph = {
  root: "/repo",
  generatedAt: "2026-01-01T00:00:00.000Z",
  files: [{ path: "src/math.ts", sha256: "hash-1", bytes: source.length, language: "ts", tokens: ["add", "number"] }],
  symbols: [{ id: "src/math.ts:0:add", name: "add", kind: "FunctionDeclaration", file: "src/math.ts", start: 0, end: source.length - 1, exported: true }],
  dependencies: [],
  build: [],
  invertedIndex: {},
};

class MemorySchedulerStore implements DistributedSchedulerStore {
  queued = new Map<string, ScheduledRuntime>();
  workers = new Map<string, SchedulerWorker>();
  assignments: SchedulerAssignment[] = [];
  async listQueued() { return [...this.queued.values()].map((item) => structuredClone(item)); }
  async listWorkers() { return [...this.workers.values()].map((item) => structuredClone(item)); }
  async putQueued(item: ScheduledRuntime) { this.queued.set(item.runtimeId, structuredClone(item)); }
  async deleteQueued(id: string) { this.queued.delete(id); }
  async compareAndSwapWorker(id: string, expected: string[], next: SchedulerWorker) {
    const current = this.workers.get(id);
    if (!current || JSON.stringify(current.activeRuntimeIds) !== JSON.stringify(expected)) return false;
    this.workers.set(id, structuredClone(next));
    return true;
  }
  async putAssignment(assignment: SchedulerAssignment) { this.assignments.push(structuredClone(assignment)); }
}

describe("autonomous runtime core", () => {
  it("reuses unchanged semantic chunks and ranks exact symbols", async () => {
    const first = await buildIncrementalSemanticIndex({ graph, readSource: async () => source });
    const second = await buildIncrementalSemanticIndex({ graph, readSource: async () => { throw new Error("unchanged file should not be reread"); }, previous: first.index });
    expect(second.reusedChunks).toBeGreaterThan(0);
    expect(second.rebuiltChunks).toBe(0);
    expect(searchSemanticIndex(first.index, "add numbers")[0]?.symbolName).toBe("add");
  });

  it("plans and applies a syntax-valid symbol-bounded patch", () => {
    const replacement = `export function add(a: number, b: number) {\n  return Number(a) + Number(b);\n}`;
    const plan = createAstSymbolPatchPlan({ graph, file: "src/math.ts", sourceText: source, symbolName: "add", replacement, maxTouchedLines: 10 });
    const result = applyAstPatchPlan({ plan, sourceText: source });
    expect(result).toContain("Number(a)");
    expect(plan.operations).toHaveLength(1);
    expect(plan.preservesExports).toBe(true);
  });

  it("schedules compatible work with capacity isolation and priority", async () => {
    const store = new MemorySchedulerStore();
    store.workers.set("worker-a", { workerId: "worker-a", capabilities: ["node", "browser"], maxConcurrent: 1, activeRuntimeIds: [], heartbeatAt: "2026-01-01T00:00:00.000Z", expiresAt: "2026-01-01T01:00:00.000Z" });
    const scheduler = new DistributedRuntimeScheduler(store, 30_000);
    await scheduler.enqueue({ runtimeId: "batch", tenantId: "t1", projectId: "p1", priority: "batch", requiredCapabilities: ["node"], estimatedCost: 1, enqueuedAt: "2026-01-01T00:00:00.000Z" });
    await scheduler.enqueue({ runtimeId: "interactive", tenantId: "t2", projectId: "p2", priority: "interactive", requiredCapabilities: ["browser"], estimatedCost: 1, enqueuedAt: "2026-01-01T00:00:01.000Z" });
    const assignments = await scheduler.schedule(Date.parse("2026-01-01T00:10:00.000Z"), 10);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.runtimeId).toBe("interactive");
    expect(store.workers.get("worker-a")?.activeRuntimeIds).toEqual(["interactive"]);
  });
});
