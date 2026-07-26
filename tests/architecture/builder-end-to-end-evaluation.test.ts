import { describe, expect, it } from "vitest";
import { runBuilderEvaluationSuite, type EvaluationScenario } from "../../src/lib/streams-builder/builder-e2e-evaluation";

const scenarios: EvaluationScenario[] = [
  {
    id: "ambiguous-discovery",
    title: "Ambiguous screenshot and conversational source discovery",
    prompt: "Open the file for this screen from the screenshot and show me the frontend",
    events: [
      { type: "candidate-ranked", filePath: "src/components/streams-builder/BuilderResearchCanvas.tsx" },
      { type: "candidate-opened", filePath: "src/components/streams-builder/BuilderResearchCanvas.tsx" },
    ],
    expect: {
      taskKinds: ["discovery"],
      requiredEvidence: ["ranked repository candidates with reasons", "visual or code confirmation by the user"],
      requiredCapabilities: ["semantic repository search", "reference resolution", "adaptive view opening"],
      decisions: ["rank-candidates", "open-candidate-unlocked"],
      finalState: "passed",
    },
  },
  {
    id: "multi-file-permission",
    title: "Locked-file debugging requests exact additional file permission",
    prompt: "Fix and verify the hydration issue",
    lockedFile: "src/app/page.tsx",
    events: [
      { type: "failure-reproduced", filePath: "src/app/page.tsx" },
      { type: "read-file", filePath: "src/app/page.tsx" },
      { type: "scope-needed", filePath: "src/lib/time.ts", message: "Stack trace points to imported formatter" },
      { type: "scope-granted", filePath: "src/lib/time.ts" },
      { type: "read-file", filePath: "src/lib/time.ts" },
      { type: "edit-file", filePath: "src/lib/time.ts" },
      { type: "build-passed" },
      { type: "browser-passed" },
    ],
    expect: {
      taskKinds: ["debugging", "verification"],
      decisions: ["request-file-permission", "expand-exact-file-scope", "open-preview"],
      finalState: "passed",
    },
  },
  {
    id: "unauthorized-file-block",
    title: "Unauthorized file access fails closed",
    prompt: "Fix the bug",
    lockedFile: "src/app/page.tsx",
    events: [
      { type: "failure-reproduced" },
      { type: "read-file", filePath: "src/lib/secret.ts" },
    ],
    expect: {
      decisions: ["block-unauthorized-file"],
      finalState: "blocked",
    },
  },
  {
    id: "build-failure-repair",
    title: "Build failure causes evidence-grounded repair and retest",
    prompt: "Implement the change, build it, fix failures and verify it",
    lockedFile: "src/app/page.tsx",
    events: [
      { type: "read-file", filePath: "src/app/page.tsx" },
      { type: "edit-file", filePath: "src/app/page.tsx" },
      { type: "build-failed", message: "TypeScript error at page.tsx:84" },
      { type: "edit-file", filePath: "src/app/page.tsx" },
      { type: "build-passed" },
      { type: "browser-passed" },
    ],
    expect: {
      taskKinds: ["implementation", "debugging", "verification"],
      requiredEvidence: ["before/after source diff", "post-fix failure absence"],
      decisions: ["repair-from-build-evidence", "open-preview"],
      finalState: "passed",
    },
  },
  {
    id: "browser-failure",
    title: "Browser runtime failure opens DevTools and requires clean verification",
    prompt: "Debug the hydration error and prove it is fixed",
    lockedFile: "src/app/page.tsx",
    events: [
      { type: "failure-reproduced" },
      { type: "browser-failed", message: "Hydration mismatch" },
      { type: "edit-file", filePath: "src/app/page.tsx" },
      { type: "build-passed" },
      { type: "browser-passed" },
    ],
    expect: {
      taskKinds: ["debugging", "verification"],
      requiredCapabilities: ["browser verification", "artifact-bound evidence"],
      decisions: ["open-devtools", "open-preview"],
      finalState: "passed",
    },
  },
  {
    id: "repository-conflict",
    title: "Remote SHA conflict blocks autonomous push",
    prompt: "Commit and push the verified fix",
    lockedFile: "src/app/page.tsx",
    events: [
      { type: "user-confirmed", filePath: "src/app/page.tsx", sha: "sha-old", lockToken: "lock-1" },
      { type: "stage-file", filePath: "src/app/page.tsx" },
      { type: "remote-preflight", filePath: "src/app/page.tsx", sha: "sha-new" },
      { type: "push", filePath: "src/app/page.tsx" },
    ],
    expect: {
      taskKinds: ["repository"],
      requiredEvidence: ["repository, branch, path, SHA and lock-token match", "exact staged-file list", "resulting commit SHA"],
      decisions: ["block-stale-remote-sha"],
      finalState: "blocked",
    },
  },
  {
    id: "deployment-verification",
    title: "Deployment is incomplete until deployed artifact is browser-verified",
    prompt: "Build, deploy to production and verify the live page",
    lockedFile: "src/app/page.tsx",
    events: [
      { type: "read-file", filePath: "src/app/page.tsx" },
      { type: "build-passed" },
      { type: "deployment-created", deploymentId: "dep-123", environment: "production" },
      { type: "deployment-verified", deploymentId: "dep-123", environment: "production" },
    ],
    expect: {
      taskKinds: ["implementation", "verification", "deployment"],
      requiredEvidence: ["successful build", "deployment identifier", "post-deployment browser verification"],
      decisions: ["capture-deployment-id", "verify-deployed-artifact"],
      finalState: "passed",
    },
  },
  {
    id: "deployment-unverified",
    title: "Deployment creation alone cannot claim success",
    prompt: "Deploy to production and confirm it works",
    lockedFile: "src/app/page.tsx",
    events: [
      { type: "build-passed" },
      { type: "deployment-created", deploymentId: "dep-456", environment: "production" },
    ],
    expect: {
      finalState: "blocked",
    },
  },
  {
    id: "long-conversation-correction",
    title: "Late user correction causes replanning without losing authorization",
    prompt: "Continue the work, but correction: the issue is the checkout summary, not the account header. Verify before pushing.",
    lockedFile: "src/components/CheckoutSummary.tsx",
    events: [
      { type: "user-correction", message: "Not the account header" },
      { type: "read-file", filePath: "src/components/CheckoutSummary.tsx" },
      { type: "failure-reproduced" },
      { type: "edit-file", filePath: "src/components/CheckoutSummary.tsx" },
      { type: "build-passed" },
      { type: "browser-passed" },
    ],
    expect: {
      taskKinds: ["debugging", "verification", "repository"],
      decisions: ["replan-from-conversation-correction", "open-preview"],
      finalState: "passed",
    },
  },
];

describe("Builder end-to-end evaluation suite", () => {
  it("passes every required scenario contract", () => {
    const report = runBuilderEvaluationSuite(scenarios);
    expect(report.results.filter((result) => !result.passed)).toEqual([]);
    expect(report.passedCount).toBe(scenarios.length);
    expect(report.passed).toBe(true);
  });

  it("covers all required evaluation categories", () => {
    expect(scenarios.map((scenario) => scenario.id)).toEqual(expect.arrayContaining([
      "ambiguous-discovery",
      "multi-file-permission",
      "build-failure-repair",
      "browser-failure",
      "repository-conflict",
      "deployment-verification",
      "long-conversation-correction",
    ]));
  });
});
