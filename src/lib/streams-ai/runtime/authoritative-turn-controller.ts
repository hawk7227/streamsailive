import type { StreamsAIScope } from "../auth";
import { buildStreamsParityPlan, STREAMS_PARITY_PROFILE_VERSION } from "../intelligence/parity-profile";
import { judgeStreamsResponse, type StreamsSemanticJudgment } from "../quality/semantic-judge";
import { validateStreamsEvidence, type StreamsEvidenceValidation } from "../quality/evidence-validator";
import { enforceLiteralRequestedHeadings } from "../quality/literal-heading-enforcer";
import { validateDeterministicStreamsOutput, type StreamsDeterministicValidation } from "../quality/deterministic-output-validator";
import { buildStreamsContextPackage, type StreamsContextPackage } from "./context-package";
import { classifyStreamsIntent, type StreamsIntentDecision } from "./intent-engine";
import { routeStreamsModels, type StreamsModelRoute } from "./model-router";
import { StreamsTaskLifecycle } from "./task-lifecycle";

export const STREAMS_TURN_CONTROLLER_VERSION = "streams-authoritative-turn-controller-v7";

export type StreamsTurnState = "created" | "context_loading" | "planning" | "tool_running" | "generating" | "evaluating" | "repairing" | "persisting" | "completed" | "failed" | "cancelled";

export type StreamsAuthoritativeTurn = {
  controllerVersion: string;
  parityProfileVersion: string;
  taskId: string;
  turnId: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  projectId: string | null;
  scope: StreamsAIScope;
  request: { text: string; attachments: unknown[]; requestedMode?: string | null };
  intent: StreamsIntentDecision;
  context: StreamsContextPackage;
  modelRoute: StreamsModelRoute;
  parityPlan: string;
  qualityPolicy: { minimumScore: number; maxRepairAttempts: number; candidateCount: number; requireEvidenceValidation: boolean; requireDeterministicValidation: boolean };
  state: StreamsTurnState;
  createdAt: string;
};

export type StreamsGeneratedCandidate = { content: string; model: string; citationCount: number; webSearchUsed: boolean; candidateIndex: number };

export type StreamsAcceptedTurnResult<TPersisted = unknown> = {
  turn: StreamsAuthoritativeTurn;
  candidate: StreamsGeneratedCandidate;
  judgment: StreamsSemanticJudgment;
  evidence: StreamsEvidenceValidation;
  deterministic: StreamsDeterministicValidation;
  persisted: TPersisted;
  repairAttempts: number;
  taskJobId: string;
};

function uuid(value?: string | null) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : crypto.randomUUID();
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
  unresolvedTaskState?: Record<string, unknown> | null;
}): Promise<StreamsAuthoritativeTurn> {
  const taskId = uuid(input.taskId);
  const turnId = uuid(input.turnId);
  const projectId = String(input.projectId || input.scope.defaultProjectId || "").trim() || null;
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  const hasImages = Boolean(input.imageUrls?.length) || attachments.some((attachment: any) => String(attachment?.mimeType || attachment?.mime_type || "").startsWith("image/") || String(attachment?.kind || "").toLowerCase() === "image");
  const hasFiles = attachments.length > 0 || Boolean(input.attachmentText);
  const intent = classifyStreamsIntent({ userMessage: input.userMessage, hasFiles, hasImages, hasSelectedArtifact: Boolean(input.activeArtifact || input.selectedContext) });
  const context = await buildStreamsContextPackage({ scope: input.scope, sessionId: input.sessionId, taskId, projectId, userInstruction: input.userMessage, intent, recentMessages: input.recentMessages || [], attachmentText: input.attachmentText, imageUrls: input.imageUrls, selectedContext: input.selectedContext, activeArtifact: input.activeArtifact, unresolvedTaskState: input.unresolvedTaskState });
  const modelRoute = routeStreamsModels({ intent, hasImages, contextTokens: context.tokenBudget.estimatedTokens });
  const parityPlan = buildStreamsParityPlan({ userInstruction: input.userMessage, mode: context.runtimeContext?.plan?.mode || input.requestedMode || intent.primaryIntent, hasImages, hasFiles, hasMemory: context.retrievedMemory.memories.length > 0, hasRuntimeContext: Boolean(context.runtimeContext?.contextText) });
  return { controllerVersion: STREAMS_TURN_CONTROLLER_VERSION, parityProfileVersion: STREAMS_PARITY_PROFILE_VERSION, taskId, turnId, sessionId: input.sessionId, tenantId: input.scope.tenantId, userId: input.scope.userId, projectId, scope: input.scope, request: { text: input.userMessage, attachments, requestedMode: input.requestedMode || null }, intent, context, modelRoute, parityPlan, qualityPolicy: qualityPolicy(intent), state: "planning", createdAt: new Date().toISOString() };
}

export function buildAuthoritativeTurnPrompt(turn: StreamsAuthoritativeTurn) {
  return [turn.parityPlan, turn.context.contextText, `<authoritative_turn_contract>`, `taskId: ${turn.taskId}`, `turnId: ${turn.turnId}`, `intent: ${turn.intent.primaryIntent}`, `secondaryIntents: ${turn.intent.secondaryIntents.join(",") || "none"}`, `complexity: ${turn.intent.complexity}`, `requestedDepth: ${turn.intent.requestedDepth}`, `minimumQualityScore: ${turn.qualityPolicy.minimumScore}`, turn.intent.requestedFormat.headings.length ? `Literal headings required exactly and in order:\n${turn.intent.requestedFormat.headings.join("\n")}` : "", "Use the current typed instruction as the controlling request. Use context only when relevant. Never claim tool execution or current facts without evidence.", `</authoritative_turn_contract>`].filter(Boolean).join("\n\n");
}

function enforceCandidate(turn: StreamsAuthoritativeTurn, candidate: StreamsGeneratedCandidate): StreamsGeneratedCandidate {
  const enforced = enforceLiteralRequestedHeadings(candidate.content, turn.intent);
  return enforced.changed ? { ...candidate, content: enforced.content } : candidate;
}

function localJudgment(turn: StreamsAuthoritativeTurn, candidate: StreamsGeneratedCandidate) {
  return judgeStreamsResponse({ userInstruction: turn.request.text, responseText: candidate.content, intent: turn.intent, hasImages: turn.context.imageUrls.length > 0, hasFiles: Boolean(turn.context.attachmentText), toolEvidenceCount: turn.context.toolEvidence.length, citationCount: candidate.citationCount });
}

function deterministicValidation(turn: StreamsAuthoritativeTurn, content: string) {
  return validateDeterministicStreamsOutput({ instruction: turn.request.text, responseText: content, intent: turn.intent });
}

export async function executeAuthoritativeStreamsTurn<TPersisted>(input: {
  turn: StreamsAuthoritativeTurn;
  signal?: AbortSignal;
  emitState?: (state: StreamsTurnState, statusText: string) => void;
  generate: (args: { model: string; prompt: string; imageUrls: string[]; signal?: AbortSignal; candidateIndex: number }) => Promise<Omit<StreamsGeneratedCandidate, "candidateIndex" | "model">>;
  judgeWithModel: (args: { model: string; turn: StreamsAuthoritativeTurn; candidates: StreamsGeneratedCandidate[]; signal?: AbortSignal }) => Promise<number | null>;
  repairWithModel: (args: { model: string; turn: StreamsAuthoritativeTurn; candidate: StreamsGeneratedCandidate; judgment: StreamsSemanticJudgment; evidence: StreamsEvidenceValidation; deterministic: StreamsDeterministicValidation; attempt: number; signal?: AbortSignal }) => Promise<Omit<StreamsGeneratedCandidate, "candidateIndex" | "model">>;
  persistAccepted: (args: { turn: StreamsAuthoritativeTurn; candidate: StreamsGeneratedCandidate; judgment: StreamsSemanticJudgment; evidence: StreamsEvidenceValidation; deterministic: StreamsDeterministicValidation; repairAttempts: number }) => Promise<TPersisted>;
}): Promise<StreamsAcceptedTurnResult<TPersisted>> {
  const { turn } = input;
  const lifecycle = new StreamsTaskLifecycle(turn.scope, { taskId: turn.taskId, turnId: turn.turnId, sessionId: turn.sessionId, projectId: turn.projectId, instruction: turn.request.text });
  await lifecycle.create();
  const assertNotCancelled = () => { if (input.signal?.aborted) throw new DOMException("Streams turn cancelled", "AbortError"); };
  const emit = async (state: StreamsTurnState, status: string, metadata: Record<string, unknown> = {}) => { await lifecycle.transition(state, status, metadata); input.emitState?.(state, status); };
  const prompt = buildAuthoritativeTurnPrompt(turn);
  const modelCandidates = [turn.modelRoute.primary, ...turn.modelRoute.fallbacks];
  const generated: StreamsGeneratedCandidate[] = [];

  try {
    await emit("planning", "Planning the response…");
    await emit("generating", "Generating candidate responses…");
    for (let index = 0; index < turn.qualityPolicy.candidateCount; index += 1) {
      assertNotCancelled();
      const route = modelCandidates[index] || modelCandidates[0];
      if (!route) break;
      try {
        const result = await input.generate({ model: route.id, prompt, imageUrls: turn.context.imageUrls, signal: input.signal, candidateIndex: index });
        if (result.content.trim()) generated.push(enforceCandidate(turn, { ...result, model: route.id, candidateIndex: index }));
      } catch (error) {
        if (index === 0 && generated.length === 0 && modelCandidates.length > 1) continue;
        if (input.signal?.aborted) throw error;
      }
    }
    if (!generated.length) throw new Error("No candidate response completed");

    await emit("evaluating", "Checking response quality…", { candidateCount: generated.length });
    const modelSelection = generated.length > 1 ? await input.judgeWithModel({ model: turn.modelRoute.judge.id, turn, candidates: generated, signal: input.signal }).catch(() => null) : 0;
    let selected = enforceCandidate(turn, generated[Math.max(0, Math.min(generated.length - 1, modelSelection ?? 0))] || generated[0]);
    let judgment = localJudgment(turn, selected);
    let evidence = validateStreamsEvidence({ intent: turn.intent, responseText: selected.content, webSearchUsed: selected.webSearchUsed, citationCount: selected.citationCount, verifiedToolEvidenceCount: turn.context.toolEvidence.length });
    let deterministic = deterministicValidation(turn, selected.content);
    let repairAttempts = 0;

    while ((!judgment.accepted || !evidence.accepted || !deterministic.accepted) && repairAttempts < turn.qualityPolicy.maxRepairAttempts) {
      assertNotCancelled();
      if (!judgment.repairable && evidence.critical) break;
      repairAttempts += 1;
      await emit("repairing", "Repairing response quality…", { repairAttempt: repairAttempts });
      const repaired = await input.repairWithModel({ model: turn.modelRoute.repair.id, turn, candidate: selected, judgment, evidence, deterministic, attempt: repairAttempts, signal: input.signal });
      selected = enforceCandidate(turn, { ...repaired, model: turn.modelRoute.repair.id, candidateIndex: selected.candidateIndex });
      judgment = localJudgment(turn, selected);
      evidence = validateStreamsEvidence({ intent: turn.intent, responseText: selected.content, webSearchUsed: selected.webSearchUsed, citationCount: selected.citationCount, verifiedToolEvidenceCount: turn.context.toolEvidence.length });
      deterministic = deterministicValidation(turn, selected.content);
      if (judgment.accepted && evidence.accepted && deterministic.accepted) break;
      await emit("evaluating", "Rechecking repaired response…", { repairAttempt: repairAttempts });
    }

    selected = enforceCandidate(turn, selected);
    judgment = localJudgment(turn, selected);
    deterministic = deterministicValidation(turn, selected.content);
    if (!judgment.accepted || !evidence.accepted || !deterministic.accepted) {
      const codes = [...judgment.defects.map((defect) => defect.code), ...evidence.defects.map((defect) => defect.code), ...deterministic.defects.map((defect) => defect.code)];
      throw new Error(`STREAMS_RESPONSE_REJECTED:${codes.join(",") || "QUALITY_THRESHOLD"}`);
    }

    assertNotCancelled();
    await emit("persisting", "Saving…", { qualityScore: judgment.overallScore, repairAttempts });
    const persisted = await input.persistAccepted({ turn, candidate: selected, judgment, evidence, deterministic, repairAttempts });
    await emit("completed", "Complete", { qualityScore: judgment.overallScore, repairAttempts });
    return { turn, candidate: selected, judgment, evidence, deterministic, persisted, repairAttempts, taskJobId: lifecycle.id };
  } catch (error) {
    if (input.signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) await lifecycle.cancel();
    else await lifecycle.fail(error);
    throw error;
  }
}
