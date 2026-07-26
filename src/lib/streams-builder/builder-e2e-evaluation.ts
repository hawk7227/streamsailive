import { createBuilderCognitivePlan, type BuilderCognitivePlan } from "./builder-cognitive-orchestrator";

export type EvaluationEvent = {
  type: string;
  message?: string;
  filePath?: string;
  repo?: string;
  branch?: string;
  sha?: string;
  lockToken?: string;
  status?: number;
  environment?: string;
  deploymentId?: string;
};

export type EvaluationScenario = {
  id: string;
  title: string;
  prompt: string;
  lockedFile?: string;
  events: EvaluationEvent[];
  expect: {
    taskKinds?: string[];
    mustClarify?: boolean;
    requiredEvidence?: string[];
    requiredCapabilities?: string[];
    decisions?: string[];
    finalState: "passed" | "blocked" | "needs-user";
  };
};

export type EvaluationResult = {
  id: string;
  passed: boolean;
  finalState: EvaluationScenario["expect"]["finalState"];
  plan: BuilderCognitivePlan;
  decisions: string[];
  failures: string[];
};

function includesAll(actual: string[], expected: string[] = []) {
  return expected.filter((item) => !actual.includes(item));
}

export function evaluateBuilderScenario(scenario: EvaluationScenario): EvaluationResult {
  const plan = createBuilderCognitivePlan({ prompt: scenario.prompt, lockedFile: scenario.lockedFile });
  const decisions: string[] = [];
  const authorized = new Set<string>(scenario.lockedFile ? [scenario.lockedFile] : []);
  let currentSha = "";
  let currentLockToken = "";
  let failureReproduced = false;
  let browserClean = false;
  let buildPassed = false;
  let deploymentVerified = false;
  let conflict = false;
  let needsUser = plan.mustClarify;

  for (const event of scenario.events) {
    if (event.type === "candidate-ranked") decisions.push("rank-candidates");
    if (event.type === "candidate-opened") decisions.push("open-candidate-unlocked");
    if (event.type === "user-confirmed" && event.filePath) {
      authorized.add(event.filePath);
      currentSha = event.sha || currentSha;
      currentLockToken = event.lockToken || currentLockToken;
      needsUser = false;
      decisions.push("lock-confirmed-file");
    }
    if (event.type === "scope-needed" && event.filePath && !authorized.has(event.filePath)) {
      needsUser = true;
      decisions.push("request-file-permission");
    }
    if (event.type === "scope-granted" && event.filePath) {
      authorized.add(event.filePath);
      needsUser = false;
      decisions.push("expand-exact-file-scope");
    }
    if (event.type === "read-file" || event.type === "edit-file" || event.type === "stage-file") {
      if (!event.filePath || !authorized.has(event.filePath)) {
        decisions.push("block-unauthorized-file");
        return { id: scenario.id, passed: scenario.expect.finalState === "blocked", finalState: "blocked", plan, decisions, failures: [] };
      }
    }
    if (event.type === "failure-reproduced") failureReproduced = true;
    if (event.type === "build-failed") {
      failureReproduced = true;
      decisions.push("repair-from-build-evidence");
    }
    if (event.type === "build-passed") buildPassed = true;
    if (event.type === "browser-failed") {
      failureReproduced = true;
      browserClean = false;
      decisions.push("open-devtools");
    }
    if (event.type === "browser-passed") { browserClean = true; decisions.push("open-preview"); }
    if (event.type === "remote-preflight" && currentSha && event.sha && event.sha !== currentSha) {
      conflict = true;
      decisions.push("block-stale-remote-sha");
    }
    if (event.type === "push" && conflict) {
      return { id: scenario.id, passed: scenario.expect.finalState === "blocked", finalState: "blocked", plan, decisions, failures: [] };
    }
    if (event.type === "deployment-created" && event.deploymentId) decisions.push("capture-deployment-id");
    if (event.type === "deployment-verified" && event.deploymentId) {
      deploymentVerified = true;
      decisions.push("verify-deployed-artifact");
    }
    if (event.type === "user-correction") decisions.push("replan-from-conversation-correction");
  }

  let finalState: EvaluationResult["finalState"] = "passed";
  if (needsUser) finalState = "needs-user";
  if (conflict) finalState = "blocked";
  if (plan.taskKinds.includes("debugging") && (!failureReproduced || !browserClean)) finalState = "blocked";
  if (plan.taskKinds.includes("implementation") && !buildPassed && scenario.events.some((event) => event.type.startsWith("build-"))) finalState = "blocked";
  if (plan.taskKinds.includes("deployment") && !deploymentVerified) finalState = "blocked";

  const failures: string[] = [];
  failures.push(...includesAll(plan.taskKinds, scenario.expect.taskKinds).map((item) => `missing task kind: ${item}`));
  failures.push(...includesAll(plan.requiredEvidence, scenario.expect.requiredEvidence).map((item) => `missing evidence: ${item}`));
  failures.push(...includesAll(plan.requiredCapabilities, scenario.expect.requiredCapabilities).map((item) => `missing capability: ${item}`));
  failures.push(...includesAll(decisions, scenario.expect.decisions).map((item) => `missing decision: ${item}`));
  if (scenario.expect.mustClarify !== undefined && plan.mustClarify !== scenario.expect.mustClarify) failures.push(`mustClarify expected ${scenario.expect.mustClarify} got ${plan.mustClarify}`);
  if (finalState !== scenario.expect.finalState) failures.push(`finalState expected ${scenario.expect.finalState} got ${finalState}`);

  return { id: scenario.id, passed: failures.length === 0, finalState, plan, decisions, failures };
}

export function runBuilderEvaluationSuite(scenarios: EvaluationScenario[]) {
  const results = scenarios.map(evaluateBuilderScenario);
  return {
    passed: results.every((result) => result.passed),
    total: results.length,
    passedCount: results.filter((result) => result.passed).length,
    results,
  };
}
