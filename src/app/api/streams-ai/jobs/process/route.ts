import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { StreamsAIProviderRunsRepository } from "@/lib/streams-ai/repositories/provider-runs-repository";
import { FAL_ENDPOINTS, falSubmit } from "@/lib/streams/fal-client";

export const maxDuration = 60;

const jobs = new StreamsAIJobsRepository();
const providerRuns = new StreamsAIProviderRunsRepository();

function promptFromJob(job: Record<string, unknown>) {
  const input = (job.input_json || {}) as Record<string, unknown>;
  return String(input.prompt || input.originalRequest || "Generate a realistic image.").slice(0, 8000);
}

function isImageJob(job: Record<string, unknown>) {
  return String(job.kind || "") === "image_generation";
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{ jobId?: string }>(request);
    if (!body.jobId) return streamsAIJson({ ok: false, error: "jobId is required" }, 400);

    const job = await jobs.get(scope, body.jobId) as Record<string, unknown> | null;
    if (!job) return streamsAIJson({ ok: false, error: "Job not found" }, 404);

    await jobs.update(scope, body.jobId, { status: "running" });
    await jobs.createEvent(scope, {
      jobId: body.jobId,
      eventType: "worker.claimed",
      message: "STREAMS AI processor picked up job",
      data: { processor: "streams-ai-jobs-process-route" },
    });

    if (!isImageJob(job)) {
      await jobs.createEvent(scope, {
        jobId: body.jobId,
        eventType: "worker.blocked",
        message: "No provider processor exists for this job kind yet",
        data: { kind: job.kind || null },
      });
      return streamsAIJson({
        ok: true,
        status: "blocked",
        jobId: body.jobId,
        proof: ["worker pickup", "job event written"],
        unproven: ["provider execution", "provider_runs completed", "storage upload", "asset creation", "preview rendering"],
      });
    }

    const existingRuns = await providerRuns.list(scope, { jobId: body.jobId });
    if (existingRuns.length) {
      return streamsAIJson({
        ok: true,
        status: "already_has_provider_run",
        jobId: body.jobId,
        providerRun: existingRuns[0],
        proof: ["worker pickup", "provider_runs row exists"],
        unproven: ["provider completion", "storage upload", "asset creation", "preview rendering"],
      });
    }

    const providerRun = await providerRuns.create(scope, {
      jobId: body.jobId,
      provider: "fal",
      model: "flux-kontext",
      status: "started",
      startedAt: new Date().toISOString(),
      requestJson: {
        endpoint: FAL_ENDPOINTS.FLUX_KONTEXT,
        input: {
          prompt: promptFromJob(job),
          aspect_ratio: "1:1",
          num_images: 1,
        },
      },
    }) as Record<string, unknown>;

    await jobs.createEvent(scope, {
      jobId: body.jobId,
      eventType: "provider.started",
      message: "Submitting image job to fal provider",
      data: { provider: "fal", model: "flux-kontext", providerRunId: providerRun.id },
    });

    const submit = await falSubmit(FAL_ENDPOINTS.FLUX_KONTEXT, {
      prompt: promptFromJob(job),
      aspect_ratio: "1:1",
      num_images: 1,
    });

    if (!submit.ok) {
      await providerRuns.update(scope, String(providerRun.id), {
        status: "failed",
        error: submit.error,
        completedAt: new Date().toISOString(),
      });
      await jobs.update(scope, body.jobId, { status: "failed" });
      await jobs.createEvent(scope, {
        jobId: body.jobId,
        eventType: "provider.failed",
        message: submit.error,
        data: { provider: "fal", providerRunId: providerRun.id },
      });
      return streamsAIJson({ ok: false, status: "failed", jobId: body.jobId, providerRunId: providerRun.id, error: submit.error }, 502);
    }

    const updatedProviderRun = await providerRuns.update(scope, String(providerRun.id), {
      status: "queued",
      responseJson: { responseUrl: submit.responseUrl, submittedAt: new Date().toISOString() },
    });

    await jobs.createEvent(scope, {
      jobId: body.jobId,
      eventType: "provider.queued",
      message: "Provider accepted queued image job",
      data: { provider: "fal", providerRunId: providerRun.id, responseUrl: submit.responseUrl },
    });

    return streamsAIJson({
      ok: true,
      status: "provider_queued",
      jobId: body.jobId,
      providerRun: updatedProviderRun,
      proof: ["worker pickup", "provider_runs row", "provider request accepted"],
      unproven: ["provider completion", "storage upload", "asset creation", "preview rendering"],
    });
  } catch (error) {
    return streamsAIError(error);
  }
}
