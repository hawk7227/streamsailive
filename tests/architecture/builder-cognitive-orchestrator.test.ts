import { describe, expect, it } from "vitest";
import { createBuilderCognitivePlan } from "../../src/lib/streams-builder/builder-cognitive-orchestrator";

describe("builder cognitive orchestrator", () => {
  it("requires confirmation when implementation has no locked source", () => {
    const plan = createBuilderCognitivePlan({ prompt: "Fix the hydration issue on this screen" });
    expect(plan.taskKinds).toContain("debugging");
    expect(plan.mustClarify).toBe(true);
    expect(plan.requiredEvidence).toContain("reproduced failure");
    expect(plan.scopePolicy.join(" ")).toContain("After confirmation");
  });

  it("creates a bounded repository and deployment proof contract", () => {
    const plan = createBuilderCognitivePlan({
      prompt: "Fix, verify, commit, push, and deploy this production page",
      lockedFile: "src/app/page.tsx",
      route: "/",
      hasPreview: true,
      hasBrowserEvidence: true,
    });
    expect(plan.taskKinds).toEqual(expect.arrayContaining(["debugging", "verification", "repository", "deployment"]));
    expect(plan.risk).toBe("high");
    expect(plan.stopConditions.join(" ")).toContain("source-lock mismatch");
    expect(plan.requiredEvidence).toEqual(expect.arrayContaining(["resulting commit SHA", "post-deployment browser verification"]));
  });

  it("classifies destructive history rewriting as critical", () => {
    const plan = createBuilderCognitivePlan({ prompt: "Force push and rewrite history", lockedFile: "src/app/page.tsx" });
    expect(plan.risk).toBe("critical");
    expect(plan.stopConditions.join(" ")).toContain("explicit narrowly scoped authorization");
  });
});
