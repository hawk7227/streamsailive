import { describe, expect, it } from "vitest";
import {
  appendRuntimeCommand,
  claimRuntime,
  createDurableRuntime,
  type DurableRuntimeRecord,
  type DurableRuntimeStore,
} from "@/lib/streams-builder/durable-orchestrator";
import { executeDurableRuntime } from "@/lib/streams-builder/runtime-stage-executor";

class MemoryRuntimeStore implements DurableRuntimeStore {
  private records = new Map<string, DurableRuntimeRecord>();
  async create(record: DurableRuntimeRecord) { this.records.set(record.runtimeId, structuredClone(record)); }
  async get(id: string) { const record = this.records.get(id); return record ? structuredClone(record) : null; }
  async compareAndSwap(id: string, version: number, next: DurableRuntimeRecord) {
    const current = this.records.get(id);
    if (!current || current.version !== version) return false;
    this.records.set(id, structuredClone(next));
    return true;
  }
}

describe("runtime stage executor", () => {
  it("resumes, consumes steering, checkpoints every stage, and completes", async () => {
    const store = new MemoryRuntimeStore();
    const now = Date.now();
    const created = createDurableRuntime({ projectId: "project", workspaceId: "workspace", jobId: "job" }, now);
    await store.create(created);
    await claimRuntime({ store, runtimeId: created.runtimeId, ownerId: "worker", nowMs: now + 1, ttlMs: 60_000 });
    await appendRuntimeCommand({ store, runtimeId: created.runtimeId, actorId: "user", type: "steer", payload: { instruction: "preserve API" }, nowMs: now + 2 });

    const seenSteering: Record<string, unknown>[][] = [];
    const handler = async ({ steering }: { steering: Record<string, unknown>[] }) => {
      seenSteering.push(steering);
      return { output: { ok: true }, evidenceUris: ["evidence://stage"] };
    };

    const result = await executeDurableRuntime({
      store,
      runtimeId: created.runtimeId,
      ownerId: "worker",
      heartbeatIntervalMs: 60_000,
      handlers: { plan: handler, index: handler, patch: handler, verify: handler, browser: handler, deploy: handler },
    });

    expect(result.status).toBe("completed");
    expect(result.stage).toBe("complete");
    expect(result.checkpoints.map((checkpoint) => checkpoint.stage)).toEqual(["plan", "index", "patch", "verify", "browser", "deploy"]);
    expect(seenSteering[0]).toEqual([{ instruction: "preserve API" }]);
  });

  it("fails closed when a required stage handler is missing", async () => {
    const store = new MemoryRuntimeStore();
    const created = createDurableRuntime({ projectId: "project", workspaceId: "workspace", jobId: "job" });
    await store.create(created);
    await claimRuntime({ store, runtimeId: created.runtimeId, ownerId: "worker", ttlMs: 60_000 });

    const result = await executeDurableRuntime({ store, runtimeId: created.runtimeId, ownerId: "worker", heartbeatIntervalMs: 60_000, handlers: {} });
    expect(result.status).toBe("failed");
    expect(result.failure?.message).toContain("No runtime handler");
  });
});
