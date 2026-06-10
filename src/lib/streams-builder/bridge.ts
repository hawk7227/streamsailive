import type {
  StreamsBuilderBridgePayload,
  StreamsBuilderBridgeState,
  StreamsBuilderTruthState,
} from "./types";

const EMPTY_CONTEXT = "Pending transfer from Streams AI conversation context.";

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function safeText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function fallbackId(prefix: string, source: string | undefined): string {
  const seed =
    source
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "pending";

  return `${prefix}-${seed}`;
}

export function createStreamsBuilderBridgePayloadFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): StreamsBuilderBridgePayload {
  return {
    projectId: firstValue(params.projectId),
    conversationId: firstValue(params.conversationId),
    projectName: firstValue(params.projectName),
    userIntent: firstValue(params.userIntent),
    buildMode: firstValue(params.buildMode) as StreamsBuilderBridgePayload["buildMode"],
    requirements: firstValue(params.requirements),
    architecture: firstValue(params.architecture),
    blueprint: firstValue(params.blueprint),
    repo: firstValue(params.repo),
    route: firstValue(params.route),
    component: firstValue(params.component),
    file: firstValue(params.file),
    githubPath: firstValue(params.githubPath),
    previewUrl: firstValue(params.previewUrl),
  };
}

export function createStreamsBuilderBridgeState(
  payload: StreamsBuilderBridgePayload,
): StreamsBuilderBridgeState {
  const projectName = safeText(payload.projectName) ?? "Streams Builder Project";
  const projectId = safeText(payload.projectId) ?? fallbackId("project", projectName);
  const conversationId = safeText(payload.conversationId) ?? null;
  const activeRoute = safeText(payload.route) ?? null;
  const activeComponent = safeText(payload.component) ?? null;
  const activeFile = safeText(payload.file) ?? null;
  const activePreviewUrl = safeText(payload.previewUrl) ?? null;
  const activeGithubPath = safeText(payload.githubPath) ?? activeFile;
  const repo = safeText(payload.repo) ?? null;
  const hasSourceOwnership = Boolean(activeRoute && activeComponent && activeFile && activeGithubPath);
  const sourceTruth: StreamsBuilderTruthState = hasSourceOwnership ? "UNKNOWN" : "UNPROVEN";
  const status = safeText(payload.blueprint) ? "repository_pending" : "blueprint";

  return {
    project: {
      projectId,
      name: projectName,
      description: safeText(payload.userIntent) ?? "Bridge project created from Streams AI context.",
      repo,
      branch: repo ? "main" : null,
      memoryScope: `${projectId}:memory`,
      assetScope: `${projectId}:assets`,
      checkpointScope: `${projectId}:checkpoints`,
      proofScope: `${projectId}:proof`,
      deploymentScope: `${projectId}:deployments`,
      notificationScope: `${projectId}:notifications`,
      status,
      truthState: "UNPROVEN",
      createdFromConversationId: conversationId,
    },
    session: {
      sessionId: fallbackId("builder-session", conversationId ?? projectId),
      activeProjectId: projectId,
      activeRoute,
      activeComponent,
      activeFile,
      activeWorkspace: "primary",
      activeBuildJob: null,
      activeCheckpoint: null,
      activeProofStatus: "UNPROVEN",
      activePreviewUrl,
    },
    sourceTruth: {
      route: activeRoute,
      previewUrl: activePreviewUrl,
      component: activeComponent,
      file: activeFile,
      githubPath: activeGithubPath,
      buildJob: null,
      checkpoint: null,
      proofStatus: "UNPROVEN",
      truthState: sourceTruth,
    },
    transferredContext: {
      requirements: safeText(payload.requirements) ?? EMPTY_CONTEXT,
      architecture: safeText(payload.architecture) ?? EMPTY_CONTEXT,
      blueprint: safeText(payload.blueprint) ?? EMPTY_CONTEXT,
      userIntent: safeText(payload.userIntent) ?? "Waiting for Builder intent from Streams AI.",
      buildMode: payload.buildMode ?? "unknown",
    },
    loops: [
      {
        id: "requirements-loop",
        label: "Requirements Loop",
        stage: "requirements",
        truthState: safeText(payload.requirements) ? "UNKNOWN" : "WAITING_FOR_USER",
        currentStep: safeText(payload.requirements)
          ? "Requirements transferred from Streams AI."
          : "Waiting for requirements context.",
        evidence: safeText(payload.requirements) ? ["Conversation requirements payload present"] : [],
        stopCondition: "Requirements complete or human clarification required.",
      },
      {
        id: "architecture-loop",
        label: "Architecture Loop",
        stage: "architecture",
        truthState: safeText(payload.architecture) ? "UNKNOWN" : "WAITING_FOR_USER",
        currentStep: safeText(payload.architecture)
          ? "Architecture transferred from Streams AI."
          : "Waiting for architecture context.",
        evidence: safeText(payload.architecture) ? ["Conversation architecture payload present"] : [],
        stopCondition: "Architecture approved before implementation.",
      },
      {
        id: "blueprint-loop",
        label: "Blueprint Loop",
        stage: "blueprint",
        truthState: safeText(payload.blueprint) ? "UNKNOWN" : "WAITING_FOR_USER",
        currentStep: safeText(payload.blueprint)
          ? "Blueprint ready for repository creation."
          : "Waiting for blueprint generation.",
        evidence: safeText(payload.blueprint) ? ["Blueprint payload present"] : [],
        stopCondition: "Blueprint approved before repository creation.",
      },
      {
        id: "source-truth-loop",
        label: "Source Truth Loop",
        stage: "execution_pending",
        truthState: sourceTruth,
        currentStep: hasSourceOwnership
          ? "Initial source ownership payload received."
          : "Repository execution has not produced route/component/file ownership yet.",
        evidence: hasSourceOwnership ? ["Route/component/file/github path present"] : [],
        stopCondition:
          "Route, preview URL, component, file, GitHub path, checkpoint, and proof status are known.",
      },
    ],
  };
}
