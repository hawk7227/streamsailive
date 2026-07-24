import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { DurableRuntimeRecord, DurableRuntimeStore } from "./durable-orchestrator";
import type { WorkspaceStateStore, WorkspaceVersionedState } from "./production-runtime-services";

function safeId(value: string) {
  if (!/^[A-Za-z0-9_.-]+$/.test(value)) throw new Error("Invalid persistent store identifier.");
  return value;
}

async function readJson<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path, "utf8")) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function atomicWrite(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { encoding: "utf8", flag: "wx" });
  await rename(temporary, path);
}

export class AtomicFileDurableRuntimeStore implements DurableRuntimeStore {
  private readonly root: string;
  private readonly locks = new Map<string, Promise<void>>();
  constructor(root = process.env.STREAMS_RUNTIME_STORE_DIR || "/tmp/streams-runtime-store") { this.root = resolve(root, "runtimes"); }
  private path(id: string) { return join(this.root, `${safeId(id)}.json`); }
  private async exclusive<T>(id: string, action: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(id) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolveLock) => { release = resolveLock; });
    this.locks.set(id, previous.then(() => next));
    await previous;
    try { return await action(); }
    finally { release(); if (this.locks.get(id) === next) this.locks.delete(id); }
  }
  async create(record: DurableRuntimeRecord) {
    await this.exclusive(record.runtimeId, async () => {
      if (await this.get(record.runtimeId)) throw new Error("Runtime already exists.");
      await atomicWrite(this.path(record.runtimeId), record);
    });
  }
  async get(runtimeId: string) { return readJson<DurableRuntimeRecord>(this.path(runtimeId)); }
  async compareAndSwap(runtimeId: string, expectedVersion: number, next: DurableRuntimeRecord) {
    return this.exclusive(runtimeId, async () => {
      const current = await this.get(runtimeId);
      if (!current || current.version !== expectedVersion) return false;
      await atomicWrite(this.path(runtimeId), next);
      return true;
    });
  }
}

export class AtomicFileWorkspaceStateStore implements WorkspaceStateStore {
  private readonly root: string;
  private readonly locks = new Map<string, Promise<void>>();
  constructor(root = process.env.STREAMS_RUNTIME_STORE_DIR || "/tmp/streams-runtime-store") { this.root = resolve(root, "workspaces"); }
  private path(id: string) { return join(this.root, `${safeId(id)}.json`); }
  private async exclusive<T>(id: string, action: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(id) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolveLock) => { release = resolveLock; });
    this.locks.set(id, previous.then(() => next));
    await previous;
    try { return await action(); }
    finally { release(); }
  }
  async create(state: WorkspaceVersionedState) {
    await this.exclusive(state.workspaceId, async () => {
      if (await this.get(state.workspaceId)) throw new Error("Workspace state already exists.");
      await atomicWrite(this.path(state.workspaceId), state);
    });
  }
  async get(workspaceId: string) { return readJson<WorkspaceVersionedState>(this.path(workspaceId)); }
  async compareAndSwap(workspaceId: string, expectedGeneration: number, next: WorkspaceVersionedState) {
    return this.exclusive(workspaceId, async () => {
      const current = await this.get(workspaceId);
      if (!current || current.generation !== expectedGeneration) return false;
      await atomicWrite(this.path(workspaceId), next);
      return true;
    });
  }
}
