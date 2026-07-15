import { describe, expect, it } from "vitest";
import {
  HUMAN_WORK_ITEMS,
  buildFinalWorkReceipt,
  buildHumanWorkEvent,
  detectWorkDomain,
  humanWorkNarration,
  sanitizeHumanWorkLanguage,
  shouldExposeWorkEvent,
  statusLabelFor,
  validateCompletionEvidence,
} from "@/lib/streams-ai/runtime/human-work-narration-policy";

describe("Streams AI human work behavior Items 6-40", () => {
  it("registers every item from 6 through 40 exactly once", () => {
    expect(Object.keys(HUMAN_WORK_ITEMS).map(Number)).toEqual(Array.from({ length: 35 }, (_, index) => index + 6));
    expect(HUMAN_WORK_ITEMS[6]).toBe("Update When the Plan Changes");
    expect(HUMAN_WORK_ITEMS[40]).toBe("Final Governing Rule");
  });

  it("builds plan-change, reuse, finding, decision, preservation, risk, and next-step data", () => {
    const event = buildHumanWorkEvent({
      eventType: "plan_changed",
      status: "running",
      goal: "Repair the active chat.",
      currentAction: "Extending the existing event ledger.",
      nextAction: "Run the production tests.",
      completedItems: ["Inspected the current route"],
      findings: ["The jobs ledger already persists ordered events"],
      decision: "Reuse the existing jobs ledger instead of adding a second store.",
      rejectedAlternatives: ["Create a parallel event database"],
      preservedItems: ["Existing chat history"],
      risksAvoided: ["Duplicate persistence"],
      planChanged: true,
      changeReason: "The existing ledger is sufficient.",
      planVersion: 2,
      previousPlanVersion: 1,
      evidenceLevel: "source_verified",
      evidenceSummary: "The active repository path was inspected.",
      verificationState: "in_progress",
    }) as any;
    expect(event.planChanged).toBe(true);
    expect(event.changeReason).toContain("existing ledger");
    expect(event.findings).toHaveLength(1);
    expect(event.decision).toContain("Reuse");
    expect(event.preservedItems).toEqual(["Existing chat history"]);
    expect(event.risksAvoided).toEqual(["Duplicate persistence"]);
    expect(event.planVersion).toBe(2);
  });

  it("does not expose trivial micro-actions and rate-limits non-material repetition", () => {
    expect(shouldExposeWorkEvent({ message: "Clicking", eventType: "activity" })).toBe(false);
    expect(shouldExposeWorkEvent({ message: "Working...", eventType: "activity" })).toBe(false);
    expect(shouldExposeWorkEvent({ message: "Inspecting the active persistence route.", eventType: "activity", now: 2000, lastVisibleAt: 1000 })).toBe(false);
    expect(shouldExposeWorkEvent({ message: "A material architecture decision was recorded.", eventType: "decision", now: 2000, lastVisibleAt: 1900 })).toBe(true);
  });

  it("uses stable labels with natural-language context", () => {
    expect(statusLabelFor({ eventType: "research_started" })).toBe("Researching");
    expect(statusLabelFor({ eventType: "plan_changed" })).toBe("Plan updated");
    expect(statusLabelFor({ eventType: "partial_completion" })).toBe("Partially complete");
    const narration = humanWorkNarration({
      eventType: "decision",
      goal: "Complete the repair.",
      decision: "Extend the active implementation.",
      currentAction: "Updating the controller.",
      evidenceSummary: "The active route and ledger were inspected.",
      nextAction: "Run tests.",
    });
    expect(narration).toContain("Decision:");
    expect(narration).toContain("Now:");
    expect(narration).toContain("Evidence:");
    expect(narration).toContain("Next:");
  });

  it("removes empty service language, fake emotions, and false background promises", () => {
    const text = sanitizeHumanWorkLanguage("Rest assured, I’m excited and I’ll keep working after you leave. Now checking the route.");
    expect(text).not.toMatch(/rest assured|excited|keep working after/i);
    expect(text).toContain("checking the route");
  });

  it("detects attachment, research, repository, design, generation, and testing work", () => {
    expect(detectWorkDomain({ attachments: [{ id: "a" }] })).toBe("attachment");
    expect(detectWorkDomain({ message: "Search the web and cite sources" })).toBe("research");
    expect(detectWorkDomain({ message: "Update the repository API" })).toBe("repository");
    expect(detectWorkDomain({ message: "Fix the mobile UI layout" })).toBe("design");
    expect(detectWorkDomain({ message: "Generate an image and video" })).toBe("generation");
    expect(detectWorkDomain({ message: "Run tests and verify deployment" })).toBe("testing");
  });

  it("supports truthful autosave and background language only when confirmed", () => {
    const event = buildHumanWorkEvent({
      eventType: "file_written",
      autosaveConfirmed: true,
      backgroundExecutionConfirmed: false,
      currentAction: "Saved the verified file change.",
      evidenceLevel: "persistence_verified",
      evidenceSummary: "The write returned a durable record.",
      nextAction: "Run validation.",
    }) as any;
    expect(event.autosaveConfirmed).toBe(true);
    expect(event.backgroundExecutionConfirmed).toBe(false);
  });

  it("communicates blockers, retryability, partial completion, and required user action", () => {
    const event = buildHumanWorkEvent({
      eventType: "partial_completion",
      status: "partial",
      partial: true,
      completedItems: ["Backend connected"],
      remainingItems: ["Production credential required"],
      blockedReason: "The deployment credential is unavailable.",
      userActionRequired: true,
      retryable: true,
      currentAction: "Preserving completed backend work.",
      nextAction: "Resume deployment after the credential is available.",
      evidenceLevel: "runtime_verified",
      evidenceSummary: "The backend integration test passed.",
      verificationState: "passed",
    }) as any;
    expect(event.partial).toBe(true);
    expect(event.userActionRequired).toBe(true);
    expect(event.retryable).toBe(true);
    expect(event.remainingItems).toEqual(["Production credential required"]);
  });

  it("rejects false completion and accepts evidence-backed completion", () => {
    expect(validateCompletionEvidence({ status: "completed", remainingItems: ["Deploy"], evidenceLevel: "test_verified", verificationState: "passed" }).ok).toBe(false);
    expect(validateCompletionEvidence({ status: "completed", remainingItems: [], evidenceLevel: "none", verificationState: "passed" }).ok).toBe(false);
    expect(validateCompletionEvidence({ status: "completed", remainingItems: [], evidenceLevel: "deployment_verified", verificationState: "passed" }).ok).toBe(true);
  });

  it("creates a final receipt that distinguishes complete from partial", () => {
    const complete = buildFinalWorkReceipt({
      status: "completed",
      goal: "Ship the feature.",
      completedItems: ["Built", "Tested", "Deployed"],
      remainingItems: [],
      evidenceLevel: "deployment_verified",
      evidenceSummary: "The production deployment passed.",
      verificationState: "passed",
      nextAction: "No additional action is scheduled.",
    }) as any;
    expect(complete.completed).toBe(true);
    expect(complete.status).toBe("completed");

    const partial = buildFinalWorkReceipt({
      status: "partial",
      partial: true,
      completedItems: ["Built"],
      remainingItems: ["Deploy"],
      evidenceLevel: "test_verified",
      verificationState: "passed",
    }) as any;
    expect(partial.completed).toBe(false);
    expect(partial.status).toBe("partial");
  });
});
