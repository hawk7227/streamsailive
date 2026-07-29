import type { AssembledAssistantContext, ToolProgressHandlers } from "./contracts";
import { resolveGitHub, withConnector } from "@/lib/connector/runtime";
import { validateGitHubToken } from "@/lib/streams/connectors/github";
import * as githubApi from "@/lib/streams/connectors/github-full";

export type AssistantFunctionToolDefinition = {
  type: "function";
  name: string;
  description: string;
  strict: boolean | null;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
};

type JsonObject = Record<string, unknown>;
type ExecuteGitHubToolInput = { name: string; args: Record<string, unknown>; context: AssembledAssistantContext };
type ToolSpec = { name: string; description: string; properties?: Record<string, unknown>; required?: string[]; destructive?: boolean };

const S = (description?: string) => ({ type: "string", ...(description ? { description } : {}) });
const N = (description?: string) => ({ type: "number", ...(description ? { description } : {}) });
const B = (description?: string) => ({ type: "boolean", ...(description ? { description } : {}) });
const A = (items: Record<string, unknown>, description?: string) => ({ type: "array", items, ...(description ? { description } : {}) });
const O = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });

const TOOL_SPECS: ToolSpec[] = [
  { name: "github_connection_status", description: "Verify the active project's GitHub connection, authorized repository, branch, username, and scopes." },
  { name: "github_list_repositories", description: "List repositories accessible through the connected GitHub account.", properties: { visibility: S(), page: N(), limit: N() } },
  { name: "github_get_repository", description: "Read metadata for the connected repository." },
  { name: "github_list_branches", description: "List branches in the connected repository.", properties: { limit: N() } },
  { name: "github_get_branch", description: "Read branch and latest commit information.", properties: { branch: S() } },
  { name: "github_create_branch", description: "Create a branch from a commit SHA or existing branch.", properties: { branch: S(), sha: S(), fromBranch: S() }, required: ["branch"] },
  { name: "github_update_branch_ref", description: "Move a branch to a commit SHA. Set force=true only when the user explicitly requests force-push.", properties: { branch: S(), sha: S(), force: B() }, required: ["branch", "sha"], destructive: true },
  { name: "github_delete_branch", description: "Delete a branch from the connected repository.", properties: { branch: S() }, required: ["branch"], destructive: true },
  { name: "github_list_tags", description: "List repository tags.", properties: { limit: N() } },
  { name: "github_create_tag", description: "Create an annotated tag and tag reference.", properties: { tag: S(), message: S(), object: S() }, required: ["tag", "message", "object"] },
  { name: "github_list_commits", description: "List commits, optionally filtered by branch/ref or path.", properties: { ref: S(), path: S(), limit: N() } },
  { name: "github_get_commit", description: "Read a commit by SHA or ref.", properties: { ref: S() }, required: ["ref"] },
  { name: "github_compare_commits", description: "Compare two commits or branches and return changed files and statistics.", properties: { base: S(), head: S() }, required: ["base", "head"] },
  { name: "github_get_diff", description: "Return the raw unified diff between two commits or branches.", properties: { base: S(), head: S() }, required: ["base", "head"] },
  { name: "github_get_tree", description: "Read a Git tree recursively.", properties: { treeSha: S(), recursive: B() }, required: ["treeSha"] },
  { name: "github_get_content", description: "Read a file or directory from the repository.", properties: { path: S(), ref: S() }, required: ["path"] },
  { name: "github_write_file", description: "Create or update one repository file and commit it.", properties: { path: S(), content: S(), message: S(), branch: S(), sha: S() }, required: ["path", "content", "message"] },
  { name: "github_delete_file", description: "Delete one repository file and commit the deletion.", properties: { path: S(), message: S(), sha: S(), branch: S() }, required: ["path", "message", "sha"], destructive: true },
  { name: "github_commit_files", description: "Create one commit containing multiple file creates, updates, or deletions.", properties: { branch: S(), message: S(), files: A(O({ path: S(), content: S(), delete: B() }, ["path"])) }, required: ["branch", "message", "files"] },
  { name: "github_search_code", description: "Search GitHub code. Include repo:owner/name in the query when repository-scoped search is intended.", properties: { query: S(), limit: N() }, required: ["query"] },
  { name: "github_search_commits", description: "Search GitHub commits.", properties: { query: S(), limit: N() }, required: ["query"] },
  { name: "github_search_issues", description: "Search issues and pull requests.", properties: { query: S(), limit: N() }, required: ["query"] },
  { name: "github_search_repositories", description: "Search GitHub repositories.", properties: { query: S(), limit: N() }, required: ["query"] },
  { name: "github_search_users", description: "Search GitHub users.", properties: { query: S(), limit: N() }, required: ["query"] },
  { name: "github_list_issues", description: "List repository issues.", properties: { state: { type: "string", enum: ["open", "closed", "all"] } } },
  { name: "github_create_issue", description: "Create an issue.", properties: { title: S(), body: S(), labels: A(S()), assignees: A(S()) }, required: ["title"] },
  { name: "github_update_issue", description: "Update an issue title, body, state, labels, assignees, or milestone.", properties: { issueNumber: N(), title: S(), body: S(), state: S(), labels: A(S()), assignees: A(S()), milestone: N() }, required: ["issueNumber"] },
  { name: "github_add_issue_comment", description: "Add a comment to an issue or pull request conversation.", properties: { issueNumber: N(), body: S() }, required: ["issueNumber", "body"] },
  { name: "github_list_issue_comments", description: "List comments on an issue or pull request.", properties: { issueNumber: N() }, required: ["issueNumber"] },
  { name: "github_list_labels", description: "List repository labels." },
  { name: "github_create_label", description: "Create a repository label.", properties: { name: S(), color: S(), description: S() }, required: ["name", "color"] },
  { name: "github_update_label", description: "Update a repository label.", properties: { currentName: S(), name: S(), color: S(), description: S() }, required: ["currentName"] },
  { name: "github_delete_label", description: "Delete a repository label.", properties: { name: S() }, required: ["name"], destructive: true },
  { name: "github_list_pull_requests", description: "List pull requests.", properties: { state: { type: "string", enum: ["open", "closed", "all"] } } },
  { name: "github_get_pull_request", description: "Read pull request metadata.", properties: { pullNumber: N() }, required: ["pullNumber"] },
  { name: "github_create_pull_request", description: "Open a pull request.", properties: { title: S(), head: S(), base: S(), body: S(), draft: B(), maintainerCanModify: B() }, required: ["title", "head", "base"] },
  { name: "github_update_pull_request", description: "Update a pull request title, body, state, or base branch.", properties: { pullNumber: N(), title: S(), body: S(), state: S(), base: S() }, required: ["pullNumber"] },
  { name: "github_list_pull_request_files", description: "List files changed by a pull request.", properties: { pullNumber: N() }, required: ["pullNumber"] },
  { name: "github_list_pull_request_reviews", description: "List pull request reviews.", properties: { pullNumber: N() }, required: ["pullNumber"] },
  { name: "github_create_pull_request_review", description: "Approve, request changes, or comment on a pull request review.", properties: { pullNumber: N(), body: S(), event: { type: "string", enum: ["APPROVE", "REQUEST_CHANGES", "COMMENT"] } }, required: ["pullNumber"] },
  { name: "github_merge_pull_request", description: "Merge a pull request using merge, squash, or rebase.", properties: { pullNumber: N(), mergeMethod: { type: "string", enum: ["merge", "squash", "rebase"] }, commitTitle: S(), commitMessage: S(), sha: S() }, required: ["pullNumber"], destructive: true },
  { name: "github_list_releases", description: "List repository releases." },
  { name: "github_create_release", description: "Create a release.", properties: { tagName: S(), targetCommitish: S(), name: S(), body: S(), draft: B(), prerelease: B(), generateReleaseNotes: B() }, required: ["tagName"] },
  { name: "github_update_release", description: "Update a release.", properties: { releaseId: N(), tagName: S(), targetCommitish: S(), name: S(), body: S(), draft: B(), prerelease: B() }, required: ["releaseId"] },
  { name: "github_delete_release", description: "Delete a release.", properties: { releaseId: N() }, required: ["releaseId"], destructive: true },
  { name: "github_list_workflows", description: "List GitHub Actions workflows." },
  { name: "github_list_workflow_runs", description: "List workflow runs, optionally filtered by branch or status.", properties: { branch: S(), status: S(), limit: N() } },
  { name: "github_get_workflow_run", description: "Read one workflow run.", properties: { runId: N() }, required: ["runId"] },
  { name: "github_rerun_workflow", description: "Rerun all jobs or only failed jobs in a workflow run.", properties: { runId: N(), failedOnly: B() }, required: ["runId"] },
  { name: "github_cancel_workflow_run", description: "Cancel an active workflow run.", properties: { runId: N() }, required: ["runId"], destructive: true },
  { name: "github_list_check_runs", description: "List check runs for a commit or ref.", properties: { ref: S() }, required: ["ref"] },
  { name: "github_get_combined_status", description: "Read the combined commit status and individual statuses.", properties: { ref: S() }, required: ["ref"] },
  { name: "github_list_deployments", description: "List deployments, optionally filtered by ref or environment.", properties: { ref: S(), environment: S() } },
  { name: "github_list_deployment_statuses", description: "List statuses for a deployment.", properties: { deploymentId: N() }, required: ["deploymentId"] },
];

const GITHUB_TOOL_NAMES = new Set(TOOL_SPECS.map((tool) => tool.name));
const DESTRUCTIVE_TOOLS = new Set(TOOL_SPECS.filter((tool) => tool.destructive).map((tool) => tool.name));

function stringArg(value: unknown, fallback = ""): string { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
function numberArg(value: unknown, fallback = 0, max = 100): number { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback; }
function boolArg(value: unknown, fallback = false): boolean { return typeof value === "boolean" ? value : fallback; }
function splitRepository(fullName: string) { const [owner, repo, ...extra] = fullName.split("/").map((v) => v.trim()); return owner && repo && !extra.length ? { owner, repo } : null; }
function cleanObject(input: Record<string, unknown>) { return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== "")); }

async function resolveAssistantGitHub(context: AssembledAssistantContext) {
  const projectId = stringArg(context.projectId || context.context.projectId);
  const workspaceId = stringArg(context.workspaceId || context.context.workspaceId);
  if (!projectId || !workspaceId) return { projectId, workspaceId, resolution: null, error: "GitHub access requires an authenticated project and workspace context." };
  const resolution = await resolveGitHub(projectId, workspaceId);
  if (resolution.error) return { projectId, workspaceId, resolution, error: resolution.error };
  if (!resolution.context) return { projectId, workspaceId, resolution, error: "No active GitHub repository is connected to this project." };
  return { projectId, workspaceId, resolution, error: null };
}

export function isAssistantGitHubTool(name: string): boolean { return GITHUB_TOOL_NAMES.has(name); }
export function buildAssistantGitHubTools(): AssistantFunctionToolDefinition[] {
  return TOOL_SPECS.map((tool) => ({ type: "function", name: tool.name, description: tool.description, strict: true, parameters: { type: "object", properties: tool.properties || {}, required: tool.required || [], additionalProperties: false } }));
}

export async function executeAssistantGitHubTool(input: ExecuteGitHubToolInput, handlers?: ToolProgressHandlers): Promise<JsonObject> {
  if (!isAssistantGitHubTool(input.name)) return { ok: false, error: `Unknown GitHub tool: ${input.name}` };
  handlers?.onProgress?.("checking the project GitHub connection");
  const resolved = await resolveAssistantGitHub(input.context);
  if (resolved.error || !resolved.resolution?.context) return { ok: false, connected: false, error: resolved.error || "GitHub is not connected." };

  const github = resolved.resolution.context;
  const repository = splitRepository(github.repo);
  if (!repository) return { ok: false, connected: true, error: `Invalid connected repository: ${github.repo}` };
  const { owner, repo } = repository;
  const a = input.args;
  const branch = stringArg(a.branch, github.branch || "main");
  const limit = numberArg(a.limit, 100, 100);
  const common = {
    provider: "github" as const,
    actionType: (DESTRUCTIVE_TOOLS.has(input.name) ? "destructive" : input.name.startsWith("github_get") || input.name.startsWith("github_list") || input.name.startsWith("github_search") || input.name === "github_connection_status" || input.name === "github_compare_commits" ? "read" : "write") as "read" | "write" | "destructive",
    projectId: resolved.projectId,
    workspaceId: resolved.workspaceId,
    sessionId: stringArg(input.context.conversationId || input.context.context.sessionId) || undefined,
    accountId: resolved.resolution.accountId || undefined,
    actor: "streams-ai",
    resourceType: "repository",
    resourceRef: github.repo,
    requiresDestructiveApproval: DESTRUCTIVE_TOOLS.has(input.name),
    operation: input.name,
    inputSummary: { repository: github.repo, ...cleanObject(a) },
  };

  const run = async () => {
    switch (input.name) {
      case "github_connection_status": return validateGitHubToken(github.token);
      case "github_list_repositories": return githubApi.listGitHubRepositories(github.token, { visibility: stringArg(a.visibility, "all"), perPage: limit, page: numberArg(a.page, 1, 1000) });
      case "github_get_repository": return githubApi.getGitHubRepository(github.token, owner, repo);
      case "github_list_branches": return githubApi.listGitHubBranches(github.token, owner, repo, limit);
      case "github_get_branch": return githubApi.getGitHubBranch(github.token, owner, repo, branch);
      case "github_create_branch": {
        let sha = stringArg(a.sha);
        if (!sha) { const source = await githubApi.getGitHubBranch(github.token, owner, repo, stringArg(a.fromBranch, github.branch || "main")); sha = source.commit.sha; }
        return githubApi.createGitHubBranch(github.token, owner, repo, branch, sha);
      }
      case "github_update_branch_ref": return githubApi.updateGitHubBranchRef(github.token, owner, repo, branch, stringArg(a.sha), boolArg(a.force));
      case "github_delete_branch": return githubApi.deleteGitHubBranch(github.token, owner, repo, branch);
      case "github_list_tags": return githubApi.listGitHubTags(github.token, owner, repo, limit);
      case "github_create_tag": return githubApi.createGitHubTag(github.token, owner, repo, { tag: stringArg(a.tag), message: stringArg(a.message), object: stringArg(a.object) });
      case "github_list_commits": return githubApi.listGitHubCommits(github.token, owner, repo, { sha: stringArg(a.ref, branch), path: stringArg(a.path) || undefined, perPage: limit });
      case "github_get_commit": return githubApi.getGitHubCommit(github.token, owner, repo, stringArg(a.ref));
      case "github_compare_commits": return githubApi.compareGitHubCommits(github.token, owner, repo, stringArg(a.base), stringArg(a.head));
      case "github_get_diff": return { diff: await githubApi.getGitHubDiff(github.token, owner, repo, stringArg(a.base), stringArg(a.head)) };
      case "github_get_tree": return githubApi.getGitHubTree(github.token, owner, repo, stringArg(a.treeSha), boolArg(a.recursive, true));
      case "github_get_content": return githubApi.getGitHubContent(github.token, owner, repo, stringArg(a.path), stringArg(a.ref) || undefined);
      case "github_write_file": return githubApi.createOrUpdateGitHubFile(github.token, owner, repo, { path: stringArg(a.path), content: stringArg(a.content), message: stringArg(a.message), branch: stringArg(a.branch) || undefined, sha: stringArg(a.sha) || undefined });
      case "github_delete_file": return githubApi.deleteGitHubFile(github.token, owner, repo, { path: stringArg(a.path), message: stringArg(a.message), sha: stringArg(a.sha), branch: stringArg(a.branch) || undefined });
      case "github_commit_files": return githubApi.commitMultipleGitHubFiles(github.token, owner, repo, { branch, message: stringArg(a.message), files: Array.isArray(a.files) ? a.files as Array<{ path: string; content?: string; delete?: boolean }> : [] });
      case "github_search_code": return githubApi.searchGitHubCode(github.token, stringArg(a.query), limit);
      case "github_search_commits": return githubApi.searchGitHubCommits(github.token, stringArg(a.query), limit);
      case "github_search_issues": return githubApi.searchGitHubIssuesAndPullRequests(github.token, stringArg(a.query), limit);
      case "github_search_repositories": return githubApi.searchGitHubRepositories(github.token, stringArg(a.query), limit);
      case "github_search_users": return githubApi.searchGitHubUsers(github.token, stringArg(a.query), limit);
      case "github_list_issues": return githubApi.listGitHubIssues(github.token, owner, repo, (stringArg(a.state, "open") as "open" | "closed" | "all"));
      case "github_create_issue": return githubApi.createGitHubIssue(github.token, owner, repo, cleanObject({ title: stringArg(a.title), body: stringArg(a.body), labels: a.labels, assignees: a.assignees }));
      case "github_update_issue": { const { issueNumber, ...rest } = a; return githubApi.updateGitHubIssue(github.token, owner, repo, numberArg(issueNumber), cleanObject(rest)); }
      case "github_add_issue_comment": return githubApi.addGitHubIssueComment(github.token, owner, repo, numberArg(a.issueNumber), stringArg(a.body));
      case "github_list_issue_comments": return githubApi.listGitHubIssueComments(github.token, owner, repo, numberArg(a.issueNumber));
      case "github_list_labels": return githubApi.listGitHubLabels(github.token, owner, repo);
      case "github_create_label": return githubApi.createGitHubLabel(github.token, owner, repo, { name: stringArg(a.name), color: stringArg(a.color), description: stringArg(a.description) || undefined });
      case "github_update_label": return githubApi.updateGitHubLabel(github.token, owner, repo, stringArg(a.currentName), cleanObject({ name: a.name, color: a.color, description: a.description }));
      case "github_delete_label": return githubApi.deleteGitHubLabel(github.token, owner, repo, stringArg(a.name));
      case "github_list_pull_requests": return githubApi.listGitHubPullRequests(github.token, owner, repo, (stringArg(a.state, "open") as "open" | "closed" | "all"));
      case "github_get_pull_request": return githubApi.getGitHubPullRequest(github.token, owner, repo, numberArg(a.pullNumber));
      case "github_create_pull_request": return githubApi.createGitHubPullRequest(github.token, owner, repo, { title: stringArg(a.title), head: stringArg(a.head), base: stringArg(a.base), body: stringArg(a.body) || undefined, draft: boolArg(a.draft), maintainer_can_modify: boolArg(a.maintainerCanModify, true) });
      case "github_update_pull_request": { const { pullNumber, ...rest } = a; return githubApi.updateGitHubPullRequest(github.token, owner, repo, numberArg(pullNumber), cleanObject(rest)); }
      case "github_list_pull_request_files": return githubApi.listGitHubPullRequestFiles(github.token, owner, repo, numberArg(a.pullNumber));
      case "github_list_pull_request_reviews": return githubApi.listGitHubPullRequestReviews(github.token, owner, repo, numberArg(a.pullNumber));
      case "github_create_pull_request_review": return githubApi.createGitHubPullRequestReview(github.token, owner, repo, numberArg(a.pullNumber), { body: stringArg(a.body) || undefined, event: stringArg(a.event, "COMMENT") as "APPROVE" | "REQUEST_CHANGES" | "COMMENT" });
      case "github_merge_pull_request": return githubApi.mergeGitHubPullRequest(github.token, owner, repo, numberArg(a.pullNumber), cleanObject({ merge_method: stringArg(a.mergeMethod, "squash"), commit_title: stringArg(a.commitTitle), commit_message: stringArg(a.commitMessage), sha: stringArg(a.sha) }));
      case "github_list_releases": return githubApi.listGitHubReleases(github.token, owner, repo);
      case "github_create_release": return githubApi.createGitHubRelease(github.token, owner, repo, cleanObject({ tag_name: stringArg(a.tagName), target_commitish: stringArg(a.targetCommitish), name: stringArg(a.name), body: stringArg(a.body), draft: boolArg(a.draft), prerelease: boolArg(a.prerelease), generate_release_notes: boolArg(a.generateReleaseNotes) }));
      case "github_update_release": { const { releaseId, ...rest } = a; return githubApi.updateGitHubRelease(github.token, owner, repo, numberArg(releaseId), cleanObject(rest)); }
      case "github_delete_release": return githubApi.deleteGitHubRelease(github.token, owner, repo, numberArg(a.releaseId));
      case "github_list_workflows": return githubApi.listGitHubWorkflows(github.token, owner, repo);
      case "github_list_workflow_runs": return githubApi.listGitHubWorkflowRuns(github.token, owner, repo, { branch: stringArg(a.branch) || undefined, status: stringArg(a.status) || undefined, perPage: limit });
      case "github_get_workflow_run": return githubApi.getGitHubWorkflowRun(github.token, owner, repo, numberArg(a.runId));
      case "github_rerun_workflow": return githubApi.rerunGitHubWorkflow(github.token, owner, repo, numberArg(a.runId), boolArg(a.failedOnly));
      case "github_cancel_workflow_run": return githubApi.cancelGitHubWorkflowRun(github.token, owner, repo, numberArg(a.runId));
      case "github_list_check_runs": return githubApi.listGitHubCheckRuns(github.token, owner, repo, stringArg(a.ref));
      case "github_get_combined_status": return githubApi.getGitHubCombinedStatus(github.token, owner, repo, stringArg(a.ref));
      case "github_list_deployments": return githubApi.listGitHubDeployments(github.token, owner, repo, { ref: stringArg(a.ref) || undefined, environment: stringArg(a.environment) || undefined });
      case "github_list_deployment_statuses": return githubApi.listGitHubDeploymentStatuses(github.token, owner, repo, numberArg(a.deploymentId));
      default: throw new Error(`Unhandled GitHub tool: ${input.name}`);
    }
  };

  handlers?.onProgress?.(`running ${input.name}`);
  const result = await withConnector(common, run);
  if (input.name === "github_connection_status") {
    const data = result.data as { valid?: boolean; username?: string; scopes?: string[]; error?: string } | null;
    return { ok: !result.error && Boolean(data?.valid), connected: !result.error && Boolean(data?.valid), repository: github.repo, branch: github.branch, username: data?.username || null, scopes: data?.scopes || github.scopes || [], error: result.error || data?.error || null };
  }
  return { ok: !result.error, connected: true, repository: github.repo, branch: github.branch, result: result.data, blocked: result.blocked, auditLogId: result.logId, error: result.error };
}
