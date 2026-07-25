import { describe, expect, it } from "vitest";
import {
  appendRuntimeCommand,
  checkpointStage,
  claimRuntime,
  consumeRuntimeCommand,
  createDurableRuntime,
  heartbeatRuntime,
  nextPendingCommand,
  resumePoint,
  type DurableRuntimeRecord,
  type DurableRuntimeStore,
} from "@/lib/streams-builder/durable-orchestrator";

class MemoryStore implements DurableRuntimeStore {
  private records = new Map<string, DurableRuntimeRecord>();
  async create(record: DurableRuntimeRecord) { this.records.set(record.runtimeId, structuredClone(record)); }
  async get(runtimeId: string) { const record = this.records.get(runtimeId); return record ? structuredClone(record) : null; }
  async compareAndSwap(runtimeId: string, expectedVersion: number, next: DurableRuntimeRecord) {
    const current = this.records.get(runtimeId); if (!current || current.version !== expectedVersion) return false;
    this.records.set(runtimeId, structuredClone(next)); return true;
  }
}

describe("durable runtime orchestration", () => {
  it("claims, heartbeats, checkpoints, and resumes from the next exact stage", async () => {
    const store = new MemoryStore(); const runtime = createDurableRuntime({ projectId: "p", workspaceId: "w", jobId: "j" }, 1_000); await store.create(runtime);
    await claimRuntime({ store, runtimeId: runtime.runtimeId, ownerId: "worker-a", nowMs: 2_000, ttlMs: 10_000 });
    await heartbeatRuntime({ store, runtimeId: runtime.runtimeId, ownerId: "worker-a", nowMs: 3_000, ttlMs: 10_000 });
    const checkpointed = await checkpointStage({ store, runtimeId: runtime.runtimeId, ownerId: "worker-a", stage: "index", inputDigest: "sha", output: { graph: "uri" }, evidenceUris: ["graph.json"], nowMs: 4_000 });
    expect(resumePoint(checkpointed)).toMatchObject({ stage: "patch" });
    expect(checkpointed.checkpoints.at(-1)?.evidenceUris).toEqual(["graph.json"]);
  });

  it("prevents active lease theft and permits expiry takeover", async () => {
    const store = new MemoryStore(); const runtime = createDurableRuntime({ projectId: "p", workspaceId: "w", jobId: "j" }, 1_000); await store.create(runtime);
    await claimRuntime({ store, runtimeId: runtime.runtimeId, ownerId: "worker-a", nowMs: 2_000, ttlMs: 5_000 });
    await expect(claimRuntime({ store, runtimeId: runtime.runtimeId, ownerId: "worker-b", nowMs: 3_000 })).rejects.toThrow("another worker");
    const taken = await claimRuntime({ store, runtimeId: runtime.runtimeId, ownerId: "worker-b", nowMs: 8_000 });
    expect(taken.lease?.ownerId).toBe("worker-b");
  });

  it("accepts live steering commands and consumes each command once", async () => {
    const store = new MemoryStore(); const runtime = createDurableRuntime({ projectId: "p", workspaceId: "w", jobId: "j" }, 1_000); await store.create(runtime);
    await claimRuntime({ store, runtimeId: runtime.runtimeId, ownerId: "worker-a", nowMs: 2_000 });
    const commanded = await appendRuntimeCommand({ store, runtimeId: runtime.runtimeId, actorId: "user", type: "steer", payload: { instruction: "preserve API" }, nowMs: 3_000 });
    const command = nextPendingCommand(commanded); expect(command?.payload).toEqual({ instruction: "preserve API" });
    const consumed = await consumeRuntimeCommand({ store, runtimeId: runtime.runtimeId, ownerId: "worker-a", commandId: command!.id, nowMs: 4_000 });
    expect(nextPendingCommand(consumed)).toBeNull();
    await expect(consumeRuntimeCommand({ store, runtimeId: runtime.runtimeId, ownerId: "worker-a", commandId: command!.id, nowMs: 5_000 })).rejects.toThrow("already consumed");
  });
});
