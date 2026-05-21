import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAIAssetsRepository } from "@/lib/streams-ai/repositories/assets-repository";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { StreamsAIProviderRunsRepository } from "@/lib/streams-ai/repositories/provider-runs-repository";
import { createStreamsAIServiceClient } from "@/lib/streams-ai/server";
import { extractImageUrl, falPoll } from "@/lib/streams/fal-client";

export const maxDuration = 60;

const jobs = new StreamsAIJobsRepository();
const providerRuns = new StreamsAIProviderRunsRepository();
const assets = new StreamsAIAssetsRepository();
const STORAGE_BUCKET = process.env.STREAMS_AI_GENERATIONS_BUCKET || "generations";

function storageExt(contentType: string) {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

async function ensureBucket(bucket: string) {
  const client = createStreamsAIServiceClient();
  const { data: buckets } = await client.storage.listBuckets();
  if (!buckets?.some((item) => item.name === bucket)) await client.storage.createBucket(bucket, { public: true });
  return client;
}

async function uploadProviderImage(scope: Awaited<ReturnType<typeof requireStreamsAIScope>>, jobId: string, providerUrl: string) {
  const providerResponse = await fetch(providerUrl, { signal: AbortSignal.timeout(60_000) });
  if (!providerResponse.ok) throw new Error(`Provider output download failed: ${providerResponse.status}`);

  const contentType = providerResponse.headers.get("content-type") || "image/png";
  const bytes = await providerResponse.arrayBuffer();
  const storagePath = `${scope.tenantId}/${scope.userId}/${jobId}/${crypto.randomUUID()}.${storageExt(contentType)}`;
  const client = await ensureBucket(STORAGE_BUCKET);

  const { error } = await client.storage.from(STORAGE_BUCKET).upload(storagePath, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return { contentType, sizeBytes: bytes.byteLength, storageBucket: STORAGE_BUCKET, storagePath, publicUrl: data.publicUrl };
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{ jobId?: string }>(request);
    if (!body.jobId) return streamsAIJson({ ok: false, error: "jobId is required" }, 400);

    const job = await jobs.get(scope, body.jobId) as Record<string, unknown> | null;
    if (!job) return streamsAIJson({ ok: false, error: "Job not found" }, 404);

    const runs = await providerRuns.list(scope, { jobId: body.jobId });
    const run = runs[0] as Record<string, unknown> | undefined;
    if (!run?.id) {
      return streamsAIJson({ ok: false, status: "blocked", error: "No provider_run exists for this job yet." }, 409);
    }

    const responseJson = (run.response_json || {}) as Record<string, unknown>;
    const responseUrl = typeof responseJson.responseUrl === "string" ? responseJson.responseUrl : "";
    if (!responseUrl) return streamsAIJson({ ok: false, status: "blocked", error: "provider_run has no responseUrl yet." }, 409);

    await jobs.createEvent(scope, { jobId: body.jobId, eventType: "provider.polling", message: "Polling provider output", data: { providerRunId: run.id } });
    const poll = await falPoll(responseUrl);

    if (poll.status === "processing") {
      await providerRuns.update(scope, String(run.id), { status: "running", responseJson: { ...responseJson, lastStatus: poll.status, lastPollAt: new Date().toISOString() } });
      await jobs.update(scope, body.jobId, { status: "running" });
      await jobs.createEvent(scope, { jobId: body.jobId, eventType: "provider.running", message: "Provider is still processing", data: { providerRunId: run.id } });
      return streamsAIJson({ ok: true, status: "running", jobId: body.jobId, providerRunId: run.id, proof: ["worker pickup", "provider_runs row", "provider polling"], unproven: ["provider completion", "storage upload", "asset creation", "preview rendering"] });
    }

    if (poll.status === "failed") {
      await providerRuns.update(scope, String(run.id), { status: "failed", responseJson: { ...responseJson, raw: poll.raw }, error: "Provider failed", completedAt: new Date().toISOString() });
      await jobs.update(scope, body.jobId, { status: "failed" });
      await jobs.createEvent(scope, { jobId: body.jobId, eventType: "provider.failed", message: "Provider failed", data: { providerRunId: run.id, raw: poll.raw as Record<string, unknown> } });
      return streamsAIJson({ ok: false, status: "failed", jobId: body.jobId, providerRunId: run.id, error: "Provider failed" }, 502);
    }

    const providerImageUrl = extractImageUrl(poll.raw);
    if (!providerImageUrl) {
      await providerRuns.update(scope, String(run.id), { status: "failed", responseJson: { ...responseJson, raw: poll.raw }, error: "Provider returned no image URL", completedAt: new Date().toISOString() });
      await jobs.update(scope, body.jobId, { status: "failed" });
      await jobs.createEvent(scope, { jobId: body.jobId, eventType: "provider.failed", message: "Provider returned no image URL", data: { providerRunId: run.id, raw: poll.raw as Record<string, unknown> } });
      return streamsAIJson({ ok: false, status: "failed", jobId: body.jobId, providerRunId: run.id, error: "Provider returned no image URL" }, 502);
    }

    await jobs.createEvent(scope, { jobId: body.jobId, eventType: "storage.uploading", message: "Uploading provider output to storage", data: { providerRunId: run.id } });
    const stored = await uploadProviderImage(scope, body.jobId, providerImageUrl);
    await jobs.createEvent(scope, { jobId: body.jobId, eventType: "storage.uploaded", message: "Provider output uploaded to storage", data: stored });

    const asset = await assets.create(scope, {
      sessionId: typeof job.session_id === "string" ? job.session_id : null,
      projectId: typeof job.project_id === "string" ? job.project_id : null,
      productId: "streams-ai",
      kind: "image",
      name: "Generated STREAMS image",
      mimeType: stored.contentType,
      sizeBytes: stored.sizeBytes,
      storageBucket: stored.storageBucket,
      storagePath: stored.storagePath,
      publicUrl: stored.publicUrl,
      metadata: { jobId: body.jobId, providerRunId: run.id, provider: "fal", providerImageUrl },
    }) as Record<string, unknown>;

    await providerRuns.update(scope, String(run.id), { status: "completed", responseJson: { ...responseJson, raw: poll.raw, stored }, outputAssetId: String(asset.id || ""), completedAt: new Date().toISOString() });
    await jobs.update(scope, body.jobId, { status: "completed" });
    await jobs.createEvent(scope, { jobId: body.jobId, eventType: "asset.created", message: "Generated output asset created", data: { assetId: asset.id, publicUrl: stored.publicUrl } });
    await jobs.createEvent(scope, { jobId: body.jobId, eventType: "job.completed", message: "Image generation job completed", data: { assetId: asset.id, providerRunId: run.id } });

    return streamsAIJson({
      ok: true,
      status: "completed",
      jobId: body.jobId,
      providerRunId: run.id,
      outputAssetId: asset.id,
      publicUrl: stored.publicUrl,
      previewMarkdown: `![Generated STREAMS image](${stored.publicUrl})`,
      proof: ["worker pickup", "provider execution", "provider_runs row", "storage upload", "generated output asset creation", "final preview URL from stored output"],
      unproven: ["browser visual confirmation after refresh"],
    });
  } catch (error) {
    return streamsAIError(error);
  }
}
