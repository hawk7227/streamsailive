import { randomUUID } from "node:crypto";

export type BrowserControlMode =
  | "observe"
  | "verify"
  | "agent"
  | "shared"
  | "takeover"
  | "evidence"
  | "repair"
  | "deployment";

export type BrowserTruthState = "PROVEN" | "FAILED" | "UNPROVEN";

export interface BrowserSessionLease {
  leaseId: string;
  ownerId: string;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
  generation: number;
}

export interface BrowserArtifact {
  kind: "screenshot" | "trace" | "dom_snapshot" | "visual_diff" | "video" | "har";
  uri: string;
  sha256?: string;
  contentType?: string;
}

export interface BrowserAssertionResult {
  id: string;
  description: string;
  passed: boolean;
  expected?: string;
  actual?: string;
  evidenceUris: string[];
}

export interface BrowserConsoleEvent {
  level: "debug" | "info" | "warning" | "error";
  text: string;
  url?: string;
  line?: number;
  column?: number;
}

export interface BrowserNetworkFailure {
  url: string;
  method: string;
  status?: number;
  errorText?: string;
  resourceType?: string;
}

export interface BrowserEvidenceBundle {
  sessionId: string;
  jobId: string;
  workspaceId: string;
  projectId?: string;
  route: string;
  commitSha: string;
  deploymentId?: string;
  browserVersion?: string;
  viewport: { width: number; height: number };
  assertions: BrowserAssertionResult[];
  artifacts: BrowserArtifact[];
  consoleEvents: BrowserConsoleEvent[];
  runtimeExceptions: string[];
  networkFailures: BrowserNetworkFailure[];
  accessibilityFindings: string[];
  startedAt: string;
  completedAt?: string;
  truthState: BrowserTruthState;
}

export interface BrowserSessionRecord {
  sessionId: string;
  jobId: string;
  workspaceId: string;
  projectId?: string;
  mode: BrowserControlMode;
  route: string;
  commitSha: string;
  deploymentId?: string;
  cdpEndpoint?: string;
  storageStateUri?: string;
  lease: BrowserSessionLease;
  createdAt: string;
  updatedAt: string;
  evidence: BrowserEvidenceBundle;
}

export interface BrowserSessionStore {
  create(record: BrowserSessionRecord): Promise<void>;
  get(sessionId: string): Promise<BrowserSessionRecord | null>;
  compareAndSwap(sessionId: string, expectedGeneration: number, next: BrowserSessionRecord): Promise<boolean>;
}

export interface CreateBrowserSessionInput {
  jobId: string;
  workspaceId: string;
  projectId?: string;
  ownerId: string;
  mode: BrowserControlMode;
  route: string;
  commitSha: string;
  deploymentId?: string;
  viewport?: { width: number; height: number };
  leaseTtlMs?: number;
}

const DEFAULT_LEASE_TTL_MS = 30_000;

function iso(ms: number) {
  return new Date(ms).toISOString();
}

export function createBrowserSessionRecord(input: CreateBrowserSessionInput, nowMs = Date.now()): BrowserSessionRecord {
  const sessionId = randomUUID();
  const leaseTtlMs = Math.max(5_000, input.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS);
  const createdAt = iso(nowMs);
  const lease: BrowserSessionLease = {
    leaseId: randomUUID(),
    ownerId: input.ownerId,
    acquiredAt: createdAt,
    heartbeatAt: createdAt,
    expiresAt: iso(nowMs + leaseTtlMs),
    generation: 1,
  };

  return {
    sessionId,
    jobId: input.jobId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    mode: input.mode,
    route: input.route,
    commitSha: input.commitSha,
    deploymentId: input.deploymentId,
    lease,
    createdAt,
    updatedAt: createdAt,
    evidence: {
      sessionId,
      jobId: input.jobId,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      route: input.route,
      commitSha: input.commitSha,
      deploymentId: input.deploymentId,
      viewport: input.viewport ?? { width: 1440, height: 900 },
      assertions: [],
      artifacts: [],
      consoleEvents: [],
      runtimeExceptions: [],
      networkFailures: [],
      accessibilityFindings: [],
      startedAt: createdAt,
      truthState: "UNPROVEN",
    },
  };
}

export function canControlBrowser(record: BrowserSessionRecord, actorId: string, nowMs = Date.now()): boolean {
  return record.lease.ownerId === actorId && Date.parse(record.lease.expiresAt) > nowMs;
}

export async function heartbeatBrowserSession(input: {
  store: BrowserSessionStore;
  sessionId: string;
  ownerId: string;
  leaseTtlMs?: number;
  nowMs?: number;
}): Promise<BrowserSessionRecord> {
  const nowMs = input.nowMs ?? Date.now();
  const current = await input.store.get(input.sessionId);
  if (!current) throw new Error("Browser session not found.");
  if (!canControlBrowser(current, input.ownerId, nowMs)) throw new Error("Browser session lease is not owned by this actor or has expired.");

  const next: BrowserSessionRecord = {
    ...current,
    updatedAt: iso(nowMs),
    lease: {
      ...current.lease,
      heartbeatAt: iso(nowMs),
      expiresAt: iso(nowMs + Math.max(5_000, input.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS)),
      generation: current.lease.generation + 1,
    },
  };

  const updated = await input.store.compareAndSwap(current.sessionId, current.lease.generation, next);
  if (!updated) throw new Error("Browser session lease changed while heartbeating.");
  return next;
}

export async function takeOverBrowserSession(input: {
  store: BrowserSessionStore;
  sessionId: string;
  nextOwnerId: string;
  leaseTtlMs?: number;
  nowMs?: number;
  force?: boolean;
}): Promise<BrowserSessionRecord> {
  const nowMs = input.nowMs ?? Date.now();
  const current = await input.store.get(input.sessionId);
  if (!current) throw new Error("Browser session not found.");
  const expired = Date.parse(current.lease.expiresAt) <= nowMs;
  if (!expired && input.force !== true) throw new Error("Browser session lease is still active.");

  const now = iso(nowMs);
  const next: BrowserSessionRecord = {
    ...current,
    mode: "takeover",
    updatedAt: now,
    lease: {
      leaseId: randomUUID(),
      ownerId: input.nextOwnerId,
      acquiredAt: now,
      heartbeatAt: now,
      expiresAt: iso(nowMs + Math.max(5_000, input.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS)),
      generation: current.lease.generation + 1,
    },
  };

  const updated = await input.store.compareAndSwap(current.sessionId, current.lease.generation, next);
  if (!updated) throw new Error("Browser session changed before takeover completed.");
  return next;
}

export function finalizeBrowserEvidence(bundle: BrowserEvidenceBundle, completedAt = new Date().toISOString()): BrowserEvidenceBundle {
  const failedAssertion = bundle.assertions.some((assertion) => !assertion.passed);
  const runtimeFailure = bundle.runtimeExceptions.length > 0;
  const consoleFailure = bundle.consoleEvents.some((event) => event.level === "error");
  const networkFailure = bundle.networkFailures.some((failure) => (failure.status ?? 0) >= 400 || Boolean(failure.errorText));
  const hasRequiredEvidence = bundle.assertions.length > 0 && bundle.artifacts.some((artifact) => artifact.kind === "trace") && bundle.artifacts.some((artifact) => artifact.kind === "screenshot");

  return {
    ...bundle,
    completedAt,
    truthState: failedAssertion || runtimeFailure || consoleFailure || networkFailure
      ? "FAILED"
      : hasRequiredEvidence
        ? "PROVEN"
        : "UNPROVEN",
  };
}

export function assertBrowserClaimIsProven(bundle: BrowserEvidenceBundle, claim: string): void {
  if (bundle.truthState !== "PROVEN") {
    throw new Error(`Cannot claim ${claim}: browser evidence is ${bundle.truthState}.`);
  }
  if (!bundle.completedAt) throw new Error(`Cannot claim ${claim}: browser verification has not completed.`);
  if (!bundle.commitSha) throw new Error(`Cannot claim ${claim}: commit identity is missing.`);
}
