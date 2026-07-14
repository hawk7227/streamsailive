import type { StreamsAIScope } from "../auth";
import { buildStreamsParityPlan, STREAMS_PARITY_PROFILE_VERSION } from "../intelligence/parity-profile";
import { buildStreamsContextPackage, type StreamsContextPackage } from "./context-package";
import { classifyStreamsIntent, type StreamsIntentDecision } from "./intent-engine";
import { routeStreamsModels, type StreamsModelRoute } from "./model-router";

export const STREAMS_TURN_CONTROLLER_VERSION = "streams-authoritative-turn-controller-v1";

export type StreamsTurnState =
  | "created"
  | "context_loading"
  | "planning"
  | "tool_running"
  | "generating"
  | "evaluating"
  | "repairing"
  | "persisting"
  | "completed"
  | "failed"
  | "cancelled";

export type StreamsAuthoritativeTurn = {
  controllerVersion: string;
  parityProfileVersion: string;
  taskId: string;
  turnId: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  projectId: string | null;
  request: {
    text: string;
    attachments: unknown[];
    requestedMode?: string | null;
  };
  intent: StreamsIntentDecision;
  context: StreamsContextPackage;
  modelRoute: StreamsModelRoute;
  parityPlan: string;
  qualityPolicy: {
    minimumScore: number;
    maxRepairAttempts: number;
    candidateCount: number;
    requireEvidenceValidation: boolean;
    requireDeterministicValidation: boolean;
  };
  state: StreamsTurnState;
  createdAt: string;
};

function uuid(value?: string | null) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : crypto.randomUUID();
}

function qualityPolicy(intent: StreamsIntentDecision) {
  const critical = intent.riskLevel === "high" || intent.complexity === "critical";
  const complex = intent.complexity === "complex" || critical;
  return {
    minimumScore: critical ? 0.95 : 0.9,
    maxRepairAttempts: 2,
    candidateCount: complex ? 3 : 1,
    requireEvidenceValidation: intent.needsCurrentInformation || intent.needsTools || intent.needsFiles || intent.needsImages,
    requireDeterministicValidation: intent.requestedFormat.exact || Object.entries(intent.requestedFormat).some(([key, value]) => key !== "headings" && value === true),
  };
}

export async function prepareAuthoritativeStreamsTurn(input: {
  scope: StreamsAIScope;
  sessionId: string;
  projectId?: string | null;
  userMessage: string;
  attachments?: unknown[];
  turnId?: string | null;
  taskId?: string | null;
  requestedMode?: string | null;
  recentMessages?: StreamsContextPackage["recentMessages"];
  attachmentText?: string;
  imageUrls?: string[];
  selectedContext?: Record<string, unknown> | null;
  activeArtifact?: Record<string, unknown> | null;
  toolEvidence?: Array<Record<string, unknown>>;
  unresolvedTaskState?: Record<string, unknown> | null;
}): Promise<StreamsAuthoritativeTurn> {
  const taskId = uuid(input.taskId);
  const turnId = uuid(input.turnId);
  const projectId = String(input.projectId || "").trim() || null;
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  const hasImages = Boolean(input.imageUrls?.length) || attachments.some((attachment: any) => String(attachment?.mimeType || attachment?.mime_type || "").startsWith("image/") || String(attachment?.kind || "").toLowerCase() === "image");
  const hasFiles = attachments.length > 0 || Boolean(input.attachmentText);
  const intent = classifyStreamsIntent({
    userMessage: input.userMessage,
    hasFiles,
    hasImages,
    hasSelectedArtifact: Boolean(input.activeArtifact || input.selectedContext),
  });

  const context = await buildStreamsContextPackage({
    scope: input.scope,
    sessionId: input.sessionId,
    projectId,
    userInstruction: input.userMessage,
    intent,
    recentMessages: input.recentMessages || [],
    attachmentText: input.attachmentText,
    imageUrls: input.imageUrls,
    selectedContext: input.selectedContext,
    activeArtifact: input.activeArtifact,
    toolEvidence: input.toolEvidence,
    unresolvedTaskState: input.unresolvedTaskState,
  });

  const modelRoute = routeStreamsModels({
    intent,
    hasImages,
    contextChars: context.contextText.length,
  });

  const parityPlan = buildStreamsParityPlan({
    userInstruction: input.userMessage,
    mode: context.runtimeContext?.plan?.mode || input.requestedMode || intent.primaryIntent,
    hasImages,
    hasFiles,
    hasMemory: context.retrievedMemory.memories.length > 0,
    hasRuntimeContext: Boolean(context.runtimeContext?.contextText),
  });

  return {
    controllerVersion: STREAMS_TURN_CONTROLLER_VERSION,
    parityProfileVersion: STREAMS_PARITY_PROFILE_VERSION,
    taskId,
    turnId,
    sessionId: input.sessionId,
    tenantId: input.scope.tenantId,
    userId: input.scope.userId,
    projectId,
    request: { text: input.userMessage, attachments, requestedMode: input.requestedMode || null },
    intent,
    context,
    modelRoute,
    parityPlan,
    qualityPolicy: qualityPolicy(intent),
    state: "planning",
    createdAt: new Date().toISOString(),
  };
}

export function buildAuthoritativeTurnPrompt(turn: StreamsAuthoritativeTurn) {
  return [
    turn.parityPlan,
    turn.context.contextText,
    `<authoritative_turn_contract>`,
    `taskId: ${turn.taskId}`,
    `turnId: ${turn.turnId}`,
    `intent: ${turn.intent.primaryIntent}`,
    `complexity: ${turn.intent.complexity}`,
    `requestedDepth: ${turn.intent.requestedDepth}`,
    `minimumQualityScore: ${turn.qualityPolicy.minimumScore}`,
    "Use the current typed instruction as the controlling request. Use context only when relevant. Never claim tool execution or current facts without evidence.",
    `</authoritative_turn_contract>`,
  ].join("\n\n");
}
