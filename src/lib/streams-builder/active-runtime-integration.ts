import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import type { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { AdaptiveModelRouter, ExecutionTrace, type ProviderTelemetry, type RuntimeEvidence } from "./autonomous-runtime-completion";
import type { RepositoryWorkerResult } from "./repository-worker";

export type ActiveRuntimeInput = {
  scope: StreamsAIScope;
  jobId: string;
  projectId: string;
  repository: string;
  branch: string;
  route: string;
  targetFiles: string[];
  jobs: StreamsAIJobsRepository;
};

export type ActiveRuntimeSession = {
  trace: ExecutionTrace;
  model: { provider: string; model: string };
  emit(stage: string, action: string, reason: string, input: unknown, evidence?: RuntimeEvidence[]): Promise<void>;
  finalize(result: RepositoryWorkerResult): Promise<{ trace: ReturnType<ExecutionTrace["list"]>; explanation: string; model: { provider: string; model: string } }>;
};

function numberEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function providerTelemetry(): ProviderTelemetry[] {
  const primaryModel = process.env.OPENAI_CODEX_MODEL || process.env.OPENAI_MODEL || "gpt-5.1-codex";
  const verificationModel = process.env.OPENAI_VERIFICATION_MODEL || primaryModel;
  return [
    {
      provider: "openai",
      model: primaryModel,
      available: Boolean(process.env.OPENAI_API_KEY),
      quality: numberEnv("STREAMS_MODEL_QUALITY", 0.95),
      latencyMs: numberEnv("STREAMS_MODEL_LATENCY_MS", 1200),
      costPerMillionTokens: numberEnv("STREAMS_MODEL_COST_PER_MILLION", 10),
      failures: numberEnv("STREAMS_MODEL_FAILURES", 0),
    },
    {
      provider: "openai",
      model: verificationModel,
      available: Boolean(process.env.OPENAI_API_KEY),
      quality: numberEnv("STREAMS_VERIFICATION_MODEL_QUALITY", 0.9),
      latencyMs: numberEnv("STREAMS_VERIFICATION_MODEL_LATENCY_MS", 900),
      costPerMillionTokens: numberEnv("STREAMS_VERIFICATION_MODEL_COST_PER_MILLION", 6),
      failures: numberEnv("STREAMS_VERIFICATION_MODEL_FAILURES", 0),
    },
  ];
}

export async function createActiveRuntimeSession(input: ActiveRuntimeInput): Promise<ActiveRuntimeSession> {
  const trace = new ExecutionTrace();
  const candidates = providerTelemetry();
  const available = candidates.some((candidate) => candidate.available)
    ? candidates
    : candidates.map((candidate) => ({ ...candidate, available: true, quality: Math.min(candidate.quality, 0.5) }));
  const selected = new AdaptiveModelRouter(available).route({ task: "coding", contextTokens: 128_000, minimumQuality: 0.4 });

  async function emit(stage: string, action: string, reason: string, eventInput: unknown, evidence: RuntimeEvidence[] = []) {
    const event = trace.append({ stage, action, reason, input: eventInput, evidence });
    await input.jobs.createEvent(input.scope, {
      jobId: input.jobId,
      eventType: `repository.runtime.${stage}.${action}`,
      message: `${stage}: ${action}`,
      data: { ...event, userVisible: true },
    });
  }

  await emit("runtime", "initialized", "active repository worker entered the canonical autonomous runtime", {
    projectId: input.projectId,
    repository: input.repository,
    branch: input.branch,
    route: input.route,
    targetFiles: input.targetFiles,
    model: { provider: selected.provider, model: selected.model },
  });

  return {
    trace,
    model: { provider: selected.provider, model: selected.model },
    emit,
    async finalize(result) {
      await emit(
        "runtime",
        result.ok ? "completed" : "failed",
        result.ok ? "repository worker returned a successful result" : "repository worker returned a failed or blocked result",
        result,
      );
      const payload = { trace: trace.list(), explanation: trace.explain(), model: { provider: selected.provider, model: selected.model } };
      await input.jobs.update(input.scope, input.jobId, {
        metadata: {
          activeAutonomousRuntime: payload,
          runtimeTruthState: result.truthState,
          runtimeStatus: result.status,
        },
      });
      return payload;
    },
  };
}
