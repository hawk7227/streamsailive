import { markBlocked, updateBuildTask } from "./build-task-service";
import { restoreGeneratedFiles } from "./workspace-manager";
import type { BuildTask } from "./types";

export function runDeterministicRepairs(task: BuildTask) {
  const actions: string[] = [];
  const restored = restoreGeneratedFiles(["public/build-report.json"]);
  if (restored.length) actions.push(`restored:${restored.join(",")}`);

  const forbiddenTouched = task.changedFiles.filter((f) => ["scripts/validate-rule-confirmation.js", "public/build-report.json"].includes(f));
  if (forbiddenTouched.length) {
    markBlocked(task.id, `Forbidden files touched: ${forbiddenTouched.join(", ")}`);
    actions.push("blocked:forbidden_files");
  }

  if ((task as any).artifactId === undefined && /artifact|version/i.test(task.prompt)) {
    markBlocked(task.id, "Missing artifactId/versioning evidence for artifact-related request.");
    actions.push("blocked:missing_artifact_evidence");
  }

  if (task.classification === "Proven") {
    updateBuildTask(task.id, { classification: "Blocked", blockedReason: "Overclaim normalized: Proven requires runtime/source/output/persistence proof." });
    actions.push("normalized:overclaim");
  }

  return actions;
}
