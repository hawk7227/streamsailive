export type BuilderTaskKind = "conversation" | "discovery" | "implementation" | "debugging" | "verification" | "repository" | "deployment" | "research";
export type BuilderRisk = "low" | "medium" | "high" | "critical";

export type BuilderCognitiveInput = {
  prompt: string;
  lockedFile?: string;
  route?: string;
  hasPreview?: boolean;
  hasBrowserEvidence?: boolean;
  hasBuildEvidence?: boolean;
  hasRepositoryLock?: boolean;
};

export type BuilderCognitivePlan = {
  taskKinds: BuilderTaskKind[];
  risk: BuilderRisk;
  uncertainty: number;
  mustClarify: boolean;
  clarificationQuestions: string[];
  requiredEvidence: string[];
  requiredCapabilities: string[];
  phases: string[];
  stopConditions: string[];
  scopePolicy: string[];
  responsePolicy: string[];
};

const includes = (text: string, pattern: RegExp) => pattern.test(text);

export function createBuilderCognitivePlan(input: BuilderCognitiveInput): BuilderCognitivePlan {
  const text = input.prompt.trim().toLowerCase();
  const taskKinds = new Set<BuilderTaskKind>();

  if (/find|locate|which file|where is|open the file|screenshot|screen/.test(text)) taskKinds.add("discovery");
  if (/build|create|implement|add|change|edit|refactor|redesign|wire|connect/.test(text)) taskKinds.add("implementation");
  if (/fix|repair|debug|troubleshoot|error|failed|issue|bug|hydration/.test(text)) taskKinds.add("debugging");
  if (/verify|test|prove|confirm|check|audit/.test(text)) taskKinds.add("verification");
  if (/pull|push|commit|branch|github|repository|repo/.test(text)) taskKinds.add("repository");
  if (/deploy|production|release|vercel/.test(text)) taskKinds.add("deployment");
  if (/research|compare|investigate|study|analyze/.test(text)) taskKinds.add("research");
  if (!taskKinds.size) taskKinds.add("conversation");

  let risk: BuilderRisk = "low";
  if (taskKinds.has("implementation") || taskKinds.has("debugging") || taskKinds.has("repository")) risk = "medium";
  if (taskKinds.has("deployment") || /database|migration|auth|permission|payment|security|delete|remove data/.test(text)) risk = "high";
  if (/force push|rewrite history|drop database|production data|credential|secret rotation/.test(text)) risk = "critical";

  let uncertainty = 0.15;
  if (text.length < 24) uncertainty += 0.2;
  if (/this|that|it|the screen|the file|the issue/.test(text)) uncertainty += 0.15;
  if (!input.lockedFile && (taskKinds.has("implementation") || taskKinds.has("debugging") || taskKinds.has("repository"))) uncertainty += 0.25;
  if (taskKinds.size > 3) uncertainty += 0.1;
  uncertainty = Math.min(1, uncertainty);

  const clarificationQuestions: string[] = [];
  if (!input.lockedFile && (taskKinds.has("implementation") || taskKinds.has("debugging"))) {
    clarificationQuestions.push("Which discovered file should be opened for visual confirmation and locking?");
  }
  if (taskKinds.has("deployment") && !/environment|preview|production|staging/.test(text)) {
    clarificationQuestions.push("Which deployment environment is authorized?");
  }
  if (/delete|remove/.test(text) && !/specific|exact|only/.test(text)) {
    clarificationQuestions.push("What exact resource may be removed, and what must remain unchanged?");
  }

  const requiredEvidence = ["authoritative conversation context", "current source-permission state"];
  if (taskKinds.has("discovery")) requiredEvidence.push("ranked repository candidates with reasons", "visual or code confirmation by the user");
  if (taskKinds.has("implementation")) requiredEvidence.push("before/after source diff", "target-file boundary proof");
  if (taskKinds.has("debugging")) requiredEvidence.push("reproduced failure", "causal source location", "post-fix failure absence");
  if (taskKinds.has("verification")) requiredEvidence.push("named assertions and observed outcomes");
  if (taskKinds.has("repository")) requiredEvidence.push("repository, branch, path, SHA and lock-token match", "exact staged-file list", "resulting commit SHA");
  if (taskKinds.has("deployment")) requiredEvidence.push("successful build", "deployment identifier", "post-deployment browser verification");
  if (input.hasPreview) requiredEvidence.push("visible preview state");
  if (input.hasBrowserEvidence) requiredEvidence.push("browser console/network/DOM evidence");
  if (input.hasBuildEvidence) requiredEvidence.push("build or test logs");

  const requiredCapabilities = ["conversation continuity", "structured progress events", "truth-gated completion"];
  if (taskKinds.has("discovery")) requiredCapabilities.push("semantic repository search", "reference resolution", "adaptive view opening");
  if (taskKinds.has("implementation") || taskKinds.has("debugging")) requiredCapabilities.push("bounded source editing", "line-level patch playback", "autonomous repair loop");
  if (taskKinds.has("repository")) requiredCapabilities.push("fresh remote preflight", "non-fast-forward protection", "exact-path staging");
  if (taskKinds.has("verification") || taskKinds.has("deployment")) requiredCapabilities.push("browser verification", "artifact-bound evidence");

  const phases = ["understand request", "resolve references", "inspect authorized evidence", "plan smallest safe action"];
  if (taskKinds.has("discovery")) phases.push("rank candidates", "open candidate", "wait for confirmation");
  if (taskKinds.has("implementation") || taskKinds.has("debugging")) phases.push("reproduce or establish baseline", "edit visibly", "run focused checks", "repair until bounded stop");
  if (taskKinds.has("repository")) phases.push("verify remote SHA", "stage authorized paths", "commit", "fast-forward push", "refresh source truth");
  if (taskKinds.has("deployment")) phases.push("deploy", "verify deployed artifact");
  phases.push("report proven outcome and remaining uncertainty");

  const stopConditions = [
    "stop on source-lock mismatch or stale SHA",
    "stop when required evidence is unavailable",
    "stop before accessing an unauthorized file and request permission",
    "stop after the configured repair or retry budget",
    "never report success from model text alone",
  ];
  if (risk === "critical") stopConditions.push("critical-risk operations require explicit narrowly scoped authorization");

  return {
    taskKinds: [...taskKinds],
    risk,
    uncertainty,
    mustClarify: clarificationQuestions.length > 0 && uncertainty >= 0.45,
    clarificationQuestions,
    requiredEvidence: [...new Set(requiredEvidence)],
    requiredCapabilities: [...new Set(requiredCapabilities)],
    phases,
    stopConditions,
    scopePolicy: [
      "Discovery may search broadly only to identify candidates.",
      "After confirmation, read/write authority is limited to the exact authorized file set.",
      "Logs, imports, stack traces and search results are evidence, not permission.",
      "Request and obtain user confirmation before expanding file scope.",
    ],
    responsePolicy: [
      "Communicate meaningful progress without exposing private chain-of-thought.",
      "State what is known, inferred, blocked and still unverified.",
      "Open the preview, code, diff, logs, media or DevTools view that best supports the current evidence.",
      "Use concise updates during execution and a proof-based completion summary.",
    ],
  };
}

export function formatBuilderCognitivePlan(plan: BuilderCognitivePlan) {
  return [
    `Task kinds: ${plan.taskKinds.join(", ")}`,
    `Risk: ${plan.risk}`,
    `Uncertainty: ${plan.uncertainty.toFixed(2)}`,
    `Required evidence: ${plan.requiredEvidence.join("; ")}`,
    `Required capabilities: ${plan.requiredCapabilities.join("; ")}`,
    `Execution phases: ${plan.phases.join(" -> ")}`,
    `Scope policy: ${plan.scopePolicy.join(" ")}`,
    `Stop conditions: ${plan.stopConditions.join(" ")}`,
    `Response policy: ${plan.responsePolicy.join(" ")}`,
  ].join("\n");
}
