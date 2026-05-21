import { NextResponse, type NextRequest } from "next/server";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";
import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIAssetsRepository } from "@/lib/streams-ai/repositories/assets-repository";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { StreamsAIProviderRunsRepository } from "@/lib/streams-ai/repositories/provider-runs-repository";
import { FAL_ENDPOINTS, extractImageUrl, falPoll, falSubmit } from "@/lib/streams/fal-client";

export const maxDuration = 60;

const assets = new StreamsAIAssetsRepository();
const jobs = new StreamsAIJobsRepository();
const providerRuns = new StreamsAIProviderRunsRepository();

const WORKER_NAME = "streams-ai-durable-cron-worker";
const STORAGE_BUCKET = process.env.STREAMS_AI_GENERATIONS_BUCKET || "generations";
const BATCH_LIMIT = 3;
const POLL_TIME_BUDGET_MS = 45_000;
const POLL_INTERVAL_MS = 2_000;

type WorkerResult = {
  jobId: string;
  status: string;
  ok: boolean;
  providerRunId?: string | null;
  outputAssetId?: string | null;
  publicUrl?: string | null;
  error?: string;
  proof: string[];
  unproven: string[];
};

function isAuthorized(request: NextRequest) {
  const expected = process.env.STREAMS_AI_WORKER_SECRET || process.env.CRON_SECRET || "";
  if (!expected && process.env.NODE_ENV !== "production") return true;
  const auth = request.headers.get("authorization") || "";
  const querySecret = request.nextUrl.searchParams.get("secret") || "";
  return auth === `Bearer ${expected}` || querySecret === expected;
}

function toScope(row: Record<string, unknown>): StreamsAIScope {
  return {
    tenantId: String(row.tenant_id),
    userId: String(row.user_id),
    defaultProjectId: typeof row.project_id === "string" ? row.project_id : null,
    workspaceId: "streams-ai",
    moduleId: "streams-ai-core",
    productId: "streams-ai",
  };
}

function promptFromJob(row: Record<string, unknown>) {
  const input = (row.input_json || {}) as Record<string, unknown>;
  return String(input.prompt || input.originalRequest || "Generate a realistic product image.").trim().slice(0, 8000);
}

function imageExt(contentType: string) {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWorkBatch() {
  const client = streamsAISchema(createStreamsAIServiceClient());
  const { data, error } = await client
    .from(streamsAITables.jobs)
    .select("*")
    .eq("kind", "image_generation")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) throw new Error(`Failed to fetch STREAMS AI worker batch: ${error.message}`);
  return (data || []) as Array<Record<string, unknown>>;
}

async function ensureBucket(bucket: string) {
  const service = createStreamsAIServiceClient();
  const { data: buckets } = await service.storage.listBuckets();
  if (!buckets?.some((item) => item.name === bucket)) await service.storage.createBucket(bucket, { public: true });
  return service;
}

async function uploadStoredImage(scope: StreamsAIScope, jobId: string, providerUrl: string) {
  const response = await fetch(providerUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Provider output download failed: ${response.status} ${response.statusText}`);
  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = await response.arrayBuffer();
  const storagePath = `${scope.tenantId}/${scope.userId}/${jobId}/${crypto.randomUUID()}.${imageExt(contentType)}`;
  const service = await ensureBucket(STORAGE_BUCKET);
  const { error } = await service.storage.from(STORAGE_BUCKET).upload(storagePath, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = service.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return { contentType, sizeBytes: bytes.byteLength, storageBucket: STORAGE_BUCKET, storagePath, publicUrl: data.publicUrl };
}

async function processJob(row: Record<string, unknown>): Promise<WorkerResult> {
  const jobId = String(row.id);
  const scope = toScope(row);

  await jobs.update(scope, jobId, { status: "running" });
  await jobs.createEvent(scope, { jobId, eventType: "worker.claimed", message: "Durable worker picked up job", data: { worker: WORKER_NAME } });

  let runs = await providerRuns.list(scope, { jobId }) as Array<Record<string, unknown>>;
  let run = runs[0];

  if (!run?.id) {
    const input = { prompt: promptFromJob(row), aspect_ratio: "1:1", num_images: 1 };
    run = await providerRuns.create(scope, {
      jobId,
      provider: "fal",
      model: "flux-kontext",
      status: "started",
      startedAt: new Date().toISOString(),
      requestJson: { endpoint: FAL_ENDPOINTS.FLUX_KONTEXT, input },
    }) as Record<string, unknown>;

    await jobs.createEvent(scope, { jobId, eventType: "provider.started", message: "Submitting image job to fal", data: { providerRunId: run.id, provider: "fal" } });
    const submit = await falSubmit(FAL_ENDPOINTS.FLUX_KONTEXT, input);
    if (!submit.ok) {
      await providerRuns.update(scope, String(run.id), { status: "failed", error: submit.error, completedAt: new Date().toISOString() });
      await jobs.update(scope, jobId, { status: "failed" });
      await jobs.createEvent(scope, { jobId, eventType: "provider.failed", message: submit.error, data: { providerRunId: run.id } });
      return { ok: false, status: "failed", jobId, providerRunId: String(run.id), error: submit.error, proof: ["worker pickup", "provider_runs row"], unproven: ["provider completion", "storage upload", "asset creation", "preview rendering"] };
    }

    run = await providerRuns.update(scope, String(run.id), { status: "queued", responseJson: { responseUrl: submit.responseUrl, submittedAt: new Date().toISOString() } }) as Record<string, unknown>;
    await jobs.createEvent(scope, { jobId, eventType: "provider.queued", message: "Provider accepted image job", data: { providerRunId: run.id, responseUrl: submit.responseUrl } });
  }

  const providerRunId = String(run.id);
  const responseJson = (run.response_json || {}) as Record<string, unknown>;
  const responseUrl = String(responseJson.responseUrl || "");
  if (!responseUrl) {
    return { ok: true, status: "provider_run_created", jobId, providerRunId, proof: ["worker pickup", "provider_runs row"], unproven: ["provider queue response", "storage upload", "asset creation", "preview rendering"] };
  }

  const start = Date.now();
  while (Date.now() - start < POLL_TIME_BUDGET_MS) {
    await jobs.createEvent(scope, { jobId, eventType: "provider.polling", message: "Polling provider output", data: { providerRunId } });
    const poll = await falPoll(responseUrl);

    if (poll.status === "processing") {
      await providerRuns.update(scope, providerRunId, { status: "running", responseJson: { ...responseJson, lastStatus: poll.status, lastPollAt: new Date().toISOString() } });
      await jobs.createEvent(scope, { jobId, eventType: "provider.running", message: "Provider still processing", data: { providerRunId } });
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (poll.status === "failed") {
      await providerRuns.update(scope, providerRunId, { status: "failed", responseJson: { ...responseJson, raw: poll.raw }, error: "Provider failed", completedAt: new Date().toISOString() });
      await jobs.update(scope, jobId, { status: "failed" });
      await jobs.createEvent(scope, { jobId, eventType: "provider.failed", message: "Provider failed", data: { providerRunId, raw: poll.raw as Record<string, unknown> } });
      return { ok: false, status: "failed", jobId, providerRunId, error: "Provider failed", proof: ["worker pickup", "provider_runs row", "provider execution attempted"], unproven: ["storage upload", "asset creation", "preview rendering"] };
    }

    const providerImageUrl = extractImageUrl(poll.raw);
    if (!providerImageUrl) {
      await providerRuns.update(scope, providerRunId, { status: "failed", responseJson: { ...responseJson, raw: poll.raw }, error: "Provider completed without image URL", completedAt: new Date().toISOString() });
      await jobs.update(scope, jobId, { status: "failed" });
      await jobs.createEvent(scope, { jobId, eventType: "provider.failed", message: "Provider completed without image URL", data: { providerRunId, raw: poll.raw as Record<string, unknown> } });
      return { ok: false, status: "failed", jobId, providerRunId, error: "Provider completed without image URL", proof: ["worker pickup", "provider_runs row", "provider execution"], unproven: ["storage upload", "asset creation", "preview rendering"] };
    }

    await jobs.createEvent(scope, { jobId, eventType: "storage.uploading", message: "Uploading provider output", data: { providerRunId } });
    const stored = await uploadStoredImage(scope, jobId, providerImageUrl);
    await jobs.createEvent(scope, { jobId, eventType: "storage.uploaded", message: "Uploaded output to storage", data: stored });

    const asset = await assets.create(scope, {
      sessionId: typeof row.session_id === "string" ? row.session_id : null,
      projectId: typeof row.project_id === "string" ? row.project_id : null,
      productId: "streams-ai",
      kind: "image",
      name: "Generated STREAMS image",
      mimeType: stored.contentType,
      sizeBytes: stored.sizeBytes,
      storageBucket: stored.storageBucket,
      storagePath: stored.storagePath,
      publicUrl: stored.publicUrl,
      metadata: { jobId, providerRunId, provider: "fal", providerImageUrl, worker: WORKER_NAME },
    }) as Record<string, unknown>;

    await providerRuns.update(scope, providerRunId, { status: "completed", responseJson: { ...responseJson, raw: poll.raw, stored }, outputAssetId: String(asset.id || ""), completedAt: new Date().toISOString() });
    await jobs.update(scope, jobId, { status: "completed" });
    await jobs.createEvent(scope, { jobId, eventType: "asset.created", message: "Generated output asset created", data: { assetId: asset.id, publicUrl: stored.publicUrl } });
    await jobs.createEvent(scope, { jobId, eventType: "job.completed", message: "Image generation job completed", data: { providerRunId, assetId: asset.id } });

    return { ok: true, status: "completed", jobId, providerRunId, outputAssetId: String(asset.id || ""), publicUrl: stored.publicUrl, proof: ["worker pickup", "provider execution", "provider_runs row", "storage upload", "generated output asset creation", "stored output preview URL"], unproven: ["browser visual confirmation after refresh"] };
  }

  await jobs.update(scope, jobId, { status: "running" });
  return { ok: true, status: "running", jobId, providerRunId, proof: ["worker pickup", "provider_runs row", "provider execution submitted"], unproven: ["provider completion", "storage upload", "asset creation", "preview rendering"] };
}

async function runWorker() {
  const batch = await fetchWorkBatch();
  const results: WorkerResult[] = [];
  for (const job of batch) {
    results.push(await processJob(job));
  }
  return { ok: true, worker: WORKER_NAME, processed: results.length, results };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized worker request" }, { status: 401 });
  try {
    return NextResponse.json(await runWorker());
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized worker request" }, { status: 401 });
  try {
    return NextResponse.json(await runWorker());
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
