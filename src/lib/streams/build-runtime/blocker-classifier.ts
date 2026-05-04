import type { BlockerType } from "./types";
export function classifyBlocker(input: { checkName: string; log: string }): { blockerType: BlockerType; belongsToCurrentSlice: boolean } {
  const text = `${input.checkName} ${input.log}`;
  if (/missing capability|not configured/i.test(text)) return { blockerType: "missing_runtime_capability", belongsToCurrentSlice: false };
  if (/generated-file|build-report/i.test(text)) return { blockerType: "generated_file_failure", belongsToCurrentSlice: true };
  if (/scope/i.test(text)) return { blockerType: "scope_policy_failure", belongsToCurrentSlice: true };
  if (/lint baseline|repo-wide lint/i.test(text)) return { blockerType: "unrelated_repo_baseline", belongsToCurrentSlice: false };
  return { blockerType: "same_slice_failure", belongsToCurrentSlice: true };
}
