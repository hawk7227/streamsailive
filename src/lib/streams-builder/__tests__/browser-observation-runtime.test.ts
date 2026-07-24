import { describe, expect, it } from "vitest";
import {
  assertBrowserClaimIsProven,
  createBrowserSessionRecord,
  finalizeBrowserEvidence,
  heartbeatBrowserSession,
  takeOverBrowserSession,
  type BrowserSessionRecord,
  type BrowserSessionStore,
} from "../browser-observation-runtime";

class MemoryBrowserSessionStore implements BrowserSessionStore {
  private readonly records = new Map<string, BrowserSessionRecord>();

  async create(record: BrowserSessionRecord) {
    this.records.set(record.sessionId, structuredClone(record));
  }

  async get(sessionId: string) {
    const record = this.records.get(sessionId);
    return record ? structuredClone(record) : null;
  }

  async compareAndSwap(sessionId: string, expectedGeneration: number, next: BrowserSessionRecord) {
    const current = this.records.get(sessionId);
    if (!current || current.lease.generation !== expectedGeneration) return false;
    this.records.set(sessionId, structuredClone(next));
    return true;
  }
}

function createRecord(nowMs = 1_000) {
  return createBrowserSessionRecord({
    jobId: "job-1",
    workspaceId: "workspace-1",
    ownerId: "worker-a",
    mode: "verify",
    route: "/streams",
    commitSha: "abc123",
    leaseTtlMs: 10_000,
  }, nowMs);
}

describe("browser observation runtime", () => {
  it("heartbeats an owned lease using compare-and-swap generation", async () => {
    const store = new MemoryBrowserSessionStore();
    const record = createRecord();
    await store.create(record);

    const updated = await heartbeatBrowserSession({
      store,
      sessionId: record.sessionId,
      ownerId: "worker-a",
      leaseTtlMs: 20_000,
      nowMs: 5_000,
    });

    expect(updated.lease.generation).toBe(2);
    expect(updated.lease.heartbeatAt).toBe(new Date(5_000).toISOString());
    expect(updated.lease.expiresAt).toBe(new Date(25_000).toISOString());
  });

  it("rejects takeover while a lease is active and permits takeover after expiration", async () => {
    const store = new MemoryBrowserSessionStore();
    const record = createRecord();
    await store.create(record);

    await expect(takeOverBrowserSession({
      store,
      sessionId: record.sessionId,
      nextOwnerId: "worker-b",
      nowMs: 5_000,
    })).rejects.toThrow("still active");

    const taken = await takeOverBrowserSession({
      store,
      sessionId: record.sessionId,
      nextOwnerId: "worker-b",
      nowMs: 12_000,
    });

    expect(taken.lease.ownerId).toBe("worker-b");
    expect(taken.mode).toBe("takeover");
  });

  it("marks evidence proven only when assertions pass and trace plus screenshot exist", () => {
    const record = createRecord();
    const proven = finalizeBrowserEvidence({
      ...record.evidence,
      assertions: [{ id: "route", description: "route matches", passed: true, evidenceUris: ["trace.zip"] }],
      artifacts: [
        { kind: "trace", uri: "trace.zip" },
        { kind: "screenshot", uri: "final.png" },
      ],
    });

    expect(proven.truthState).toBe("PROVEN");
    expect(() => assertBrowserClaimIsProven(proven, "the page works")).not.toThrow();
  });

  it("fails truth state for browser, console, network, or assertion failures", () => {
    const record = createRecord();
    const failed = finalizeBrowserEvidence({
      ...record.evidence,
      assertions: [{ id: "visible", description: "editor is visible", passed: false, evidenceUris: [] }],
      artifacts: [
        { kind: "trace", uri: "trace.zip" },
        { kind: "screenshot", uri: "final.png" },
      ],
      consoleEvents: [{ level: "error", text: "render failed" }],
    });

    expect(failed.truthState).toBe("FAILED");
    expect(() => assertBrowserClaimIsProven(failed, "the page works")).toThrow("browser evidence is FAILED");
  });
});
