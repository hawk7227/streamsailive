export function planParallelTask(blockerType: string) {
  if (blockerType === "unrelated_repo_baseline") return { newSlice: "Repo-wide Lint Baseline Remediation", branch: "codex/repo-wide-lint-baseline-remediation" };
  return null;
}
