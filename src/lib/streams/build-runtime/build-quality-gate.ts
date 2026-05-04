import type { BuildTask, CheckResult, Classification } from "./types";

export interface GateResult { passed: boolean; failures: string[]; nextActions: string[]; }

const narrowPhrases = ["layout only", "audit only", "plan only", "types only", "shell only for review"];
const fullBuildPhrases = ["build", "fix", "implement", "wire", "integrate"];

export function evaluateFullBuildGate(task: BuildTask, checks: CheckResult[], changedFiles: string[]): GateResult {
  const failures: string[] = [];
  const nextActions: string[] = [];
  const prompt = task.prompt.toLowerCase();
  const narrow = narrowPhrases.some((p) => prompt.includes(p));
  const full = fullBuildPhrases.some((p) => prompt.includes(p));

  if (task.classification === "Proven") failures.push("Proven classification is not allowed without runtime/browser/output/persistence proof.");
  if (changedFiles.includes("public/build-report.json")) failures.push("Generated file public/build-report.json must not be part of changes.");
  if (!narrow && full && checks.length === 0) failures.push("Full build request is missing check evidence.");
  if (!narrow && /layout|shell/.test(prompt) && changedFiles.every((f) => !f.includes("/api/") && !f.includes("build-runtime"))) failures.push("Layout-only output for a full build request.");
  if (/inventory/.test(prompt)) failures.push("Inventory-only output is not allowed for full build requests.");
  if (/scaffold/.test(prompt)) failures.push("Scaffold-only output is not allowed for full build requests.");
  if (/console\.log/.test(prompt)) failures.push("Console.log-only controls are not acceptable evidence.");
  if (/persist/.test(prompt) && !task.proof?.blockedItems.some((b) => /persistence/i.test(b))) failures.push("Persistence claim without persistence proof or blocked classification.");
  if (/route/.test(prompt) && checks.every((c) => c.name !== "scope_guard")) failures.push("Route-backed claim missing route/guard evidence.");

  if (task.classification !== "Blocked" && failures.length > 0) nextActions.push("Set classification to Blocked and include gate failures in proof.");
  if (checks.length === 0) nextActions.push("Run safe check suite (git_diff_check, scope_guard, generated_file_guard). ");
  return { passed: failures.length === 0, failures, nextActions };
}

export function normalizeClassification(current: Classification, gate: GateResult): Classification {
  if (!gate.passed) return "Blocked";
  return current === "Proven" ? "Implemented but unproven" : current;
}
