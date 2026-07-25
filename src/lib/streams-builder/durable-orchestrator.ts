import { randomUUID } from "node:crypto";

export type RuntimeStage = "plan" | "index" | "patch" | "verify" | "browser" | "deploy" | "complete";
export type RuntimeStatus = "queued" | "running" | "paused" | "failed" | "completed" | "cancelled";

export interface RuntimeLease {
  ownerId: string;
  leaseId: string;
  generation: number;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
}

export interface RuntimeCheckpoint {
  id: string;
  stage: RuntimeStage;
  attempt: number;
  createdAt: string;
  inputDigest: string;
  output: Record<string, unknown>;
  evidenceUris: string[];
}

export interface RuntimeCommand {
  id: string;
  createdAt: string;
  type: "pause" | "resume" | "cancel" | "steer";
  actorId: string;
  payload?: Record<string, unknown>;
  consumedAt?: string;
}

export interface DurableRuntimeRecord {
  runtimeId: string;
  projectId: string;
  workspaceId: string;
  jobId: string;
  status: RuntimeStatus;
  stage: RuntimeStage;
  stageAttempt: number;
  lease: RuntimeLease | null;
  checkpoints: RuntimeCheckpoint[];
  commands: RuntimeCommand[];
  version: number;
  createdAt: string;
  updatedAt: string;
  failure?: { stage: RuntimeStage; message: string; retryable: boolean; occurredAt: string };
}

export interface DurableRuntimeStore {
  create(record: DurableRuntimeRecord): Promise<void>;
  get(runtimeId: string): Promise<DurableRuntimeRecord | null>;
  compareAndSwap(runtimeId: string, expectedVersion: number, next: DurableRuntimeRecord): Promise<boolean>;
}

const iso = (nowMs: number) => new Date(nowMs).toISOString();
const DEFAULT_TTL_MS = 30_000;

export function createDurableRuntime(input: { projectId: string; workspaceId: string; jobId: string }, nowMs = Date.now()): DurableRuntimeRecord {
  const now = iso(nowMs);
  return {
    runtimeId: randomUUID(),
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    jobId: input.jobId,
    status: "queued",
    stage: "plan",
    stageAttempt: 0,
    lease: null,
    checkpoints: [],
    commands: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export async function claimRuntime(input: { store: DurableRuntimeStore; runtimeId: string; ownerId: string; ttlMs?: number; nowMs?: number; force?: boolean }): Promise<DurableRuntimeRecord> {
  const nowMs = input.nowMs ?? Date.now();
  const current = await input.store.get(input.runtimeId);
  if (!current) throw new Error("Runtime not found.");
  const active = Boolean(current.lease && Date.parse(current.lease.expiresAt) > nowMs);
  if (active && current.lease?.ownerId !== input.ownerId && !input.force) throw new Error("Runtime is leased by another worker.");
  const next: DurableRuntimeRecord = {
    ...current,
    status: current.status === "queued" || current.status === "paused" ? "running" : current.status,
    lease: {
      ownerId: input.ownerId,
      leaseId: randomUUID(),
      generation: (current.lease?.generation ?? 0) + 1,
      acquiredAt: iso(nowMs),
      heartbeatAt: iso(nowMs),
      expiresAt: iso(nowMs + Math.max(5_000, input.ttlMs ?? DEFAULT_TTL_MS)),
    },
    version: current.version + 1,
    updatedAt: iso(nowMs),
  };
  if (!await input.store.compareAndSwap(current.runtimeId, current.version, next)) throw new Error("Runtime changed while claiming.");
  return next;
}

export async function heartbeatRuntime(input: { store: DurableRuntimeStore; runtimeId: string; ownerId: string; ttlMs?: number; nowMs?: number }): Promise<DurableRuntimeRecord> {
  const nowMs = input.nowMs ?? Date.now();
  const current = await input.store.get(input.runtimeId);
  if (!current?.lease || current.lease.ownerId !== input.ownerId || Date.parse(current.lease.expiresAt) <= nowMs) throw new Error("Runtime lease is missing, expired, or owned by another worker.");
  const next: DurableRuntimeRecord = {
    ...current,
    lease: {
      ...current.lease,
      generation: current.lease.generation + 1,
      heartbeatAt: iso(nowMs),
      expiresAt: iso(nowMs + Math.max(5_000, input.ttlMs ?? DEFAULT_TTL_MS)),
    },
    version: current.version + 1,
    updatedAt: iso(nowMs),
  };
  if (!await input.store.compareAndSwap(current.runtimeId, current.version, next)) throw new Error("Runtime changed while heartbeating.");
  return next;
}

export async function appendRuntimeCommand(input: { store: DurableRuntimeStore; runtimeId: string; actorId: string; type: RuntimeCommand["type"]; payload?: Record<string, unknown>; nowMs?: number }): Promise<DurableRuntimeRecord> {
  const nowMs = input.nowMs ?? Date.now();
  const current = await input.store.get(input.runtimeId);
  if (!current) throw new Error("Runtime not found.");
  const command: RuntimeCommand = {
    id: randomUUID(),
    createdAt: iso(nowMs),
    actorId: input.actorId,
    type: input.type,
    ...(input.payload ? { payload: input.payload } : {}),
  };
  const next: DurableRuntimeRecord = {
    ...current,
    commands: [...current.commands, command],
    version: current.version + 1,
    updatedAt: iso(nowMs),
  };
  if (!await input.store.compareAndSwap(current.runtimeId, current.version, next)) throw new Error("Runtime changed while appending command.");
  return next;
}

export function nextPendingCommand(record: DurableRuntimeRecord): RuntimeCommand | null {
  return record.commands.find((command) => !command.consumedAt) ?? null;
}

export async function consumeRuntimeCommand(input: { store: DurableRuntimeStore; runtimeId: string; ownerId: string; commandId: string; nowMs?: number }): Promise<DurableRuntimeRecord> {
  const nowMs = input.nowMs ?? Date.now();
  const current = await input.store.get(input.runtimeId);
  if (!current?.lease || current.lease.ownerId !== input.ownerId) throw new Error("Runtime command consumer does not own the lease.");
  const command = current.commands.find((item) => item.id === input.commandId);
  if (!command || command.consumedAt) throw new Error("Runtime command is missing or already consumed.");
  const commands: RuntimeCommand[] = current.commands.map((item) => item.id === command.id ? { ...item, consumedAt: iso(nowMs) } : item);
  let status: RuntimeStatus = current.status;
  if (command.type === "pause") status = "paused";
  if (command.type === "resume") status = "running";
  if (command.type === "cancel") status = "cancelled";
  const next: DurableRuntimeRecord = { ...current, commands, status, version: current.version + 1, updatedAt: iso(nowMs) };
  if (!await input.store.compareAndSwap(current.runtimeId, current.version, next)) throw new Error("Runtime changed while consuming command.");
  return next;
}

export async function checkpointStage(input: { store: DurableRuntimeStore; runtimeId: string; ownerId: string; stage: RuntimeStage; inputDigest: string; output: Record<string, unknown>; evidenceUris?: string[]; nowMs?: number }): Promise<DurableRuntimeRecord> {
  const nowMs = input.nowMs ?? Date.now();
  const current = await input.store.get(input.runtimeId);
  if (!current?.lease || current.lease.ownerId !== input.ownerId || Date.parse(current.lease.expiresAt) <= nowMs) throw new Error("Cannot checkpoint without an active owned lease.");
  const checkpoint: RuntimeCheckpoint = {
    id: randomUUID(),
    stage: input.stage,
    attempt: current.stage === input.stage ? current.stageAttempt + 1 : 1,
    createdAt: iso(nowMs),
    inputDigest: input.inputDigest,
    output: input.output,
    evidenceUris: input.evidenceUris ?? [],
  };
  const { failure: _failure, ...withoutFailure } = current;
  const next: DurableRuntimeRecord = {
    ...withoutFailure,
    stage: input.stage,
    stageAttempt: checkpoint.attempt,
    checkpoints: [...current.checkpoints, checkpoint],
    version: current.version + 1,
    updatedAt: iso(nowMs),
  };
  if (!await input.store.compareAndSwap(current.runtimeId, current.version, next)) throw new Error("Runtime changed while checkpointing.");
  return next;
}

export function resumePoint(record: DurableRuntimeRecord): { stage: RuntimeStage; checkpoint: RuntimeCheckpoint | null } {
  const last = record.checkpoints.at(-1) ?? null;
  if (!last) return { stage: "plan", checkpoint: null };
  const order: RuntimeStage[] = ["plan", "index", "patch", "verify", "browser", "deploy", "complete"];
  const next = order[Math.min(order.indexOf(last.stage) + 1, order.length - 1)] ?? "complete";
  return { stage: next, checkpoint: last };
}

export async function failRuntime(input: { store: DurableRuntimeStore; runtimeId: string; ownerId: string; message: string; retryable: boolean; nowMs?: number }): Promise<DurableRuntimeRecord> {
  const nowMs = input.nowMs ?? Date.now();
  const current = await input.store.get(input.runtimeId);
  if (!current?.lease || current.lease.ownerId !== input.ownerId) throw new Error("Cannot fail a runtime without owning it.");
  const next: DurableRuntimeRecord = {
    ...current,
    status: "failed",
    failure: { stage: current.stage, message: input.message, retryable: input.retryable, occurredAt: iso(nowMs) },
    lease: null,
    version: current.version + 1,
    updatedAt: iso(nowMs),
  };
  if (!await input.store.compareAndSwap(current.runtimeId, current.version, next)) throw new Error("Runtime changed while recording failure.");
  return next;
}

export async function completeRuntime(input: { store: DurableRuntimeStore; runtimeId: string; ownerId: string; nowMs?: number }): Promise<DurableRuntimeRecord> {
  const nowMs = input.nowMs ?? Date.now();
  const current = await input.store.get(input.runtimeId);
  if (!current?.lease || current.lease.ownerId !== input.ownerId) throw new Error("Cannot complete a runtime without owning it.");
  const next: DurableRuntimeRecord = {
    ...current,
    status: "completed",
    stage: "complete",
    lease: null,
    version: current.version + 1,
    updatedAt: iso(nowMs),
  };
  if (!await input.store.compareAndSwap(current.runtimeId, current.version, next)) throw new Error("Runtime changed while completing.");
  return next;
}
