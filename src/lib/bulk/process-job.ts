// FIXED: export the named symbol expected by create-job route
export async function processBulkCreativeJob(job: any, manifest: any) {
  const tasks = job?.payload?.tasks ?? job?.data?.tasks ?? [];
  for (const task of tasks) {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: task.prompt,
        size: task.size,
        provider: task.provider
      })
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
        createdAt: Date.now()
      });
    } else {
      manifest.errors = manifest.errors || [];
      manifest.errors.push({
        taskId: task.id,
        error: JSON.stringify(data)
      });
    }
  }

  if (!manifest.outputs.length) {
    job.status = "failed";
  } else {
    job.status = "completed";
  }

  return { job, manifest };
}

// keep compatibility if any code still imports the older helper names
export const processTask = processBulkCreativeJob;
export function finalizeJob(job: any, manifest: any) {
  if (!manifest.outputs?.length) {
    job.status = "failed";
  } else {
    job.status = "completed";
  }
  return job;
}
