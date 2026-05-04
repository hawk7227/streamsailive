import type { ProjectBuildProfile } from "./types";

const baseForbidden = ["scripts/validate-rule-confirmation.js", "public/build-report.json"];

export const streamsSelfBuildProfile: ProjectBuildProfile = {
  id: "streams_self_build",
  packageManager: "pnpm",
  commands: {
    git_diff_check: "git diff --check",
    typescript_check: "npx tsc --noEmit",
    production_build: "pnpm build",
    lint_check: "pnpm lint",
    scope_guard: "node scripts/scope-guard.mjs",
    generated_file_guard: "node scripts/generated-file-guard.mjs",
    pr_ready: "node scripts/check-pr-ready.mjs",
    guard_self_test: "pnpm streams:guard-self-test",
    streams_pr_ready: "pnpm streams:pr-ready",
    audit_py: "python scripts/audit.py",
    audit_py_alt: "py scripts/audit.py",
    audit_py3: "python3 scripts/audit.py",
  },
  guardScripts: [
    "scripts/scope-guard.mjs",
    "scripts/generated-file-guard.mjs",
    "scripts/check-pr-ready.mjs",
    "scripts/pr-autopilot.mjs",
  ],
  generatedFiles: ["public/build-report.json"],
  forbiddenFiles: baseForbidden,
  mergePolicyRoot: "docs/merge-policies",
};

export const genericRepoProfile: ProjectBuildProfile = {
  id: "generic_repo",
  packageManager: "generic",
  commands: {},
  guardScripts: [],
  generatedFiles: [],
  forbiddenFiles: [],
  mergePolicyRoot: "",
};

const profiles: Record<string, ProjectBuildProfile> = {
  streams_self_build: streamsSelfBuildProfile,
  generic_repo: genericRepoProfile,
};

export function resolveProjectProfile(profileId?: string): ProjectBuildProfile {
  return profiles[profileId ?? "streams_self_build"] ?? genericRepoProfile;
}
