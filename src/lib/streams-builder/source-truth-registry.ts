export type StreamsBuilderWorkspaceId =
  | "ai-build-chat"
  | "visual-editing"
  | "component-mapping"
  | "approval-center"
  | "browser-verification"
  | "repository-truth"
  | "projects-dashboard";

export type StreamsBuilderStatus =
  | "queued"
  | "running"
  | "building"
  | "repairing"
  | "failed"
  | "approved"
  | "merged"
  | "deployed"
  | "ready-for-approval"
  | "not-configured"
  | "unknown";

export type SourceTruthRecord = {
  id: string;
  projectId: string;
  workspaceId: StreamsBuilderWorkspaceId;
  route: string;
  previewUrl: string | null;
  component: string;
  file: string;
  githubPath: string;
  repository: string;
  buildJob: string | null;
  checkpoint: string | null;
  proofStatus: StreamsBuilderStatus;
  status: StreamsBuilderStatus;
  updatedAt: string;
};

export type ProjectContainer = {
  projectId: string;
  name: string;
  repository: string;
  owner: string;
  status: StreamsBuilderStatus;
  memory: string[];
  assets: string[];
  checkpoints: string[];
  proof: string[];
  deployments: string[];
  notifications: string[];
};

export type WorkspaceRecord = {
  id: StreamsBuilderWorkspaceId;
  label: string;
  responsibility: string;
  projectId: string;
  status: StreamsBuilderStatus;
  sourceTruthId: string;
};

export type RepositoryTruth = {
  repository: string;
  defaultBranch: string | null;
  pushedAt: string | null;
  updatedAt: string | null;
  htmlUrl: string | null;
  gitStatus: string;
  modifiedFiles: string[];
  untrackedFiles: string[];
  branches: Array<{ name: string; protected: boolean }>;
  commits: Array<{ sha: string; message: string; author: string | null; date: string | null; url: string | null }>;
  pullRequests: Array<{ number: number; title: string; state: string; url: string | null; branch: string | null }>;
  repositoryHealth: Array<{ name: string; status: StreamsBuilderStatus; detail: string }>;
};

export type BuilderNotificationEvent = {
  id: string;
  projectId: string;
  state: StreamsBuilderStatus;
  title: string;
  target: {
    projectId: string;
    route?: string;
    component?: string;
    buildJob?: string | null;
    approval?: string | null;
  };
  createdAt: string;
};

export type StreamsBuilderRegistrySnapshot = {
  project: ProjectContainer;
  workspaces: WorkspaceRecord[];
  sourceTruth: SourceTruthRecord[];
  activeSourceTruth: SourceTruthRecord | null;
  repositoryTruth: RepositoryTruth;
  notifications: BuilderNotificationEvent[];
};

export const STREAMS_BUILDER_WORKSPACES: Array<Omit<WorkspaceRecord, "projectId" | "status" | "sourceTruthId">> = [
  { id: "ai-build-chat", label: "AI Build Chat", responsibility: "Build handoff, patch intent, execution chat context." },
  { id: "visual-editing", label: "Visual Editing", responsibility: "UI-to-code selection, patch creation, preview update." },
  { id: "component-mapping", label: "Component Mapping", responsibility: "Route, component, import, export, and ownership traceability." },
  { id: "approval-center", label: "Approval Center", responsibility: "Evidence-gated approve, reject, rollback, and diff review." },
  { id: "browser-verification", label: "Browser Verification", responsibility: "Playwright, screenshots, responsive, accessibility, console, network checks." },
  { id: "repository-truth", label: "Repository Truth", responsibility: "Repository state, branches, commits, pull requests, and health." },
  { id: "projects-dashboard", label: "Projects Dashboard", responsibility: "Project containers, checkpoints, proof, deployments, and notifications." },
];

export function normalizeRepository(input?: string | null) {
  const value = input?.trim() || "hawk7227/streamsailive";
  if (!/^[-_.A-Za-z0-9]+\/[-_.A-Za-z0-9]+$/.test(value)) return "hawk7227/streamsailive";
  return value;
}

export function createProjectContainer(input: { projectId?: string | null; repository?: string | null; owner?: string | null; name?: string | null; status?: StreamsBuilderStatus }): ProjectContainer {
  const repository = normalizeRepository(input.repository);
  const projectId = input.projectId?.trim() || repository.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  return {
    projectId,
    name: input.name?.trim() || "Streams Builder",
    repository,
    owner: input.owner?.trim() || repository.split("/")[0] || "unknown",
    status: input.status || "unknown",
    memory: [],
    assets: [],
    checkpoints: [],
    proof: [],
    deployments: [],
    notifications: [],
  };
}

export function createSourceTruthRegistry(project: ProjectContainer, origin?: string | null): SourceTruthRecord[] {
  const previewUrl = origin ? `${origin}/streams-builder` : "/streams-builder";
  const now = new Date().toISOString();
  const rows: Array<[StreamsBuilderWorkspaceId, string, string, string, StreamsBuilderStatus]> = [
    ["ai-build-chat", "/streams-builder", "StreamsBuilderSystemShell", "src/components/streams-builder/StreamsBuilderSystemShell.tsx", project.status],
    ["visual-editing", "/streams-builder", "WorkspaceGrid", "src/components/streams-builder/WorkspaceGrid.tsx", "unknown"],
    ["component-mapping", "/streams-builder", "WorkspaceGrid", "src/components/streams-builder/WorkspaceGrid.tsx", "unknown"],
    ["approval-center", "/streams-builder", "WorkspaceGrid", "src/components/streams-builder/WorkspaceGrid.tsx", "not-configured"],
    ["browser-verification", "/streams-builder", "WorkspaceGrid", "src/components/streams-builder/WorkspaceGrid.tsx", "not-configured"],
    ["repository-truth", "/streams-builder", "WorkspaceGrid", "src/components/streams-builder/WorkspaceGrid.tsx", project.status],
    ["projects-dashboard", "/streams-builder", "ProjectThumbnailRail", "src/components/streams-builder/ProjectThumbnailRail.tsx", project.status],
  ];

  return rows.map(([workspaceId, route, component, file, status]) => ({
    id: `${project.projectId}:${workspaceId}`,
    projectId: project.projectId,
    workspaceId,
    route,
    previewUrl,
    component,
    file,
    githubPath: `https://github.com/${project.repository}/blob/main/${file}`,
    repository: project.repository,
    buildJob: null,
    checkpoint: null,
    proofStatus: status === "approved" || status === "ready-for-approval" ? status : "not-configured",
    status,
    updatedAt: now,
  }));
}

export function createWorkspaceRegistry(project: ProjectContainer, sourceTruth: SourceTruthRecord[]): WorkspaceRecord[] {
  return STREAMS_BUILDER_WORKSPACES.map((workspace) => {
    const truth = sourceTruth.find((item) => item.workspaceId === workspace.id);
    return {
      ...workspace,
      projectId: project.projectId,
      status: truth?.status || "unknown",
      sourceTruthId: truth?.id || `${project.projectId}:${workspace.id}`,
    };
  });
}

export function createNotifications(project: ProjectContainer, sourceTruth: SourceTruthRecord[], repositoryTruth: RepositoryTruth): BuilderNotificationEvent[] {
  const now = new Date().toISOString();
  const events: BuilderNotificationEvent[] = [];
  const failingHealth = repositoryTruth.repositoryHealth.filter((item) => item.status === "failed" || item.status === "not-configured");

  for (const item of failingHealth) {
    const truth = sourceTruth.find((row) => row.workspaceId === "repository-truth") || sourceTruth[0];
    events.push({
      id: `${project.projectId}:health:${item.name}`,
      projectId: project.projectId,
      state: item.status,
      title: `${item.name}: ${item.detail}`,
      target: { projectId: project.projectId, route: truth?.route, component: truth?.component, buildJob: truth?.buildJob, approval: truth?.checkpoint },
      createdAt: now,
    });
  }

  for (const pr of repositoryTruth.pullRequests.slice(0, 5)) {
    events.push({
      id: `${project.projectId}:pr:${pr.number}`,
      projectId: project.projectId,
      state: pr.state === "open" ? "ready-for-approval" : "merged",
      title: `Pull request #${pr.number}: ${pr.title}`,
      target: { projectId: project.projectId, route: "/streams-builder", component: "RepositoryTruth", buildJob: null, approval: String(pr.number) },
      createdAt: now,
    });
  }

  return events;
}

export function emptyRepositoryTruth(repository: string, detail = "GitHub token is not configured for live repository reads."): RepositoryTruth {
  return {
    repository,
    defaultBranch: null,
    pushedAt: null,
    updatedAt: null,
    htmlUrl: `https://github.com/${repository}`,
    gitStatus: "Remote repository available only after GITHUB_TOKEN is configured on the server.",
    modifiedFiles: [],
    untrackedFiles: [],
    branches: [],
    commits: [],
    pullRequests: [],
    repositoryHealth: [{ name: "GitHub execution", status: "not-configured", detail }],
  };
}

export function createSnapshot(input: { project: ProjectContainer; repositoryTruth: RepositoryTruth; origin?: string | null; activeWorkspaceId?: StreamsBuilderWorkspaceId | null }): StreamsBuilderRegistrySnapshot {
  const sourceTruth = createSourceTruthRegistry(input.project, input.origin);
  const workspaces = createWorkspaceRegistry(input.project, sourceTruth);
  return {
    project: input.project,
    workspaces,
    sourceTruth,
    activeSourceTruth: sourceTruth.find((row) => row.workspaceId === input.activeWorkspaceId) || sourceTruth[0] || null,
    repositoryTruth: input.repositoryTruth,
    notifications: createNotifications(input.project, sourceTruth, input.repositoryTruth),
  };
}
