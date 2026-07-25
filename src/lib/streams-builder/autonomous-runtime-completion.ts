import { createHash } from "node:crypto";

export type RuntimeEvidence = { kind: string; uri: string; sha256: string; createdAt: string; metadata?: Record<string, unknown> };
export type RuntimeTraceEvent = { sequence: number; stage: string; action: string; reason: string; inputDigest: string; outputDigest?: string; evidence: RuntimeEvidence[]; createdAt: string };
export type ProviderTelemetry = { provider: string; model: string; available: boolean; quality: number; latencyMs: number; costPerMillionTokens: number; failures: number; circuitOpenUntil?: number };
export type ModelRequirement = { task: "reasoning" | "coding" | "vision" | "verification" | "summarization"; contextTokens: number; requiresVision?: boolean; maxLatencyMs?: number; maxCostPerMillionTokens?: number; minimumQuality?: number };
export type DeploymentTarget = { provider: string; projectId: string; commitSha: string; expectedUrl?: string };
export type DeploymentObservation = { deploymentId: string; commitSha: string; url: string; status: "ready" | "failed" | "building"; healthStatus: number; bodyDigest: string; evidence: RuntimeEvidence[] };

const digest = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

export class ExecutionTrace {
  private events: RuntimeTraceEvent[] = [];
  append(input: Omit<RuntimeTraceEvent, "sequence" | "createdAt" | "inputDigest"> & { input: unknown }) {
    const event: RuntimeTraceEvent = { ...input, sequence: this.events.length + 1, createdAt: new Date().toISOString(), inputDigest: digest(input.input) };
    delete (event as RuntimeTraceEvent & { input?: unknown }).input;
    this.events.push(structuredClone(event));
    return event;
  }
  list() { return structuredClone(this.events); }
  explain() { return this.events.map((event) => `${event.sequence}. ${event.stage}: ${event.action} because ${event.reason}`).join("\n"); }
  verifyClaim(stage: string, action: string) {
    const event = [...this.events].reverse().find((item) => item.stage === stage && item.action === action);
    if (!event || event.evidence.length === 0) throw new Error(`No runtime evidence proves ${stage}:${action}.`);
    return event;
  }
}

export class AdaptiveModelRouter {
  constructor(private readonly telemetry: ProviderTelemetry[]) {}
  route(requirement: ModelRequirement, now = Date.now()) {
    const eligible = this.telemetry.filter((item) => item.available && (!item.circuitOpenUntil || item.circuitOpenUntil <= now))
      .filter((item) => item.quality >= (requirement.minimumQuality ?? 0))
      .filter((item) => !requirement.maxLatencyMs || item.latencyMs <= requirement.maxLatencyMs)
      .filter((item) => !requirement.maxCostPerMillionTokens || item.costPerMillionTokens <= requirement.maxCostPerMillionTokens);
    if (!eligible.length) throw new Error(`No healthy model satisfies ${requirement.task} requirements.`);
    return [...eligible].sort((a, b) => {
      const scoreA = a.quality * 100 - a.latencyMs / 100 - a.costPerMillionTokens * 2 - a.failures * 10;
      const scoreB = b.quality * 100 - b.latencyMs / 100 - b.costPerMillionTokens * 2 - b.failures * 10;
      return scoreB - scoreA;
    })[0]!;
  }
}

export interface DeploymentProvider {
  deploy(target: DeploymentTarget): Promise<{ deploymentId: string; url: string }>;
  inspect(deploymentId: string): Promise<{ status: "ready" | "failed" | "building"; commitSha: string; url: string }>;
  fetch(url: string): Promise<{ status: number; body: string }>;
}

export async function verifyDeployment(provider: DeploymentProvider, target: DeploymentTarget): Promise<DeploymentObservation> {
  const created = await provider.deploy(target);
  const inspected = await provider.inspect(created.deploymentId);
  if (inspected.status !== "ready") throw new Error(`Deployment ${created.deploymentId} is ${inspected.status}.`);
  if (inspected.commitSha !== target.commitSha) throw new Error(`Deployment commit mismatch: expected ${target.commitSha}, received ${inspected.commitSha}.`);
  if (target.expectedUrl && inspected.url !== target.expectedUrl) throw new Error(`Deployment URL mismatch.`);
  const response = await provider.fetch(inspected.url);
  if (response.status < 200 || response.status >= 400) throw new Error(`Deployment health check failed with HTTP ${response.status}.`);
  const evidence: RuntimeEvidence[] = [{ kind: "deployment-http", uri: inspected.url, sha256: digest(response.body), createdAt: new Date().toISOString(), metadata: { status: response.status, deploymentId: created.deploymentId, commitSha: inspected.commitSha } }];
  return { deploymentId: created.deploymentId, commitSha: inspected.commitSha, url: inspected.url, status: inspected.status, healthStatus: response.status, bodyDigest: digest(response.body), evidence };
}

export type VersionedRecord<T> = { key: string; version: number; value: T; lease?: { owner: string; expiresAt: number } };
export interface TransactionalStore<T> {
  get(key: string): Promise<VersionedRecord<T> | null>;
  create(record: VersionedRecord<T>): Promise<void>;
  compareAndSwap(key: string, expectedVersion: number, next: VersionedRecord<T>): Promise<boolean>;
}

export async function transact<T>(store: TransactionalStore<T>, key: string, update: (value: T) => T, retries = 8) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const current = await store.get(key);
    if (!current) throw new Error(`Record ${key} not found.`);
    const next: VersionedRecord<T> = { ...current, version: current.version + 1, value: update(structuredClone(current.value)) };
    if (await store.compareAndSwap(key, current.version, next)) return next;
  }
  throw new Error(`Transaction conflict for ${key}.`);
}

export function truthGate(input: { buildPassed: boolean; testsPassed: boolean; typecheckPassed: boolean; lintPassed: boolean; browserRequired: boolean; browserEvidence?: RuntimeEvidence[]; deploymentRequired: boolean; deploymentEvidence?: RuntimeEvidence[] }) {
  const failures: string[] = [];
  if (!input.buildPassed) failures.push("build");
  if (!input.testsPassed) failures.push("tests");
  if (!input.typecheckPassed) failures.push("typecheck");
  if (!input.lintPassed) failures.push("lint");
  if (input.browserRequired && !input.browserEvidence?.length) failures.push("browser evidence");
  if (input.deploymentRequired && !input.deploymentEvidence?.length) failures.push("deployment evidence");
  if (failures.length) throw new Error(`Runtime truth gate rejected success: ${failures.join(", ")}.`);
  return { proven: true as const, evidenceDigest: digest({ browser: input.browserEvidence, deployment: input.deploymentEvidence }) };
}
