import { exec } from "node:child_process";
import { promisify } from "node:util";
import { resolveProjectProfile } from "./project-profile";
import type { CheckResult } from "./types";
const execAsync = promisify(exec);

function redact(text: string) { return text.replace(/(api[_-]?key|token|secret)\s*[:=]\s*[^\s]+/gi, "$1=[REDACTED]"); }

export async function runCommand(taskId: string, commandName: string, timeoutMs = 120000): Promise<CheckResult> {
  const started = Date.now();
  const command = resolveProjectProfile("streams").commands[commandName];
  if (!command) return { name: commandName, status: "blocked", command: commandName, exitCode: null, outputExcerpt: "Command unavailable", durationMs: 0, startedAt: new Date(started).toISOString(), completedAt: new Date().toISOString(), blockedReason: "Command execution is not configured for STREAMS build tasks." };
  try {
    const { stdout, stderr } = await execAsync(command, { cwd: process.cwd(), timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 });
    return { name: commandName, status: "passed", command, exitCode: 0, outputExcerpt: redact(`${stdout}\n${stderr}`).slice(0, 4000), durationMs: Date.now() - started, startedAt: new Date(started).toISOString(), completedAt: new Date().toISOString() };
  } catch (e: any) {
    return { name: commandName, status: "failed", command, exitCode: e.code ?? 1, outputExcerpt: redact(`${e.stdout ?? ""}\n${e.stderr ?? e.message}`).slice(0, 4000), durationMs: Date.now() - started, startedAt: new Date(started).toISOString(), completedAt: new Date().toISOString() };
  }
}
