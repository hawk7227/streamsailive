import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubPullRequestService } from "../src/lib/streams-builder/github-pull-request-service";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("reviewed builder pull request workflow", () => {
  const originalToken = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
  });

  it("blocks a pull request when preview and base branches match", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(new GitHubPullRequestService().create({
      repo: "owner/repo",
      baseBranch: "main",
      headBranch: "main",
      title: "Reviewed change",
    })).rejects.toMatchObject({ code: "PULL_REQUEST_BRANCHES_MATCH" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reuses an existing open pull request for the preview branch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response([{
      number: 42,
      html_url: "https://github.com/owner/repo/pull/42",
      title: "Existing reviewed change",
      state: "open",
      draft: false,
      base: { ref: "main" },
      head: { ref: "streams-preview-1", sha: "abc123" },
      requested_reviewers: [],
    }]));

    const result = await new GitHubPullRequestService().create({
      repo: "owner/repo",
      baseBranch: "main",
      headBranch: "streams-preview-1",
      title: "Reviewed change",
    });

    expect(result.created).toBe(false);
    expect(result.pullRequest.number).toBe(42);
    expect(result.pullRequest.headBranch).toBe("streams-preview-1");
  });

  it("requires real review and successful checks before merge is allowed", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response({
        number: 42,
        html_url: "https://github.com/owner/repo/pull/42",
        title: "Reviewed change",
        state: "open",
        draft: false,
        mergeable: true,
        mergeable_state: "clean",
        base: { ref: "main" },
        head: { ref: "streams-preview-1", sha: "abc123" },
        requested_reviewers: [],
      }))
      .mockResolvedValueOnce(response({ check_runs: [{ name: "Production", status: "completed", conclusion: "success", details_url: "https://checks.example" }] }))
      .mockResolvedValueOnce(response([{ user: { login: "reviewer" }, state: "APPROVED" }]));

    const result = await new GitHubPullRequestService().read("owner/repo", 42);
    expect(result.approvalState).toBe("approved");
    expect(result.checksPassed).toBe(true);
    expect(result.mergeAllowed).toBe(true);
  });
});
