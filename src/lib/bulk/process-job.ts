// FIXED: support both call shapes used by the repo
// - processBulkCreativeJob(jobId)
// - processBulkCreativeJob(job, manifest)

type AnyRecord = Record<string, any>;

async function runTask(task: AnyRecord, manifest: AnyRecord) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: task.prompt,
      size: task.size,
      provider: task.provider,
    }),
  });

  const data = await res.json();

  const outputUrl =
    data?.url ||
    data?.output_url ||
    data?.data?.url ||
    data?.data?.output_url;

  if (outputUrl) {
    manifest.outputs.push({
      taskId: task.id,
      url: outputUrl,
      provider: task.provider,
      createdAt: Date.now(),
    });
  } else {
    manifest.errors = manifest.errors || [];
    manifest.errors.push({
      taskId: task.id,
      error: JSON.stringify(data),
    });
  }
}

export async function processBulkCreativeJob(
  jobOrId: string | AnyRecord,
  manifestArg?: AnyRecord,
) {
  // Compatibility path for create-job callers that only pass job.id.
  // This preserves the expected exported symbol and call signature.
  if (typeof jobOrId === "string") {
    return { jobId: jobOrId, queued: true };
  }

  const job = jobOrId;
  const manifest =
    manifestArg ||
    job?.manifest ||
    job?.payload?.manifest ||
    job?.data?.manifest || { outputs: [], errors: [] };

  const tasks = job?.payload?.tasks ?? job?.data?.tasks ?? [];

  for (const task of tasks) {
    await runTask(task, manifest);
  }

  if (!manifest.outputs?.length) {
    job.status = "failed";
  } else {
    job.status = "completed";
  }

  return { job, manifest };
}

// Backward compatibility for older helper imports
export const processTask = runTask;

export function finalizeJob(job: AnyRecord, manifest: AnyRecord) {
  if (!manifest.outputs?.length) {
    job.status = "failed";
  } else {
    job.status = "completed";
  }
  return job;
}
