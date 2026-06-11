import { describe, expect, it } from "vitest";
import { deriveStreamsBuilderProjects } from "../projects";

describe("Streams Builder projects", () => {
  it("derives project views from real job rows", () => {
    const projects = deriveStreamsBuilderProjects([
      {
        id: "job-1",
        project_id: "project-1",
        status: "completed",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        input_json: {
          projectId: "project-1",
          projectName: "Builder Project",
          repoFullName: "hawk7227/streamsailive",
          branchName: "builder-branch",
          route: "/streams-ai/streams-builder",
          previewUrl: "https://streamsailive.vercel.app/streams-ai/streams-builder",
          component: "StreamsBuilderDashboard",
          githubPath: "src/components/streams-builder/StreamsBuilderDashboard.tsx",
          result: { truthState: "PROVEN", reviewState: "approved" },
        },
      },
    ]);

    expect(projects).toHaveLength(1);
    expect(projects[0].projectId).toBe("project-1");
    expect(projects[0].name).toBe("Builder Project");
    expect(projects[0].approvalState).toBe("approved");
    expect(projects[0].proofState).toBe("PROVEN");
  });

  it("returns empty when no rows are supplied", () => {
    expect(deriveStreamsBuilderProjects([])).toEqual([]);
  });
});
