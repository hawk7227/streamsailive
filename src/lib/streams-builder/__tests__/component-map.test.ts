import { describe, expect, it } from "vitest";
import { deriveComponentMap } from "../component-map";
import type { StreamsBuilderProjectView } from "../projects";

function project(overrides: Partial<StreamsBuilderProjectView> = {}): StreamsBuilderProjectView {
  return {
    projectId: "project-1",
    name: "Project",
    repo: "hawk7227/streamsailive",
    branch: "main",
    activeRoute: "/streams-ai/streams-builder",
    activePreviewUrl: "https://streamsailive.vercel.app/streams-ai/streams-builder",
    component: "StreamsBuilderDashboard",
    file: "src/components/streams-builder/StreamsBuilderDashboard.tsx",
    githubPath: "src/components/streams-builder/StreamsBuilderDashboard.tsx",
    jobId: "job-1",
    checkpointId: null,
    proofState: "PROVEN",
    approvalState: "ready",
    latestJobState: "completed",
    unreadNotificationCount: 0,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Streams Builder component map", () => {
  it("maps route to component and source file", () => {
    const rows = deriveComponentMap([project()]);
    expect(rows).toHaveLength(1);
    expect(rows[0].route).toBe("/streams-ai/streams-builder");
    expect(rows[0].component).toBe("StreamsBuilderDashboard");
    expect(rows[0].truthState).toBe("PROVEN");
  });

  it("marks missing ownership as unproven", () => {
    const rows = deriveComponentMap([project({ component: null })]);
    expect(rows[0].truthState).toBe("UNPROVEN");
    expect(rows[0].missing).toContain("component");
  });
});
