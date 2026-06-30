import { recordUniversalRuntimeEvent } from "@/lib/streams-ai/runtime-events";

export type ActionResolverTargetType = "source-code" | "asset" | "job" | "provider-run" | "file" | "database-row" | "deployment" | "automation" | "visual-layer" | "unknown";
export type ActionResolverConfidence = "high" | "medium" | "low" | "none";

export type UniversalActionResolverInput = {
  sessionId?: string;
  projectId?: string;
  workspaceId?: string;
  mode?: string;
  capabilityId?: string;
  attemptedAction?: string;
  currentContext?: Record<string, unknown>;
  selectedLayer?: Record<string, any>;
  selectedFile?: Record<string, any>;
  selectedAsset?: Record<string, any>;
  selectedJob?: Record<string, any>;
  selectedProviderRun?: Record<string, any>;
  repo?: string;
  branch?: string;
  route?: string;
  filePath?: string;
  sourceText?: string;
  src?: string;
  selector?: string;
  metadata?: Record<string, unknown>;
};

export type UniversalActionResolverResult = {
  ok: boolean;
  confidence: ActionResolverConfidence;
  targetType: ActionResolverTargetType;
  targetId?: string;
  sourceFile?: string;
  startLine?: number;
  endLine?: number;
  assetId?: string;
  jobId?: string;
  providerRunId?: string;
  storagePath?: string;
  repo?: string;
  branch?: string;
  route?: string;
  safeActionScope?: string;
  safeDeleteScope?: string;
  safeReplaceScope?: string;
  safePatchScope?: string;
  risks: string[];
  recommendations: string[];
  requiresApproval: boolean;
  blockedReason?: string;
};

function safeId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function resolveUniversalActionTarget(input: UniversalActionResolverInput): UniversalActionResolverResult {
  const layer = input.selectedLayer || {};
  const action = String(input.attemptedAction || "").toLowerCase();
  const repo = input.repo;
  const branch = input.branch;
  const route = input.route;

  if (input.selectedAsset?.id || input.selectedAsset?.assetId) {
    return { ok: true, confidence: "high", targetType: "asset", targetId: safeId(input.selectedAsset.id || input.selectedAsset.assetId), assetId: safeId(input.selectedAsset.id || input.selectedAsset.assetId), storagePath: safeId(input.selectedAsset.storagePath || input.selectedAsset.storage_path), repo, branch, route, safeActionScope: "selected asset only", safeReplaceScope: "selected asset reference only", risks: [], recommendations: ["Use asset proof before claiming output"], requiresApproval: /delete|replace|write|remove/.test(action) };
  }

  if (input.selectedJob?.id || input.selectedJob?.jobId) {
    return { ok: true, confidence: "high", targetType: "job", targetId: safeId(input.selectedJob.id || input.selectedJob.jobId), jobId: safeId(input.selectedJob.id || input.selectedJob.jobId), repo, branch, route, safeActionScope: "selected job only", risks: [], recommendations: ["Read provider runs/assets before claiming final output"], requiresApproval: /cancel|retry|delete|rerun/.test(action) };
  }

  if (input.selectedProviderRun?.id || input.selectedProviderRun?.providerRunId) {
    return { ok: true, confidence: "high", targetType: "provider-run", targetId: safeId(input.selectedProviderRun.id || input.selectedProviderRun.providerRunId), providerRunId: safeId(input.selectedProviderRun.id || input.selectedProviderRun.providerRunId), repo, branch, route, safeActionScope: "selected provider run only", risks: [], recommendations: ["Inspect status/outputAssetId before claiming generated output"], requiresApproval: false };
  }

  const sourceFile = safeId(layer.sourceFile || input.filePath);
  const startLine = Number(layer.startLine || 0) || undefined;
  const endLine = Number(layer.endLine || 0) || undefined;
  const selectedLayerId = safeId(layer.layerId || layer.id);
  const kind = String(layer.kind || "");
  const hasExactSource = Boolean(sourceFile && startLine && endLine && endLine >= startLine);

  if (hasExactSource) {
    return { ok: true, confidence: "high", targetType: "source-code", targetId: `${sourceFile}:${startLine}-${endLine}`, sourceFile, startLine, endLine, repo, branch, route, safeActionScope: "exact source range", safeDeleteScope: "exact selected range only", safeReplaceScope: /image|background|video|asset/.test(kind) ? "exact media source only" : "exact selected range only", safePatchScope: "exact source range plus direct import/style dependency if validated", risks: [], recommendations: ["Patch only the resolved range", "Validate after change"], requiresApproval: /delete|remove|replace|patch|write|build|fix|update/.test(action) };
  }

  if (selectedLayerId || kind || layer.selector || input.selector || layer.src || input.src || layer.text || input.sourceText) {
    const confidence: ActionResolverConfidence = sourceFile ? "medium" : "low";
    const blockedReason = confidence === "low" ? "Selected visual layer is not resolved to an exact source file and line range." : undefined;
    return { ok: confidence !== "low", confidence, targetType: "visual-layer", targetId: selectedLayerId, sourceFile, repo, branch, route, safeActionScope: "visual layer inspection only", risks: ["source range is not exact", "mutation could affect wrong item"], recommendations: ["Run source resolver", "Inspect matching source", "Block mutation until confidence is high"], requiresApproval: true, blockedReason };
  }

  if (input.selectedFile?.id || input.selectedFile?.path || input.filePath) {
    const path = safeId(input.selectedFile?.path || input.filePath);
    return { ok: true, confidence: path ? "medium" : "low", targetType: "file", targetId: safeId(input.selectedFile?.id || path), sourceFile: path, repo, branch, route, safeActionScope: "selected file", risks: path ? [] : ["file path missing"], recommendations: ["Inspect file before mutation"], requiresApproval: /write|patch|delete|remove|replace/.test(action) };
  }

  return { ok: false, confidence: "none", targetType: "unknown", repo, branch, route, risks: ["target could not be resolved"], recommendations: ["Ask for more context", "Inspect current workspace", "Select exact item before action"], requiresApproval: true, blockedReason: "No exact action target was provided." };
}

export async function resolveAndRecordUniversalActionTarget(input: UniversalActionResolverInput) {
  const result = resolveUniversalActionTarget(input);
  await recordUniversalRuntimeEvent({
    sessionId: input.sessionId || "agent-1",
    phase: result.ok ? "action-resolver.resolved" : "action-resolver.blocked",
    source: "streams-ai-action-resolver",
    severity: result.ok ? "info" : "warning",
    message: result.ok ? `Resolved ${result.targetType} target with ${result.confidence} confidence.` : result.blockedReason || "Action target could not be resolved.",
    mode: input.mode,
    capabilityId: input.capabilityId,
    attemptedAction: input.attemptedAction,
    riskLevel: result.confidence === "high" ? "safe" : "approval-required",
    approvalRequired: result.requiresApproval,
    repo: input.repo,
    branch: input.branch,
    route: input.route,
    sourceFile: result.sourceFile,
    startLine: result.startLine,
    endLine: result.endLine,
    selectedLayer: input.selectedLayer || null,
    selectedLayerId: safeId(input.selectedLayer?.layerId || input.selectedLayer?.id),
    selectedLayerType: safeId(input.selectedLayer?.kind),
    recommendations: result.recommendations,
    metadata: { result },
  });
  return result;
}
