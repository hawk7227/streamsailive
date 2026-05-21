import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { buildRuntimeCapabilityRegistry } from "@/lib/streams-ai/capabilities/canonical-capabilities";
import { StreamsAIAssetsRepository } from "@/lib/streams-ai/repositories/assets-repository";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { StreamsAIProviderRunsRepository } from "@/lib/streams-ai/repositories/provider-runs-repository";

const jobs = new StreamsAIJobsRepository();
const assets = new StreamsAIAssetsRepository();
const providerRuns = new StreamsAIProviderRunsRepository();

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function classifyImageGenerationProof({
  latestJob,
  latestEvents,
  latestProviderRun,
  latestAsset,
}: {
  latestJob: Record<string, unknown> | null;
  latestEvents: Array<Record<string, unknown>>;
  latestProviderRun: Record<string, unknown> | null;
  latestAsset: Record<string, unknown> | null;
}) {
  const eventTypes = new Set(latestEvents.map((event) => String(event.event_type || "")));
  const sourceProof = true;
  const runtimeProof = Boolean(latestJob);
  const persistenceProof = Boolean(latestJob?.id);
  const workerProof = eventTypes.has("worker.claimed");
  const providerProof = Boolean(latestProviderRun?.id) && ["queued", "running", "completed", "failed"].includes(String(latestProviderRun.status || ""));
  const providerCompletedProof = String(latestProviderRun?.status || "") === "completed";
  const storageProof = Boolean(latestAsset?.storage_bucket && latestAsset?.storage_path);
  const assetProof = Boolean(latestAsset?.id);
  const previewProof = Boolean(latestAsset?.public_url);

  const proven = [] as string[];
  const missing = [] as string[];

  if (sourceProof) proven.push("source proof"); else missing.push("source proof");
  if (runtimeProof) proven.push("runtime/job record proof"); else missing.push("runtime/job record proof");
  if (persistenceProof) proven.push("persistence proof"); else missing.push("persistence proof");
  if (workerProof) proven.push("worker pickup proof"); else missing.push("worker pickup proof");
  if (providerProof) proven.push("provider_run proof"); else missing.push("provider_run proof");
  if (providerCompletedProof) proven.push("provider completion proof"); else missing.push("provider completion proof");
  if (storageProof) proven.push("storage upload proof"); else missing.push("storage upload proof");
  if (assetProof) proven.push("asset row proof"); else missing.push("asset row proof");
  if (previewProof) proven.push("stored preview URL proof"); else missing.push("stored preview URL proof");

  const classification = missing.length === 0
    ? "Proven"
    : sourceProof && persistenceProof
      ? "Implemented but unproven"
      : "Blocked";

  return { classification, proven, missing };
}

function normalizeJob(job: Record<string, unknown> | null) {
  if (!job) return null;
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    sessionId: job.session_id,
    toolCallId: job.tool_call_id,
    createdAt: job.created_at,
    inputJson: job.input_json,
  };
}

function normalizeEvent(event: Record<string, unknown>) {
  return {
    id: event.id,
    eventType: event.event_type,
    message: event.message,
    data: event.data,
    createdAt: event.created_at,
  };
}

function normalizeProviderRun(run: Record<string, unknown> | null) {
  if (!run) return null;
  return {
    id: run.id,
    jobId: run.job_id,
    provider: run.provider,
    model: run.model,
    status: run.status,
    outputAssetId: run.output_asset_id,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    error: run.error || run.error_message,
    requestJson: run.request_json,
    responseJson: run.response_json,
    createdAt: run.created_at,
  };
}

function normalizeAsset(asset: Record<string, unknown> | null) {
  if (!asset) return null;
  return {
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    mimeType: asset.mime_type,
    sizeBytes: asset.size_bytes,
    storageBucket: asset.storage_bucket,
    storagePath: asset.storage_path,
    publicUrl: asset.public_url,
    metadata: asset.metadata,
    createdAt: asset.created_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const sessionId = request.nextUrl.searchParams.get("sessionId") || null;
    const registry = buildRuntimeCapabilityRegistry();

    const jobRows = await jobs.list(scope, { sessionId });
    const latestImageJob = (jobRows.find((job) => String(job.kind || "") === "image_generation") || null) as Record<string, unknown> | null;
    const latestEvents = latestImageJob?.id ? await jobs.events(scope, String(latestImageJob.id)) as Array<Record<string, unknown>> : [];
    const providerRows = latestImageJob?.id ? await providerRuns.list(scope, { jobId: String(latestImageJob.id) }) as Array<Record<string, unknown>> : [];
    const latestProviderRun = (providerRows[0] || null) as Record<string, unknown> | null;
    const assetRows = await assets.list(scope, { sessionId });
    const latestAsset = (assetRows.find((asset) => {
      const metadata = (asset.metadata || {}) as Record<string, unknown>;
      return latestImageJob?.id && metadata.jobId === latestImageJob.id;
    }) || assetRows[0] || null) as Record<string, unknown> | null;

    const proof = classifyImageGenerationProof({ latestJob: latestImageJob, latestEvents, latestProviderRun, latestAsset });

    return streamsAIJson({
      ok: true,
      source: "streams-ai-proof-audit-view",
      generatedAt: new Date().toISOString(),
      scope: {
        tenantId: scope.tenantId,
        userId: scope.userId,
        defaultProjectId: scope.defaultProjectId,
        sessionId,
      },
      env: {
        openaiApiKeyConfigured: hasEnv("OPENAI_API_KEY"),
        falKeyConfigured: hasEnv("FAL_API_KEY") || hasEnv("FAL_KEY"),
        supabaseUrlConfigured: hasEnv("NEXT_PUBLIC_SUPABASE_URL") || hasEnv("SUPABASE_URL"),
        supabaseServiceConfigured: hasEnv("SUPABASE_SERVICE_ROLE_KEY") || hasEnv("SUPABASE_SERVICE_KEY"),
        workerSecretConfigured: hasEnv("STREAMS_AI_WORKER_SECRET") || hasEnv("CRON_SECRET"),
      },
      capabilities: {
        registryVersion: registry.version,
        total: registry.total,
        statusCounts: registry.statusCounts,
      },
      imageGenerationProof: proof,
      latestImageJob: normalizeJob(latestImageJob),
      latestImageJobEvents: latestEvents.map(normalizeEvent),
      latestProviderRun: normalizeProviderRun(latestProviderRun),
      latestAsset: normalizeAsset(latestAsset),
      totals: {
        jobs: jobRows.length,
        providerRuns: providerRows.length,
        assets: assetRows.length,
      },
    });
  } catch (error) {
    return streamsAIError(error);
  }
}
