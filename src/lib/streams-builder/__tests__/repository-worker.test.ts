import { describe, expect, it, vi } from "vitest";
import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import type { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { processRepositoryExecutionJob } from "../repository-worker";

const scope: StreamsAIScope = {
  tenantId: "tenant-123",
  userId: "user-123",
  defaultProjectId: "project-123",
  workspaceId: "streams-ai",
  moduleId: "streams-ai-core",
  productId: "streams-ai",
};

function createMockJobs() {
  return {
    update: vi.fn(async () => ({})),
    createEvent: vi.fn(async () => ({})),
  } as unknown as StreamsAIJobsRepository;
}

describe("Streams Builder repository worker", () => {
  it("blocks invalid repository execution jobs before sandbox commands run", async () => {
    const jobs = createMockJobs();
    const result = await processRepositoryExecutionJob(
      scope,
      {
        id: "job-123",
        project_id: "project-123",
        session_id: "session-123",
        input_json: {
          projectId: "project-123",
          sessionId: "session-123",
          repoFullName: "invalid-repo-name",
          requestedCommands: ["clone_repo"],
        },
      },
      jobs,
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.truthState).toBe("FAILED");
    expect(result.blockedReasons).toContain("repoFullName must be owner/name.");
    expect(jobs.update).toHaveBeenCalledWith(scope, "job-123", { status: "running" });
    expect(jobs.createEvent).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({ eventType: "repository.worker.blocked" }),
    );
  });

  it("blocks missing unified diffs before attempting patch execution", async () => {
    const jobs = createMockJobs();
    const result = await processRepositoryExecutionJob(
      scope,
      {
        id: "job-456",
        project_id: "project-123",
        session_id: "session-123",
        input_json: {
          projectId: "project-123",
          sessionId: "session-123",
          repoFullName: "hawk7227/streamsailive",
          requestedCommands: ["apply_unified_diff"],
        },
      },
      jobs,
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.blockedReasons).toContain("unifiedDiff is required before apply_unified_diff.");
  });
});
