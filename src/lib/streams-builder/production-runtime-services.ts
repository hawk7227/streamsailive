import { createHash, randomUUID } from "node:crypto";

export type BuilderTaskKind = "plan" | "search" | "edit" | "repair" | "verify" | "review" | "chat";
export type ModelTier = "fast" | "balanced" | "deep";

export interface BuilderModelProfile {
  id: string;
  tier: ModelTier;
  maxContextTokens: number;
  supportsTools: boolean;
  supportsVision: boolean;
  costWeight: number;
  latencyWeight: number;
}

export interface BuilderModelRoutingInput {
  task: BuilderTaskKind;
  estimatedInputTokens: number;
  requiresVision?: boolean;
  requiresTools?: boolean;
  risk: "low" | "medium" | "high";
  repairAttempt?: number;
}

export function routeBuilderModel(input: BuilderModelRoutingInput, profiles: BuilderModelProfile[]): BuilderModelProfile {
  const eligible = profiles.filter((profile) =>
    profile.maxContextTokens >= input.estimatedInputTokens &&
    (!input.requiresVision || profile.supportsVision) &&
    (!input.requiresTools || profile.supportsTools),
  );
  if (!eligible.length) throw new Error("No model profile satisfies the task requirements.");
  const depthBias = input.risk === "high" || input.task === "repair" || (input.repairAttempt ?? 0) > 1 ? 8 : input.risk === "medium" ? 3 : 0;
  const ranked = eligible
    .map((profile) => ({
      profile,
      score: profile.costWeight + profile.latencyWeight + (profile.tier === "deep" ? -depthBias : profile.tier === "fast" ? depthBias : 0),
    }))
    .sort((a, b) => a.score - b.score || b.profile.maxContextTokens - a.profile.maxContextTokens);
  const selected = ranked[0];
  if (!selected) throw new Error("Model routing produced no selection.");
  return selected.profile;
}

export type VerificationStage = "lint" | "typecheck" | "test" | "build" | "browser" | "preview" | "deployment";
export interface VerificationPlanStage {
  stage: VerificationStage;
  required: boolean;
  reason: string;
  affectedFiles: string[];
}

export function createIncrementalVerificationPlan(input: {
  changedFiles: string[];
  affectedFiles: string[];
  hasFrontendChanges: boolean;
  deploymentRequested: boolean;
}): VerificationPlanStage[] {
  const allFiles = [...new Set([...input.changedFiles, ...input.affectedFiles])].sort();
  const testsChanged = allFiles.some((file) => /(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.(?:spec|test)\./.test(file));
  const sourceChanged = allFiles.some((file) => /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(file));
  const configChanged = allFiles.some((file) => /(?:package\.json|pnpm-lock\.yaml|tsconfig|next\.config|vite\.config)/.test(file));
  return [
    { stage: "lint", required: sourceChanged, reason: sourceChanged ? "source files changed" : "no lintable source files changed", affectedFiles: allFiles },
    { stage: "typecheck", required: sourceChanged || configChanged, reason: sourceChanged || configChanged ? "typed source or compiler configuration changed" : "no typed inputs changed", affectedFiles: allFiles },
    { stage: "test", required: sourceChanged || testsChanged, reason: testsChanged ? "tests changed" : sourceChanged ? "source behavior changed" : "no test-relevant files changed", affectedFiles: allFiles },
    { stage: "build", required: sourceChanged || configChanged, reason: configChanged ? "build configuration changed" : sourceChanged ? "compiled source changed" : "no build inputs changed", affectedFiles: allFiles },
    { stage: "browser", required: input.hasFrontendChanges, reason: input.hasFrontendChanges ? "rendered behavior changed" : "no frontend surface changed", affectedFiles: allFiles },
    { stage: "preview", required: input.hasFrontendChanges, reason: input.hasFrontendChanges ? "preview must match the verified commit" : "no preview verification required", affectedFiles: allFiles },
    { stage: "deployment", required: input.deploymentRequested, reason: input.deploymentRequested ? "deployment proof requested" : "deployment not requested", affectedFiles: allFiles },
  ];
}

export interface WorkspaceVersionedState {
  workspaceId: string;
  generation: number;
  updatedAt: string;
  chatRevision: string;
  codeRevision: string;
  gitRevision: string;
  runtimeRevision: string;
  previewRevision: string;
  activeJobId?: string;
  steeringRevision: number;
}

export interface WorkspaceStateStore {
  get(workspaceId: string): Promise<WorkspaceVersionedState | null>;
  compareAndSwap(workspaceId: string, expectedGeneration: number, next: WorkspaceVersionedState): Promise<boolean>;
  create(state: WorkspaceVersionedState): Promise<void>;
}

export function createWorkspaceState(workspaceId: string, now = new Date().toISOString()): WorkspaceVersionedState {
  return { workspaceId, generation: 1, updatedAt: now, chatRevision: "0", codeRevision: "0", gitRevision: "0", runtimeRevision: "0", previewRevision: "0", steeringRevision: 0 };
}

export async function synchronizeWorkspaceState(input: {
  store: WorkspaceStateStore;
  workspaceId: string;
  expectedGeneration: number;
  patch: Partial<Omit<WorkspaceVersionedState, "workspaceId" | "generation" | "updatedAt">>;
  now?: string;
}): Promise<WorkspaceVersionedState> {
  const current = await input.store.get(input.workspaceId);
  if (!current) throw new Error("Workspace state not found.");
  if (current.generation !== input.expectedGeneration) throw new Error("Workspace state generation conflict.");
  const next: WorkspaceVersionedState = { ...current, ...input.patch, generation: current.generation + 1, updatedAt: input.now ?? new Date().toISOString() };
  if (!await input.store.compareAndSwap(input.workspaceId, current.generation, next)) throw new Error("Workspace state changed during synchronization.");
  return next;
}

export interface RepairDiagnostic {
  id: string;
  category: "syntax" | "type" | "test" | "build" | "browser" | "network" | "dependency" | "unknown";
  rootCause: string;
  confidence: number;
  relatedFiles: string[];
  retryable: boolean;
  boundedActions: string[];
  fingerprint: string;
}

export function diagnoseRepairFailure(input: { command: string; stderr: string; stdout?: string; relatedFiles?: string[]; priorFingerprints?: string[] }): RepairDiagnostic {
  const text = `${input.command}\n${input.stdout ?? ""}\n${input.stderr}`;
  const lowered = text.toLowerCase();
  const classify = (): RepairDiagnostic["category"] => {
    if (/syntaxerror|unexpected token|parse error/.test(lowered)) return "syntax";
    if (/error ts\d+|type .* is not assignable|cannot find name/.test(lowered)) return "type";
    if (/assertionerror|expected .* received|test failed/.test(lowered)) return "test";
    if (/module not found|cannot resolve|dependency/.test(lowered)) return "dependency";
    if (/pageerror|locator|timeout.*browser|playwright/.test(lowered)) return "browser";
    if (/econnrefused|http \d{3}|network/.test(lowered)) return "network";
    if (/build failed|compilation failed/.test(lowered)) return "build";
    return "unknown";
  };
  const category = classify();
  const fingerprint = createHash("sha256").update(text.replace(/\d+/g, "#").slice(0, 12000)).digest("hex");
  const repeated = input.priorFingerprints?.includes(fingerprint) ?? false;
  const boundedActions = category === "dependency" ? ["inspect package manifest", "verify import path", "install only declared dependency"]
    : category === "type" ? ["locate first compiler error", "patch smallest owning symbol", "rerun typecheck"]
    : category === "test" ? ["isolate failing test", "inspect implementation and fixture", "rerun affected test"]
    : category === "browser" ? ["open trace", "inspect console and network", "patch mapped source", "rerun failed assertion"]
    : ["inspect first causal error", "patch smallest affected unit", "rerun failed stage"];
  return {
    id: randomUUID(),
    category,
    rootCause: text.split("\n").find((line) => /error|failed|exception/i.test(line))?.trim() || "No specific root cause line was detected.",
    confidence: category === "unknown" ? 0.35 : 0.8,
    relatedFiles: [...new Set(input.relatedFiles ?? [])],
    retryable: !repeated,
    boundedActions: repeated ? [] : boundedActions,
    fingerprint,
  };
}

export interface RuntimeBenchmarkSample {
  latencyMs: number;
  success: boolean;
  repaired: boolean;
  hallucination: boolean;
}

export function summarizeRuntimeBenchmark(samples: RuntimeBenchmarkSample[]) {
  if (!samples.length) throw new Error("At least one benchmark sample is required.");
  const sorted = samples.map((sample) => sample.latencyMs).sort((a, b) => a - b);
  const percentile = (p: number): number => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))] ?? 0;
  const count = samples.length;
  return {
    count,
    successRate: samples.filter((sample) => sample.success).length / count,
    repairRate: samples.filter((sample) => sample.repaired).length / count,
    hallucinationRate: samples.filter((sample) => sample.hallucination).length / count,
    latencyMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: sorted[sorted.length - 1] ?? 0 },
  };
}
