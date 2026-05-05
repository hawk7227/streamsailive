import type { BuildDomain } from "./types";

const patterns: Array<{ domain: BuildDomain; tests: RegExp[] }> = [
  { domain: "self_build_runtime", tests: [/self-build|build runtime|codex-like/i] },
  { domain: "lint_baseline_remediation", tests: [/repo-wide lint|lint baseline/i] },
  { domain: "pr_guardrails", tests: [/pr|merge policy|guard/i] },
  { domain: "preview_artifact_workspace", tests: [/preview|artifact workspace/i] },
  { domain: "chat_runtime", tests: [/chat|session|message/i] },
];

export function resolveBuildDomain(input: { prompt?: string; activeSlice?: string }): BuildDomain {
  const text = `${input.prompt ?? ""} ${input.activeSlice ?? ""}`;
  const found = patterns.find((item) => item.tests.some((test) => test.test(text)));
  return found?.domain ?? "unknown";
}
