import { describe, expect, it } from "vitest";
import { assertProjectAccess, canApproveProject, canReviewProject, canViewProject, canWriteProject } from "../permissions";

describe("Streams Builder permissions", () => {
  it("allows role-based project actions", () => {
    expect(canViewProject("viewer")).toBe(true);
    expect(canReviewProject("reviewer")).toBe(true);
    expect(canApproveProject("approver")).toBe(true);
    expect(canWriteProject("builder")).toBe(true);
  });

  it("blocks missing project/session ids", () => {
    const errors = assertProjectAccess({ projectId: "", sessionId: "", role: "viewer", action: "view" });
    expect(errors).toContain("projectId is required.");
    expect(errors).toContain("sessionId is required.");
  });

  it("blocks insufficient review permission", () => {
    const errors = assertProjectAccess({ projectId: "project-1", sessionId: "session-1", role: "viewer", action: "review" });
    expect(errors).toContain("review permission denied.");
  });
});
