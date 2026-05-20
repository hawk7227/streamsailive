const DEFAULT_BUCKET = process.env.STREAMS_MEDIA_QUEUE_BUCKET || "streams-media-queue";
const MAX_LIST_LIMIT = 100;

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function headers(config, contentType = "application/json") {
  return {
    Authorization: `Bearer ${config.key}`,
    apikey: config.key,
    "Content-Type": contentType,
  };
}

export function durableQueueAvailable() {
  return Boolean(getSupabaseConfig());
}

export function createMediaJobId() {
  return `media_job_${Date.now()}_${crypto.randomUUID()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

async function ensureBucket(config, bucket = DEFAULT_BUCKET) {
  const check = await fetch(`${config.url}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
    headers: headers(config),
  });
  if (check.ok) return;

  const create = await fetch(`${config.url}/storage/v1/bucket`, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({ id: bucket, name: bucket, public: false }),
  });

  if (!create.ok && create.status !== 409) {
    const text = await create.text().catch(() => "");
    throw new Error(`Could not create queue bucket: ${text || create.statusText}`);
  }
}

function jobPath(jobId) {
  return `jobs/${jobId}.json`;
}

async function putObject(path, value) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase service env is not configured for durable media queue.");
  await ensureBucket(config);
  const body = JSON.stringify(value, null, 2);
  const res = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(DEFAULT_BUCKET)}/${path}`, {
    method: "POST",
    headers: { ...headers(config), "x-upsert": "true" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Queue object write failed: ${text || res.statusText}`);
  }
  return value;
}

async function getObject(path) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase service env is not configured for durable media queue.");
  const res = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(DEFAULT_BUCKET)}/${path}`, {
    headers: headers(config),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Queue object read failed: ${text || res.statusText}`);
  }
  return await res.json();
}

async function listObjects(prefix = "jobs", limit = MAX_LIST_LIMIT) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase service env is not configured for durable media queue.");
  await ensureBucket(config);
  const res = await fetch(`${config.url}/storage/v1/object/list/${encodeURIComponent(DEFAULT_BUCKET)}`, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({ prefix, limit: Math.min(Number(limit) || MAX_LIST_LIMIT, MAX_LIST_LIMIT), sortBy: { column: "created_at", order: "desc" } }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Queue list failed: ${text || res.statusText}`);
  }
  return await res.json();
}

export async function enqueueMediaJob({ type, asset = {}, payload = {}, priority = 5, source = "upload" }) {
  const id = createMediaJobId();
  const job = {
    id,
    type: type || "media_analysis",
    source,
    status: "queued",
    priority,
    attempts: 0,
    maxAttempts: Number(process.env.STREAMS_MEDIA_JOB_MAX_ATTEMPTS || 3),
    asset,
    payload,
    result: null,
    error: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    startedAt: null,
    completedAt: null,
  };
  await putObject(jobPath(id), job);
  return job;
}

export async function readMediaJob(jobId) {
  if (!jobId) return null;
  return await getObject(jobPath(jobId));
}

export async function writeMediaJob(job) {
  if (!job?.id) throw new Error("job.id is required");
  return await putObject(jobPath(job.id), { ...job, updatedAt: nowIso() });
}

export async function listMediaJobs({ status, limit = 50 } = {}) {
  const entries = await listObjects("jobs", limit);
  const jobs = [];
  for (const entry of entries || []) {
    if (!entry?.name?.endsWith(".json")) continue;
    const job = await getObject(`jobs/${entry.name}`).catch(() => null);
    if (!job) continue;
    if (status && job.status !== status) continue;
    jobs.push(job);
  }
  return jobs.sort((a, b) => {
    if ((a.priority || 5) !== (b.priority || 5)) return (a.priority || 5) - (b.priority || 5);
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  });
}

export async function claimNextMediaJob({ workerId = "streams-worker" } = {}) {
  const queued = await listMediaJobs({ status: "queued", limit: 100 });
  const job = queued[0];
  if (!job) return null;
  const claimed = {
    ...job,
    status: "processing",
    workerId,
    attempts: Number(job.attempts || 0) + 1,
    startedAt: job.startedAt || nowIso(),
    updatedAt: nowIso(),
  };
  await writeMediaJob(claimed);
  return claimed;
}

export async function completeMediaJob(job, result = {}) {
  return await writeMediaJob({
    ...job,
    status: "completed",
    result,
    error: "",
    completedAt: nowIso(),
  });
}

export async function failMediaJob(job, error) {
  const attempts = Number(job.attempts || 0);
  const maxAttempts = Number(job.maxAttempts || 3);
  const terminal = attempts >= maxAttempts;
  return await writeMediaJob({
    ...job,
    status: terminal ? "failed" : "queued",
    error: error?.message || String(error || "Worker failed"),
    updatedAt: nowIso(),
  });
}
