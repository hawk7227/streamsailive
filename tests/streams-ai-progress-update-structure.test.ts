import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildStructuredProgressUpdate, progressUpdateMessage } from "@/lib/streams-ai/runtime/progress-update-structure";

const jobsSource = readFileSync("src/lib/streams-ai/repositories/jobs-repository.ts", "utf8");
const historySource = readFileSync("src/components/streams-ai/current-chat/StreamsAIWorkHistoryBridge.jsx", "utf8");

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

  it("persists the canonical structure on every durable job event", () => {
    expect(jobsSource).toContain("buildStructuredProgressUpdate");
    expect(jobsSource).toContain("progressUpdate,");
    expect(jobsSource).toContain("completedWork: progressUpdate.completedWork");
    expect(jobsSource).toContain("evidence: progressUpdate.evidence");
    expect(jobsSource).toContain("remainingWork: progressUpdate.remainingWork");
  });

  it("renders all five required fields in the restored activity interface", () => {
    expect(historySource).toContain("Goal:");
    expect(historySource).toContain("Completed:");
    expect(historySource).toContain("Now:");
    expect(historySource).toContain("Evidence:");
    expect(historySource).toContain("Next:");
    expect(historySource).toContain("Current structured progress update");
  });
});
