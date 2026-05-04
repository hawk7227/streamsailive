import { appendCheckResult } from "./build-task-service";
import { runCommand } from "./command-runner";

const MAP: Record<string, string> = { git_diff_check: "git_diff_check", typescript_check: "typescript_check", production_build: "production_build", scope_guard: "scope_guard", generated_file_guard: "generated_file_guard", pr_ready: "pr_ready", guard_self_test: "guard_self_test", audit: "audit_py" };
export async function runCheck(taskId: string, checkName: string) {
  const result = await runCommand(taskId, MAP[checkName] ?? "__missing__");
  appendCheckResult(taskId, { ...result, name: checkName });
  return result;
}
export async function runCheckSuite(taskId: string, checks: string[]) {
  const results = [];
  for (const c of checks) results.push(await runCheck(taskId, c));
  return results;
}
