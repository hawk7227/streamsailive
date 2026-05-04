import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const repoRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();

export function getRepoRoot() { return repoRoot; }
export function getBranchName() { return execSync("git branch --show-current", { encoding: "utf8" }).trim(); }
export function resolvePath(relativePath: string) { return path.resolve(repoRoot, relativePath); }
export function assertPathInsideRepo(relativePath: string) {
  const full = resolvePath(relativePath);
  if (!full.startsWith(repoRoot + path.sep) && full !== repoRoot) throw new Error(`Path escapes repo root: ${relativePath}`);
  return full;
}
export function listChangedFiles() { return execSync("git diff --name-only", { encoding: "utf8" }).trim().split("\n").filter(Boolean); }
export function isClean() { return execSync("git status --short", { encoding: "utf8" }).trim().length === 0; }
export function restoreGeneratedFiles(files = ["public/build-report.json"]) {
  const restored: string[] = [];
  for (const file of files) {
    const full = resolvePath(file);
    if (existsSync(full)) { execSync(`git restore -- ${file}`); restored.push(file); }
  }
  return restored;
}
export function getCurrentWorkspace() {
  return {
    repoRoot,
    branch: getBranchName(),
    clean: isClean(),
    changedFiles: listChangedFiles(),
    capabilities: {
      local_workspace_available: "real",
      isolated_workspace_available: "blocked",
      github_workspace_available: "blocked",
      command_execution_available: "real",
      git_write_available: "real",
    },
  } as const;
}
export function getWorkspaceStatus(taskId: string) { return { taskId, ...getCurrentWorkspace() }; }
export function getWorkspaceCapabilities() { return getCurrentWorkspace().capabilities; }
