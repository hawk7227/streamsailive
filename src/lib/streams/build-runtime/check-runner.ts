import { runAllowlistedCommand } from "./command-runner";

export const CHECK_TO_COMMAND: Record<string, string> = {
  git_diff_check: "git_diff_check",
  typescript_check: "typescript_check",
  production_build: "production_build",
  scope_guard: "scope_guard",
  generated_file_guard: "generated_file_guard",
  pr_ready: "pr_ready",
  streams_pr_ready: "streams_pr_ready",
  audit: "audit_py",
};

export async function runCheck(checkName: string) {
  const commandName = CHECK_TO_COMMAND[checkName];
  if (!commandName) {
    return runAllowlistedCommand("__unknown__");
  }
  return runAllowlistedCommand(commandName);
}
