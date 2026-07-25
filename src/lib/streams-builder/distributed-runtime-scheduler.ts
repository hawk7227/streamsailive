import { randomUUID } from "node:crypto";

export type SchedulerPriority = "interactive" | "normal" | "batch";
export interface ScheduledRuntime {
  runtimeId: string;
  tenantId: string;
  projectId: string;
  priority: SchedulerPriority;
  requiredCapabilities: string[];
  estimatedCost: number;
  enqueuedAt: string;
  attempt: number;
}
export interface SchedulerWorker {
  workerId: string;
  capabilities: string[];
  maxConcurrent: number;
  activeRuntimeIds: string[];
  heartbeatAt: string;
  expiresAt: string;
}
export interface SchedulerAssignment {
  assignmentId: string;
  runtimeId: string;
  workerId: string;
  assignedAt: string;
  leaseExpiresAt: string;
}
export interface DistributedSchedulerStore {
  listQueued(): Promise<ScheduledRuntime[]>;
  listWorkers(): Promise<SchedulerWorker[]>;
  putQueued(item: ScheduledRuntime): Promise<void>;
  deleteQueued(runtimeId: string): Promise<void>;
  compareAndSwapWorker(workerId: string, expectedActiveRuntimeIds: string[], next: SchedulerWorker): Promise<boolean>;
  putAssignment(assignment: SchedulerAssignment): Promise<void>;
}

const PRIORITY_WEIGHT: Record<SchedulerPriority, number> = { interactive: 100, normal: 10, batch: 1 };
function compatible(job: ScheduledRuntime, worker: SchedulerWorker) {
  const capabilities = new Set(worker.capabilities);
  return job.requiredCapabilities.every((capability) => capabilities.has(capability));
}
function active(worker: SchedulerWorker, nowMs: number) {
  return Date.parse(worker.expiresAt) > nowMs && worker.activeRuntimeIds.length < worker.maxConcurrent;
}
function fairnessPenalty(job: ScheduledRuntime, tenantAssignments: Map<string, number>) {
  return (tenantAssignments.get(job.tenantId) ?? 0) * 25;
}
function score(job: ScheduledRuntime, nowMs: number, tenantAssignments: Map<string, number>) {
  const ageSeconds = Math.max(0, (nowMs - Date.parse(job.enqueuedAt)) / 1000);
  return PRIORITY_WEIGHT[job.priority] + Math.min(ageSeconds, 300) - fairnessPenalty(job, tenantAssignments) - Math.max(0, job.estimatedCost - 1);
}

export class DistributedRuntimeScheduler {
  constructor(private readonly store: DistributedSchedulerStore, private readonly leaseMs = 30_000) {}

  async enqueue(input: Omit<ScheduledRuntime, "enqueuedAt" | "attempt"> & { enqueuedAt?: string; attempt?: number }) {
    const item: ScheduledRuntime = { ...input, enqueuedAt: input.enqueuedAt ?? new Date().toISOString(), attempt: input.attempt ?? 0 };
    await this.store.putQueued(item);
    return item;
  }

  async schedule(nowMs = Date.now(), maxAssignments = 100): Promise<SchedulerAssignment[]> {
    const queued = await this.store.listQueued();
    const workers = (await this.store.listWorkers()).filter((worker) => active(worker, nowMs));
    const assignments: SchedulerAssignment[] = [];
    const tenantAssignments = new Map<string, number>();
    const ordered = [...queued].sort((a, b) => score(b, nowMs, tenantAssignments) - score(a, nowMs, tenantAssignments) || a.enqueuedAt.localeCompare(b.enqueuedAt));

    for (const job of ordered) {
      if (assignments.length >= maxAssignments) break;
      const candidates = workers
        .filter((worker) => compatible(job, worker) && worker.activeRuntimeIds.length < worker.maxConcurrent)
        .sort((a, b) => (a.activeRuntimeIds.length / a.maxConcurrent) - (b.activeRuntimeIds.length / b.maxConcurrent) || a.workerId.localeCompare(b.workerId));
      const worker = candidates[0];
      if (!worker) continue;
      const previous = [...worker.activeRuntimeIds];
      const next: SchedulerWorker = { ...worker, activeRuntimeIds: [...worker.activeRuntimeIds, job.runtimeId] };
      const claimed = await this.store.compareAndSwapWorker(worker.workerId, previous, next);
      if (!claimed) continue;
      worker.activeRuntimeIds = next.activeRuntimeIds;
      const assignment: SchedulerAssignment = {
        assignmentId: randomUUID(),
        runtimeId: job.runtimeId,
        workerId: worker.workerId,
        assignedAt: new Date(nowMs).toISOString(),
        leaseExpiresAt: new Date(nowMs + this.leaseMs).toISOString(),
      };
      await this.store.putAssignment(assignment);
      await this.store.deleteQueued(job.runtimeId);
      tenantAssignments.set(job.tenantId, (tenantAssignments.get(job.tenantId) ?? 0) + 1);
      assignments.push(assignment);
    }
    return assignments;
  }
}
