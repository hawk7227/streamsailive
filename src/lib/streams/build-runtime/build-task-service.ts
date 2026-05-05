import { resolveBuildDomain } from "./domain-resolver";
import { resolveProjectProfile } from "./project-profile";
import { buildProofReport } from "./proof-reporter";
import type { BuildStep, BuildTask, CheckResult, ContextPacket, PatchRecord } from "./types";
const tasks = new Map<string, BuildTask>();
const blockers = new Map<string, string[]>();
const now = () => new Date().toISOString();
const id = () => `task_${Math.random().toString(36).slice(2, 10)}`;

export function createBuildTask(input: Partial<BuildTask> & { prompt: string; activeSlice: string }): BuildTask {
  const profile = resolveProjectProfile(input.projectProfile);
  const task: BuildTask = { id: id(), title: input.title ?? "Build task", prompt: input.prompt, activeSlice: input.activeSlice, domain: input.domain ?? resolveBuildDomain(input), repo: input.repo, baseBranch: input.baseBranch ?? "work", taskBranch: input.taskBranch, status: "created", phase: "created", projectProfile: profile.id, mergePolicy: input.mergePolicy, allowedFiles: input.allowedFiles ?? [], forbiddenFiles: [...(input.forbiddenFiles ?? []), ...profile.forbiddenFiles], changedFiles: [], patches: [], checks: [], commandRuns: [], errors: [], repairs: [], classification: "Implemented but unproven", blockedReason: "Durable persistence unavailable: in-memory development store.", createdAt: now(), updatedAt: now(), blockedBy: [], unblocks: [] };
  tasks.set(task.id, task);
  return task;
}
export const getBuildTask = (taskId: string) => tasks.get(taskId);
export function updateBuildTask(taskId: string, patch: Partial<BuildTask>) { const task = tasks.get(taskId); if (!task) return undefined; const next = { ...task, ...patch, updatedAt: now() }; tasks.set(taskId, next); return next; }
export function appendBuildStep(taskId: string, step: BuildStep) { const task = getBuildTask(taskId); if (!task) return; task.phase = step.status; task.status = step.status; task.updatedAt = now(); }
export function appendContextPacket(taskId: string, context: ContextPacket) { const task = getBuildTask(taskId); if (!task) return; task.contextPacket = context; task.updatedAt = now(); }
export function appendPatch(taskId: string, patch: PatchRecord) { const task = getBuildTask(taskId); if (!task) return; task.patches.push(patch); task.updatedAt = now(); }
export function appendCheckResult(taskId: string, result: CheckResult) { const task = getBuildTask(taskId); if (!task) return; task.checks.push(result); task.commandRuns.push(result); task.updatedAt = now(); }
export function markBlocked(taskId: string, reason: string) { return updateBuildTask(taskId, { status: "blocked", phase: "blocked", classification: "Blocked", blockedReason: reason }); }
export function createProofReport(taskId: string) { const task = getBuildTask(taskId); if (!task) return undefined; task.proof = buildProofReport(task); return task.proof; }
export function linkBlockedTask(parentTaskId: string, blockerTaskId: string) { blockers.set(parentTaskId, [...(blockers.get(parentTaskId) ?? []), blockerTaskId]); }
export function getRelatedTasks(taskId: string) { return blockers.get(taskId) ?? []; }
