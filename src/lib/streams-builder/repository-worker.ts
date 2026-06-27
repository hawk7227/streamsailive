import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import type { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import {
  createCodexRepairPolicy,
  createOpenAICodexRepairDiffGenerator,
  createStaticRepairDiffGenerator,
  runCodexRepairLoop,
  type CodexRepairCommandResult,
} from "./codex-repair-loop";
import { createRepositoryExecutionPlan, type StreamsRepositoryExecutionCommand } from "./repository-execution";
import { createSandboxCommandBatch, type StreamsSandboxCommand } from "./sandbox-commands";

const execFileAsync = promisify(execFile);
const WORKSPACE_ROOT = "/tmp/streams-builder";
const MAX_BUFFER = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 45_000;

export type RepositoryWorkerTruthState = "PROVEN" | "FAILED" | "UNPROVEN";

export interface RepositoryWorkerResult {
  ok: boolean;
  jobId: string;
  status: "completed" | "failed" | "blocked";
  truthState: RepositoryWorkerTruthState;
  proof: string[];
  unproven: string[];
  failedCommandId?: string;
  blockedReasons?: string[];
}

function cleanLog(value: unknown) {
  return String(value || "")
    .replace(/ghp_[A-Za-z0-9_]+/g, "[redacted-github-token]")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "[redacted-github-token]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, MAX_BUFFER);
}

function rowString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function rowBoolean(row: Record<string, unknown>, key: string) {
  return row[key] === true;
}

function rowNumber(row: Record<string, unknown>, key: string, fallback: number) {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function rowStringArray(row: Record<string, unknown>, key: string): string[] {
  const value = row[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function rowCommandArray(row: Record<string, unknown>, key: string): StreamsRepositoryExecutionCommand[] {
  return rowStringArray(row, key) as StreamsRepositoryExecutionCommand[];
}

function workspacePath(projectId: string) {
  return resolve(WORKSPACE_ROOT, projectId.replace(/[^A-Za-z0-9_.-]+/g, "-"));
}

function assertInsideWorkspace(cwd: string) {
  const resolved = resolve(cwd);
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error(`Refusing to execute outside Streams sandbox: ${resolved}`);
  }
}

function isRepairableCommand(command: StreamsRepositoryExecutionCommand) {
  return command === "npm_run_build" || command === "apply_unified_diff";
}

async function writeUnifiedDiff(projectId: string, unifiedDiff: string) {
  const patchPath = join(WORKSPACE_ROOT, `${projectId.replace(/[^A-Za-z0-9_.-]+/g, "-")}.patch.diff`);
  await mkdir(WORKSPACE_ROOT, { recursive: true });
  await writeFile(patchPath, unifiedDiff, "utf-8");
  return patchPath;
}

function commandForExecution(command: StreamsSandboxCommand, patchPath: string | null, applyPhase = false) {
  if (command.command === "apply_unified_diff") {
    return { file: "git", args: applyPhase ? ["apply", patchPath || "PATCH_FILE_MISSING"] : ["apply", "--check", patchPath || "PATCH_FILE_MISSING"] };
  }

  return {
    file: command.args[0],
    args: command.args.slice(1),
  };
}

async function execResolved(command: StreamsSandboxCommand, resolved: { file: string; args: string[] }) {
  return execFileAsync(resolved.file, resolved.args, {
    cwd: command.command === "clone_repo" ? WORKSPACE_ROOT : command.cwd,
    timeout: DEFAULT_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
    env: {
      ...process.env,
      PATH: process.env.PATH || "",
      NODE_ENV: process.env.NODE_ENV || "production",
      CI: "true",
    },
  });
}

async function runCommand(command: StreamsSandboxCommand, patchPath: string | null): Promise<CodexRepairCommandResult & { startedAt: string; completedAt: string; code?: unknown }> {
  assertInsideWorkspace(command.cwd);
  const startedAt = new Date().toISOString();

  try {
    const check = await execResolved(command, commandForExecution(command, patchPath));
    let stdout = cleanLog(check.stdout);
    let stderr = cleanLog(check.stderr);

    if (command.command === "apply_unified_diff") {
      const applied = await execResolved(command, commandForExecution(command, patchPath, true));
      stdout = cleanLog(`${stdout}\n${applied.stdout}`);
      stderr = cleanLog(`${stderr}\n${applied.stderr}`);
    }

    return { ok: true, startedAt, completedAt: new Date().toISOString(), stdout, stderr };
  } catch (error) {
    const err = error as { stdout?: unknown; stderr?: unknown; message?: string; code?: unknown };
    return { ok: false, startedAt, completedAt: new Date().toISOString(), stdout: cleanLog(err.stdout), stderr: cleanLog(err.stderr || err.message), code: err.code };
  }
}

function repairApplyCommand(command: StreamsSandboxCommand, attempt: number): StreamsSandboxCommand {
  return {
    ...command,
    id: `repair-${attempt}-apply-unified-diff`,
    command: "apply_unified_diff",
    args: ["git", "apply", "--check", "PATCH_FILE_THEN_APPLY"],
    requiresApproval: false,
    proofLabel: `Codex repair attempt ${attempt} patch applied.`,
  };
}

async function failJob(input: {
  scope: StreamsAIScope;
  jobs: StreamsAIJobsRepository;
  jobId: string;
  command: StreamsSandboxCommand;
  result: CodexRepairCommandResult;
  proof: string[];
  unproven: string[];
  reason: string;
}): Promise<RepositoryWorkerResult> {
  await input.jobs.update(input.scope, input.jobId, {
    status: "failed",
    metadata: {
      truthState: "FAILED",
      failedCommandId: input.command.id,
      failedCommand: input.command.command,
      failureReason: input.reason,
      stdout: input.result.stdout || "",
      stderr: input.result.stderr || "",
    },
  });
  return {
    ok: false,
    jobId: input.jobId,
    status: "failed",
    truthState: "FAILED",
    proof: input.proof,
    unproven: [...input.unproven, input.reason, "remaining command batch", "browser verification", "workflow proof"],
    failedCommandId: input.command.id,
  };
}

export async function processRepositoryExecutionJob(
  scope: StreamsAIScope,
  row: Record<string, unknown>,
  jobs: StreamsAIJobsRepository,
): Promise<RepositoryWorkerResult> {
  const jobId = String(row.id);
  const input = (row.input_json || {}) as Record<string, unknown>;
  const projectId = rowString(input, "projectId") || rowString(row, "project_id") || "project-pending";
  const sessionId = rowString(input, "sessionId") || rowString(row, "session_id") || "builder-session-pending";
  const repoFullName = rowString(input, "repoFullName");
  const branchName = rowString(input, "branchName") || `streams-builder/${projectId}`;
  const requestedCommands = rowCommandArray(input, "requestedCommands");
  const targetFiles = rowStringArray(input, "targetFiles");
  const unifiedDiff = rowString(input, "unifiedDiff");
  const commitMessage = rowString(input, "commitMessage");
  const approvalGranted = input.approvalGranted === true;
  const autonomousRepair = rowBoolean(input, "autonomousRepair");
  const repairUnifiedDiffs = rowStringArray(input, "repairUnifiedDiffs");
  const commands = requestedCommands.length ? requestedCommands : ["clone_repo", "read_full_file", "git_status", "git_diff"];

  await jobs.update(scope, jobId, { status: "running" });
  await jobs.createEvent(scope, { jobId, eventType: "repository.worker.claimed", message: "Repository execution worker claimed job", data: { projectId, sessionId, repoFullName, branchName, commands, autonomousRepair } });

  const plan = createRepositoryExecutionPlan({
    projectId,
    sessionId,
    repoFullName,
    branchName,
    baseBranch: rowString(input, "baseBranch") || "main",
    requestedCommands: commands as StreamsRepositoryExecutionCommand[],
    targetFiles,
    unifiedDiff,
    commitMessage,
    autonomousRepair,
    maxRepairAttempts: rowNumber(input, "maxRepairAttempts", 3),
    maxFilesTouched: rowNumber(input, "maxFilesTouched", 4),
    runBuildAfterPatch: input.runBuildAfterPatch !== false,
    requireApprovalBeforePush: input.requireApprovalBeforePush !== false,
  });

  if (plan.blockedReasons.length > 0) {
    await jobs.update(scope, jobId, { status: "failed", metadata: { truthState: "FAILED", blockedReasons: plan.blockedReasons } });
    await jobs.createEvent(scope, { jobId, eventType: "repository.worker.blocked", message: "Repository execution blocked by validation", data: { blockedReasons: plan.blockedReasons, plan } });
    return { ok: false, jobId, status: "blocked", truthState: "FAILED", proof: ["worker claimed job", "plan validation executed"], unproven: ["sandbox execution"], blockedReasons: plan.blockedReasons };
  }

  const workspaceDir = workspacePath(projectId);
  const sandboxBatch = createSandboxCommandBatch({ projectId, sessionId, repoFullName, branchName, workspaceDir, commands: commands as StreamsRepositoryExecutionCommand[], targetFiles, commitMessage });

  await rm(workspaceDir, { recursive: true, force: true });
  await mkdir(WORKSPACE_ROOT, { recursive: true });
  await jobs.createEvent(scope, { jobId, eventType: "repository.sandbox.prepared", message: "Repository sandbox prepared", data: { workspaceDir, commandCount: sandboxBatch.commands.length } });

  let patchPath = unifiedDiff ? await writeUnifiedDiff(projectId, unifiedDiff) : null;
  const proof: string[] = ["worker claimed job", "plan validation passed", "sandbox prepared"];
  const unproven: string[] = [];

  for (const command of sandboxBatch.commands) {
    if (command.requiresApproval && !approvalGranted) {
      unproven.push(`${command.command} skipped because approval was not granted`);
      await jobs.createEvent(scope, { jobId, eventType: "repository.command.skipped", message: "Approval-gated command skipped", data: { commandId: command.id, command: command.command, reason: "approval_required" } });
      continue;
    }

    await jobs.createEvent(scope, { jobId, eventType: "repository.command.started", message: `Starting ${command.command}`, data: { commandId: command.id, command: command.command, args: command.args, cwd: command.cwd } });

    const result = await runCommand(command, patchPath);
    await jobs.createEvent(scope, { jobId, eventType: result.ok ? "repository.command.completed" : "repository.command.failed", message: result.ok ? `Completed ${command.command}` : `Failed ${command.command}`, data: { commandId: command.id, command: command.command, ...result } });

    if (!result.ok) {
      if (!isRepairableCommand(command.command)) {
        await jobs.createEvent(scope, {
          jobId,
          eventType: "repository.codex.repair.skipped",
          message: `${command.command} failed before repairable build/test stage. Repair loop skipped because this is infrastructure/source access, not code repair.`,
          data: { commandId: command.id, command: command.command, stdout: result.stdout, stderr: result.stderr },
        });
        return failJob({ scope, jobs, jobId, command, result, proof, unproven, reason: `${command.command} failed before repairable build/test stage` });
      }

      if (autonomousRepair) {
        await jobs.createEvent(scope, { jobId, eventType: "repository.codex.loop.started", message: "Codex loop started after repairable command failure", data: { commandId: command.id, command: command.command, maxRepairAttempts: plan.codexRepair.maxRepairAttempts } });

        const staticGenerator = createStaticRepairDiffGenerator(repairUnifiedDiffs);
        const openAIGenerator = createOpenAICodexRepairDiffGenerator();
        const repairResult = await runCodexRepairLoop({
          failedCommand: command.command,
          stdout: result.stdout,
          stderr: result.stderr,
          targetFiles,
          policy: createCodexRepairPolicy({ autonomousRepair, maxAttempts: plan.codexRepair.maxRepairAttempts, maxFilesTouched: plan.codexRepair.maxFilesTouched, runBuildAfterPatch: plan.codexRepair.runBuildAfterPatch, requireApprovalBeforePush: plan.codexRepair.requireApprovalBeforePush }),
          generatePatch: async (repairInput) => (await staticGenerator(repairInput)) || (await openAIGenerator(repairInput)),
          applyPatch: async (patch, attempt) => {
            patchPath = await writeUnifiedDiff(`${projectId}-repair-${attempt}`, patch);
            return runCommand(repairApplyCommand(command, attempt), patchPath);
          },
          rerunCommand: async () => runCommand(command, patchPath),
          emit: async (attempt) => {
            await jobs.createEvent(scope, { jobId, eventType: `repository.codex.${attempt.status}`, message: attempt.message, data: attempt });
          },
        });

        proof.push(...repairResult.proof);
        unproven.push(...repairResult.unproven);

        if (repairResult.repaired) {
          proof.push(`Codex repair loop fixed ${command.command}`);
          continue;
        }

        await jobs.update(scope, jobId, { status: "failed", metadata: { truthState: "FAILED", failedCommandId: command.id, codexRepair: repairResult } });
        return { ok: false, jobId, status: "failed", truthState: "FAILED", proof, unproven: [...unproven, "remaining command batch", "browser verification", "workflow proof"], failedCommandId: command.id };
      }

      return failJob({ scope, jobs, jobId, command, result, proof, unproven, reason: `${command.command} failed and autonomous repair was not enabled` });
    }

    proof.push(command.proofLabel);
  }

  const truthState: RepositoryWorkerTruthState = unproven.length > 0 ? "UNPROVEN" : "PROVEN";
  await jobs.update(scope, jobId, { status: truthState === "PROVEN" ? "completed" : "in_review", metadata: { truthState, proof, unproven } });
  await jobs.createEvent(scope, { jobId, eventType: "repository.worker.completed", message: truthState === "PROVEN" ? "Repository execution worker completed" : "Repository execution worker completed with unproven items", data: { truthState, proof, unproven } });

  return { ok: true, jobId, status: "completed", truthState, proof, unproven };
}
