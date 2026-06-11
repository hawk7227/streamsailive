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
  | "proven"
  | "unproven"
  | "not-configured"
  | "unknown";

export type PreviewSurfaceId =
  | "live-preview"
  | "mini-review-window"
  | "notification-card"
  | "approval-center"
  | "browser-verification-workspace"
  | "visual-editing-workspace"
  | "component-mapping-workspace"
  | "repository-truth-workspace"
  | "project-thumbnail-expanded-view";

export type RequiredTruthField =
  | "route"
  | "previewUrl"
  | "component"
  | "file"
  | "githubPath"
  | "buildJob"
  | "checkpoint"
  | "proofStatus";

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

export type TruthGateResult = {
  status: "PROVEN" | "UNPROVEN";
  editAllowed: boolean;
  missing: RequiredTruthField[];
  reason: string;
};

export type PreviewSurfaceTruth = {
  surfaceId: PreviewSurfaceId;
  label: string;
  runtimeTruth: {
    route: string;
    previewUrl: string | null;
  };
  sourceTruth: {
    component: string;
    file: string;
    githubPath: string;
    buildJob: string | null;
    checkpoint: string | null;
    proofStatus: StreamsBuilderStatus;
  };
  gate: TruthGateResult;
};

export type BrowserVerificationRequirement = {
  required: true;
  purpose: string;
  blocksApprovalUntilPassed: true;
  checks: Array<{
    id: string;
    label: string;
    status: "required";
  }>;
};

export type BuildOrderStep = {
  order: number;
  id: string;
  label: string;
  blocksNextStep: boolean;
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
  activeTruthGate: TruthGateResult;
  previewSurfaces: PreviewSurfaceTruth[];
  buildOrder: BuildOrderStep[];
  browserVerificationRequirement: BrowserVerificationRequirement;
  repositoryTruth: RepositoryTruth;
  notifications: BuilderNotificationEvent[];
};

export const STREAMS_BUILDER_BUILD_ORDER: BuildOrderStep[] = [
  { order: 1, id: "streams-builder-route", label: "Streams Builder Route", blocksNextStep: true },
  { order: 2, id: "workspace-grid", label: "Workspace Grid", blocksNextStep: true },
  { order: 3, id: "project-containers", label: "Project Containers", blocksNextStep: true },
  { order: 4, id: "thumbnail-rail", label: "Thumbnail Rail", blocksNextStep: true },
  { order: 5, id: "preview-builder", label: "Preview Builder", blocksNextStep: true },
  { order: 6, id: "frontend-mapping", label: "Frontend Mapping", blocksNextStep: true },
  { order: 7, id: "visual-editing", label: "Visual Editing", blocksNextStep: true },
  { order: 8, id: "github-execution", label: "GitHub Execution", blocksNextStep: true },
  { order: 9, id: "browser-verification", label: "Browser Verification", blocksNextStep: true },
  { order: 10, id: "proof-system", label: "Proof System", blocksNextStep: true },
  { order: 11, id: "approval-system", label: "Approval System", blocksNextStep: true },
];

export const REQUIRED_PREVIEW_SURFACES: Array<{ id: PreviewSurfaceId; label: string }> = [
  { id: "live-preview", label: "Live Preview" },
  { id: "mini-review-window", label: "Mini Review Window" },
  { id: "notification-card", label: "Notification Cards" },
  { id: "approval-center", label: "Approval Center" },
  { id: "browser-verification-workspace", label: "Browser Verification Workspace" },
  { id: "visual-editing-workspace", label: "Visual Editing Workspace" },
  { id: "component-mapping-workspace", label: "Component Mapping Workspace" },
  { id: "repository-truth-workspace", label: "Repository Truth Workspace" },
  { id: "project-thumbnail-expanded-view", label: "Project Thumbnail Expanded View" },
];

export const REQUIRED_TRUTH_FIELDS: RequiredTruthField[] = [
  "route",
  "previewUrl",
  "component",
  "file",
  "githubPath",
  "buildJob",
  "checkpoint",
  "proofStatus",
];

export const BROWSER_VERIFICATION_REQUIREMENT: BrowserVerificationRequirement = {
  required: true,
  purpose: "AI must verify the live frontend like a real user before any frontend change can be called fixed, proven, approved, or ready.",
  blocksApprovalUntilPassed: true,
  checks: [
    { id: "open-live-preview-url", label: "Open the live preview URL", status: "required" },
    { id: "confirm-route-loaded", label: "Confirm the expected route loaded", status: "required" },
    { id: "confirm-mapped-component-rendered", label: "Confirm the mapped component rendered", status: "required" },
    { id: "click-affected-controls", label: "Click every affected button/control", status: "required" },
    { id: "fill-affected-inputs", label: "Fill every affected input/form", status: "required" },
    { id: "submit-affected-workflow", label: "Submit the affected workflow", status: "required" },
    { id: "open-affected-panels", label: "Open affected modals/dropdowns/panels", status: "required" },
    { id: "desktop-viewport-check", label: "Check desktop viewport", status: "required" },
    { id: "mobile-viewport-check", label: "Check mobile viewport", status: "required" },
    { id: "console-error-check", label: "Check console errors", status: "required" },
    { id: "network-error-check", label: "Check network/API errors", status: "required" },
    { id: "visual-result-check", label: "Confirm expected visual result", status: "required" },
    { id: "functional-result-check", label: "Confirm expected functional result", status: "required" },
    { id: "attach-proof-evidence", label: "Attach evidence to proof status", status: "required" },
  ],
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

function hasValue(value: string | null | undefined) {
  return Boolean(value && String(value).trim().length > 0);
}

export function evaluateSourceTruth(record: Partial<SourceTruthRecord> | null | undefined): TruthGateResult {
  if (!record) {
    return {
      status: "UNPROVEN",
      editAllowed: false,
      missing: [...REQUIRED_TRUTH_FIELDS],
      reason: "No source truth record is bound to this preview surface.",
    };
  }

  const missing = REQUIRED_TRUTH_FIELDS.filter((field) => {
    if (field === "proofStatus") return !hasValue(record.proofStatus) || record.proofStatus === "unknown" || record.proofStatus === "not-configured" || record.proofStatus === "unproven";
    return !hasValue(record[field]);
  });

  const proven = missing.length === 0 && (record.proofStatus === "proven" || record.proofStatus === "approved" || record.proofStatus === "ready-for-approval");

  return {
    status: proven ? "PROVEN" : "UNPROVEN",
    editAllowed: proven,
    missing,
    reason: proven
      ? "Runtime truth, source truth, build/checkpoint, and proof status are present."
      : `Blind editing blocked. Missing or unproven: ${missing.join(", ") || "proof evidence"}.`,
  };
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
  const rows: Array<[StreamsBuilderWorkspaceId, string, string, string, StreamsBuilderStatus, string | null, string | null]> = [
    ["ai-build-chat", "/streams-builder", "StreamsBuilderSystemShell", "src/components/streams-builder/StreamsBuilderSystemShell.tsx", project.status, null, null],
    ["visual-editing", "/streams-builder", "WorkspaceGrid", "src/components/streams-builder/WorkspaceGrid.tsx", "unproven", null, null],
    ["component-mapping", "/streams-builder", "WorkspaceGrid", "src/components/streams-builder/WorkspaceGrid.tsx", "unproven", null, null],
    ["approval-center", "/streams-builder", "WorkspaceGrid", "src/components/streams-builder/WorkspaceGrid.tsx", "not-configured", null, null],
    ["browser-verification", "/streams-builder", "WorkspaceGrid", "src/components/streams-builder/WorkspaceGrid.tsx", "not-configured", null, null],
    ["repository-truth", "/streams-builder", "WorkspaceGrid", "src/components/streams-builder/WorkspaceGrid.tsx", project.status, null, null],
    ["projects-dashboard", "/streams-builder", "ProjectThumbnailRail", "src/components/streams-builder/ProjectThumbnailRail.tsx", project.status, null, null],
  ];

  return rows.map(([workspaceId, route, component, file, status, buildJob, checkpoint]) => ({
    id: `${project.projectId}:${workspaceId}`,
    projectId: project.projectId,
    workspaceId,
    route,
    previewUrl,
    component,
    file,
    githubPath: `https://github.com/${project.repository}/blob/main/${file}`,
    repository: project.repository,
    buildJob,
    checkpoint,
    proofStatus: status === "proven" || status === "approved" || status === "ready-for-approval" ? status : "unproven",
    status,
    updatedAt: now,
  }));
}

export function createPreviewSurfaceTruth(record: SourceTruthRecord | null): PreviewSurfaceTruth[] {
  return REQUIRED_PREVIEW_SURFACES.map((surface) => ({
    surfaceId: surface.id,
    label: surface.label,
    runtimeTruth: {
      route: record?.route || "UNPROVEN",
      previewUrl: record?.previewUrl || null,
    },
    sourceTruth: {
      component: record?.component || "UNPROVEN",
      file: record?.file || "UNPROVEN",
      githubPath: record?.githubPath || "UNPROVEN",
      buildJob: record?.buildJob || null,
      checkpoint: record?.checkpoint || null,
      proofStatus: record?.proofStatus || "unproven",
    },
    gate: evaluateSourceTruth(record),
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
  const failingHealth = repositoryTruth.repositoryHealth.filter((item) => item.status === "failed" || item.status === "not-configured" || item.status === "unproven");

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
  const activeSourceTruth = sourceTruth.find((row) => row.workspaceId === input.activeWorkspaceId) || sourceTruth[0] || null;
  return {
    project: input.project,
    workspaces,
    sourceTruth,
    activeSourceTruth,
    activeTruthGate: evaluateSourceTruth(activeSourceTruth),
    previewSurfaces: createPreviewSurfaceTruth(activeSourceTruth),
    buildOrder: STREAMS_BUILDER_BUILD_ORDER,
    browserVerificationRequirement: BROWSER_VERIFICATION_REQUIREMENT,
    repositoryTruth: input.repositoryTruth,
    notifications: createNotifications(input.project, sourceTruth, input.repositoryTruth),
  };
}
