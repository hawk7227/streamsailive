import { exec } from "node:child_process";
import { promisify } from "node:util";
import { resolveProjectProfile } from "./project-profile";
import type { CheckResult } from "./types";

const execAsync = promisify(exec);

export async function runAllowlistedCommand(commandName: string): Promise<CheckResult> {
  const startedAt = new Date();
  const profile = resolveProjectProfile("streams");
  const command = profile.commands[commandName];
  if (!command) {
    return {
      name: commandName,
      status: "blocked",
      command: commandName,
      exitCode: null,
      outputExcerpt: "Blocked: command is not allowlisted.",
      durationMs: 0,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      blockedReason: "Command execution is not configured for this command.",
    };
  }
  try {
    const result = await execAsync(command, { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
    return { name: commandName, status: "passed", command, exitCode: 0, outputExcerpt: `${result.stdout}\n${result.stderr}`.trim().slice(0, 1200), durationMs: Date.now() - startedAt.getTime(), startedAt: startedAt.toISOString(), completedAt: new Date().toISOString() };
  } catch (error: any) {
    return { name: commandName, status: "failed", command, exitCode: error.code ?? 1, outputExcerpt: `${error.stdout ?? ""}\n${error.stderr ?? error.message}`.trim().slice(0, 1200), durationMs: Date.now() - startedAt.getTime(), startedAt: startedAt.toISOString(), completedAt: new Date().toISOString() };
  }
}
