// FIXED: normalize provider response + fail closed
export async function processTask(task, manifest) {
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

export function finalizeJob(job, manifest) {
  if (!manifest.outputs.length) {
    job.status = "failed";
  } else {
    job.status = "completed";
  }
}
