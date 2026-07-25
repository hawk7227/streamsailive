import { performance } from "node:perf_hooks";
import { summarizeRuntimeBenchmark, type RuntimeBenchmarkSample } from "./production-runtime-services";

export interface RuntimeLoadBenchmarkOptions {
  totalJobs: number;
  concurrency: number;
  execute: (jobIndex: number) => Promise<{ success: boolean; repaired?: boolean; hallucination?: boolean }>;
  failFast?: boolean;
}

export interface RuntimeLoadBenchmarkReport {
  startedAt: string;
  completedAt: string;
  totalJobs: number;
  concurrency: number;
  wallClockMs: number;
  throughputPerSecond: number;
  peakInFlight: number;
  summary: ReturnType<typeof summarizeRuntimeBenchmark>;
}

export async function runRuntimeLoadBenchmark(options: RuntimeLoadBenchmarkOptions): Promise<RuntimeLoadBenchmarkReport> {
  const totalJobs = Math.max(1, Math.min(Math.floor(options.totalJobs), 1_000_000));
  const concurrency = Math.max(1, Math.min(Math.floor(options.concurrency), totalJobs));
  const samples: RuntimeBenchmarkSample[] = new Array(totalJobs);
  const startedAt = new Date().toISOString();
  const wallStart = performance.now();
  let nextIndex = 0;
  let inFlight = 0;
  let peakInFlight = 0;
  let firstError: unknown = null;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= totalJobs || (options.failFast && firstError)) return;
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      const started = performance.now();
      try {
        const result = await options.execute(index);
        samples[index] = {
          latencyMs: Math.max(0, performance.now() - started),
          success: result.success,
          repaired: result.repaired === true,
          hallucination: result.hallucination === true,
        };
      } catch (error) {
        firstError ??= error;
        samples[index] = {
          latencyMs: Math.max(0, performance.now() - started),
          success: false,
          repaired: false,
          hallucination: false,
        };
      } finally {
        inFlight -= 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  if (options.failFast && firstError) throw firstError;
  const completedSamples = samples.filter((sample): sample is RuntimeBenchmarkSample => Boolean(sample));
  const wallClockMs = Math.max(0.001, performance.now() - wallStart);
  return {
    startedAt,
    completedAt: new Date().toISOString(),
    totalJobs: completedSamples.length,
    concurrency,
    wallClockMs,
    throughputPerSecond: completedSamples.length / (wallClockMs / 1_000),
    peakInFlight,
    summary: summarizeRuntimeBenchmark(completedSamples),
  };
}

export function assertRuntimeLoadSlo(input: {
  report: RuntimeLoadBenchmarkReport;
  minimumSuccessRate: number;
  maximumHallucinationRate: number;
  maximumP95LatencyMs: number;
  requiredJobCount: number;
}) {
  const failures: string[] = [];
  if (input.report.totalJobs < input.requiredJobCount) failures.push(`job count ${input.report.totalJobs} is below ${input.requiredJobCount}`);
  if (input.report.summary.successRate < input.minimumSuccessRate) failures.push(`success rate ${input.report.summary.successRate} is below ${input.minimumSuccessRate}`);
  if (input.report.summary.hallucinationRate > input.maximumHallucinationRate) failures.push(`hallucination rate ${input.report.summary.hallucinationRate} exceeds ${input.maximumHallucinationRate}`);
  if (input.report.summary.latencyMs.p95 > input.maximumP95LatencyMs) failures.push(`p95 latency ${input.report.summary.latencyMs.p95}ms exceeds ${input.maximumP95LatencyMs}ms`);
  if (failures.length) throw new Error(`Runtime load SLO failed: ${failures.join("; ")}`);
}
