import { describe, expect, it } from "vitest";
import { assertRuntimeLoadSlo, runRuntimeLoadBenchmark } from "@/lib/streams-builder/runtime-load-benchmark";

describe("runtime load benchmark", () => {
  it("measures bounded parallel execution and enforces correctness SLOs", async () => {
    const report = await runRuntimeLoadBenchmark({
      totalJobs: 10_000,
      concurrency: 256,
      execute: async (index) => ({ success: true, repaired: index % 20 === 0, hallucination: false }),
    });

    expect(report.totalJobs).toBe(10_000);
    expect(report.peakInFlight).toBeLessThanOrEqual(256);
    expect(report.summary.successRate).toBe(1);
    expect(report.summary.hallucinationRate).toBe(0);
    expect(report.throughputPerSecond).toBeGreaterThan(0);
    expect(() => assertRuntimeLoadSlo({
      report,
      requiredJobCount: 10_000,
      minimumSuccessRate: 0.999,
      maximumHallucinationRate: 0,
      maximumP95LatencyMs: 1_000,
    })).not.toThrow();
  });

  it("fails closed when hallucination or correctness thresholds are missed", async () => {
    const report = await runRuntimeLoadBenchmark({
      totalJobs: 100,
      concurrency: 10,
      execute: async (index) => ({ success: index !== 0, hallucination: index === 0 }),
    });

    expect(() => assertRuntimeLoadSlo({
      report,
      requiredJobCount: 100,
      minimumSuccessRate: 1,
      maximumHallucinationRate: 0,
      maximumP95LatencyMs: 1_000,
    })).toThrow("Runtime load SLO failed");
  });
});
