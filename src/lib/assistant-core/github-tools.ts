import type {
  AssembledAssistantContext,
  ToolProgressHandlers,
} from "./contracts";
import { resolveGitHub, withConnector } from "@/lib/connector/runtime";
import {
  getGitHubBranch,
  getGitHubRepo,
  getGitHubWorkflowRuns,
  listGitHubCommits,
  validateGitHubToken,
} from "@/lib/streams/connectors/github";

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

type ExecuteGitHubToolInput = {
  name: string;
  args: Record<string, unknown>;
  context: AssembledAssistantContext;
};

const GITHUB_TOOL_NAMES = new Set([
  "github_connection_status",
  "github_get_repository",
  "github_get_branch",
  "github_list_commits",
  "github_get_workflow_runs",
]);

function stringArg(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberArg(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function splitRepository(fullName: string): { owner: string; repo: string } | null {
  const [owner, repo, ...extra] = fullName.split("/").map((part) => part.trim());
  if (!owner || !repo || extra.length) return null;
  return { owner, repo };
}

async function resolveAssistantGitHub(context: AssembledAssistantContext) {
  const projectId = stringArg(context.projectId || context.context.projectId);
  const workspaceId = stringArg(context.workspaceId || context.context.workspaceId);

  if (!projectId || !workspaceId) {
    return {
      projectId,
      workspaceId,
      resolution: null,
      error: "GitHub access requires an authenticated project and workspace context.",
    };
  }

  const resolution = await resolveGitHub(projectId, workspaceId);
  if (resolution.error) {
    return { projectId, workspaceId, resolution, error: resolution.error };
  }
  if (!resolution.context) {
    return {
      projectId,
      workspaceId,
      resolution,
      error: "No active GitHub repository is connected to this project.",
    };
  }

  return { projectId, workspaceId, resolution, error: null };
}

export function isAssistantGitHubTool(name: string): boolean {
  return GITHUB_TOOL_NAMES.has(name);
}

export function buildAssistantGitHubTools(): AssistantFunctionToolDefinition[] {
  const emptyParameters = {
    type: "object" as const,
    properties: {},
    required: [] as string[],
    additionalProperties: false,
  };

  return [
    {
      type: "function",
      name: "github_connection_status",
      description:
        "Check whether GitHub is connected for the active project and return the authorized repository, branch, username, and token scopes. Use this before answering whether GitHub access is available.",
      strict: true,
      parameters: emptyParameters,
    },
    {
      type: "function",
      name: "github_get_repository",
      description:
        "Read metadata for the GitHub repository connected to the active project.",
      strict: true,
      parameters: emptyParameters,
    },
    {
      type: "function",
      name: "github_get_branch",
      description:
        "Read the latest commit information for a branch in the connected GitHub repository.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          branch: {
            type: "string",
            description: "Branch name. Defaults to the project's connected branch.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "github_list_commits",
      description:
        "List recent commits from a branch in the connected GitHub repository.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          branch: {
            type: "string",
            description: "Branch name. Defaults to the project's connected branch.",
          },
          limit: {
            type: "number",
            description: "Maximum commits to return, from 1 to 25. Defaults to 10.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "github_get_workflow_runs",
      description:
        "Read recent GitHub Actions workflow runs for a branch in the connected repository.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          branch: {
            type: "string",
            description: "Branch name. Defaults to the project's connected branch.",
          },
          limit: {
            type: "number",
            description: "Maximum workflow runs to return, from 1 to 20. Defaults to 5.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  ];
}

export async function executeAssistantGitHubTool(
  input: ExecuteGitHubToolInput,
  handlers?: ToolProgressHandlers,
): Promise<JsonObject> {
  if (!isAssistantGitHubTool(input.name)) {
    return { ok: false, error: `Unknown GitHub tool: ${input.name}` };
  }

  handlers?.onProgress?.("checking the project GitHub connection");
  const resolved = await resolveAssistantGitHub(input.context);
  if (resolved.error || !resolved.resolution?.context) {
    return {
      ok: false,
      connected: false,
      error: resolved.error || "GitHub is not connected.",
    };
  }

  const github = resolved.resolution.context;
  const repository = splitRepository(github.repo);
  if (!repository) {
    return {
      ok: false,
      connected: true,
      error: `The connected GitHub repository value is invalid: ${github.repo}`,
    };
  }

  const branch = stringArg(input.args.branch, github.branch || "main");
  const common = {
    provider: "github" as const,
    actionType: "read" as const,
    projectId: resolved.projectId,
    workspaceId: resolved.workspaceId,
    accountId: resolved.resolution.accountId || undefined,
    actor: "streams-ai",
    resourceType: "repository",
    resourceRef: github.repo,
  };

  if (input.name === "github_connection_status") {
    const validation = await withConnector(
      {
        ...common,
        operation: "github.connectionStatus",
        inputSummary: { repository: github.repo, branch: github.branch },
      },
      () => validateGitHubToken(github.token),
    );

    return {
      ok: !validation.error && Boolean(validation.data?.valid),
      connected: !validation.error && Boolean(validation.data?.valid),
      repository: github.repo,
      branch: github.branch,
      username: validation.data?.username || null,
      scopes: validation.data?.scopes || github.scopes || [],
      error: validation.error || validation.data?.error || null,
    };
  }

  if (input.name === "github_get_repository") {
    const result = await withConnector(
      {
        ...common,
        operation: "github.getRepository",
        inputSummary: { repository: github.repo },
      },
      () => getGitHubRepo(github.token, repository.owner, repository.repo),
    );

    return {
      ok: !result.error && Boolean(result.data),
      connected: true,
      repository: result.data,
      error: result.error || (result.data ? null : "Repository was not found or is not authorized."),
    };
  }

  if (input.name === "github_get_branch") {
    const result = await withConnector(
      {
        ...common,
        operation: "github.getBranch",
        resourceType: "branch",
        resourceRef: `${github.repo}:${branch}`,
        inputSummary: { repository: github.repo, branch },
      },
      () => getGitHubBranch(github.token, repository.owner, repository.repo, branch),
    );

    return {
      ok: !result.error && Boolean(result.data),
      connected: true,
      repository: github.repo,
      branch,
      latestCommit: result.data,
      error: result.error || (result.data ? null : "Branch was not found or is not authorized."),
    };
  }

  if (input.name === "github_list_commits") {
    const limit = numberArg(input.args.limit, 10, 25);
    const result = await withConnector(
      {
        ...common,
        operation: "github.listCommits",
        resourceType: "branch",
        resourceRef: `${github.repo}:${branch}`,
        inputSummary: { repository: github.repo, branch, limit },
      },
      () => listGitHubCommits(github.token, repository.owner, repository.repo, branch, limit),
    );

    return {
      ok: !result.error,
      connected: true,
      repository: github.repo,
      branch,
      commits: result.data || [],
      error: result.error,
    };
  }

  const limit = numberArg(input.args.limit, 5, 20);
  const result = await withConnector(
    {
      ...common,
      operation: "github.getWorkflowRuns",
      resourceType: "branch",
      resourceRef: `${github.repo}:${branch}`,
      inputSummary: { repository: github.repo, branch, limit },
    },
    () => getGitHubWorkflowRuns(github.token, repository.owner, repository.repo, branch, limit),
  );

  return {
    ok: !result.error,
    connected: true,
    repository: github.repo,
    branch,
    workflowRuns: result.data || [],
    error: result.error,
  };
}
