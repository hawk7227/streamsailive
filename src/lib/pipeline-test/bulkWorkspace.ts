import type { BulkAsset, BulkJobInput } from "./bulkTypes";

export async function runBulkWorkspace(job: BulkJobInput): Promise<BulkAsset[]> {
  const results: BulkAsset[] = [];
  for (let i = 0; i < job.count; i += 1) {
    results.push({
      id: `${job.id}-asset-${i + 1}`,
      jobId: job.id,
      type: "image",
      title: `${job.label} ${i + 1}`,
      url: `https://placehold.co/${job.width ?? 512}x${job.height ?? 512}?text=${encodeURIComponent(job.label + " " + (i + 1))}`,
      status: "ready",
      prompt: job.prompt,
      width: job.width ?? 512,
      height: job.height ?? 512,
    });
  }
  return results;
}
