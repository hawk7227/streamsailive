import { describe, expect, it } from "vitest";
import { buildStructuredProgressUpdate, progressUpdateMessage } from "@/lib/streams-ai/runtime/progress-update-structure";

describe("Streams AI Item 5 structured progress updates", () => {
  it("normalizes goal, completed work, current action, evidence, and next action", () => {
    const update = buildStructuredProgressUpdate({
      goal: "Repair the live chat.",
      completedItems: ["Inspected the active route"],
      currentAction: "Updating the durable event layer.",
      evidenceLevel: "source_verified",
      evidenceSummary: "The active route uses the existing jobs ledger.",
      verificationState: "in_progress",
      nextAction: "Run the production contract suite.",
      remainingItems: ["Run tests", "Verify deployment"],
      planVersion: 2,
    });

    expect(update.goal).toBe("Repair the live chat.");
    expect(update.completedWork).toEqual(["Inspected the active route"]);
    expect(update.currentAction).toBe("Updating the durable event layer.");
    expect(update.evidence).toEqual({
      level: "source_verified",
      summary: "The active route uses the existing jobs ledger.",
      verificationState: "in_progress",
    });
    expect(update.nextAction).toBe("Run the production contract suite.");
    expect(update.remainingWork).toEqual(["Run tests", "Verify deployment"]);
    expect(update.planVersion).toBe(2);
  });

  it("creates useful narration without percentages or private reasoning", () => {
    const message = progressUpdateMessage(buildStructuredProgressUpdate({
      goal: "Complete the task.",
      currentAction: "Checking the active implementation.",
      evidenceSummary: "Repository source is being inspected.",
      nextAction: "Persist the verified finding.",
    }));
    expect(message).toContain("Now:");
    expect(message).toContain("Evidence:");
    expect(message).toContain("Next:");
    expect(message).not.toMatch(/\d+%|chain[- ]of[- ]thought|scratchpad/i);
  });

  it("derives remaining work from planned phases when explicit remaining items are absent", () => {
    const update = buildStructuredProgressUpdate({
      goal: "Complete the build.",
      phases: [
        { id: "inspect", label: "Inspect the active implementation" },
        { id: "implement", label: "Implement the missing behavior" },
        { id: "verify", label: "Verify the completed behavior" },
      ],
      completedItems: ["Inspect the active implementation"],
      currentAction: "Implementing the missing behavior.",
      nextAction: "Verify the completed behavior.",
    });

    expect(update.completedWork).toEqual(["Inspect the active implementation"]);
    expect(update.remainingWork).toEqual([
      "Implement the missing behavior",
      "Verify the completed behavior",
    ]);
  });

  it("sanitizes malformed and empty values into a stable user-facing contract", () => {
    const update = buildStructuredProgressUpdate({
      goal: "  ",
      completedItems: ["", null, { label: "Validated persistence" }],
      currentAction: "  Restoring history.  ",
      evidenceLevel: "runtime_verified",
      evidenceSummary: "  The durable event was read back.  ",
      verificationState: "passed",
      nextAction: "  Deliver the restored update.  ",
      planVersion: 0,
    });

    expect(update.completedWork).toEqual(["Validated persistence"]);
    expect(update.currentAction).toBe("Restoring history.");
    expect(update.evidence.summary).toBe("The durable event was read back.");
    expect(update.nextAction).toBe("Deliver the restored update.");
    expect(update.planVersion).toBe(1);
  });
});
