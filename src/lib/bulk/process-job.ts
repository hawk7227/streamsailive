import { createAdminClient } from "@/lib/supabase/admin";
import { generateContent } from "@/lib/ai";
import { uploadImageToSupabase } from "@/lib/supabase/storage";
import { appendManifestError, appendManifestOutput } from "./manifest-builder";
import type { BulkJobPayload, BulkOutput } from "./job-schema";
import { getJobStatus, markJobRunning, completeJob, failJob, recordStep } from "@/lib/jobs/queue";

async function updateJobResult(jobId: string, result: Record<string, unknown>) {
  const admin = createAdminClient();
  const { error } = await admin.from("pipeline_jobs").update({ result, updated_at: new Date().toISOString() }).eq("id", jobId);
  if (error) throw new Error(`Failed to update bulk job result: ${error.message}`);
}

export async function processBulkCreativeJob(jobId: string): Promise<void> {
  const job = await getJobStatus(jobId);
  if (!job) throw new Error("Bulk job not found");

  const payload = job.payload as unknown as BulkJobPayload;
  if (!payload?.tasks?.length) throw new Error("Bulk job has no tasks");

  await markJobRunning(jobId);
  let workingPayload: BulkJobPayload = payload;
  const admin = createAdminClient();

  try {
    for (const task of payload.tasks) {
      await recordStep(jobId, `task:${task.id}`, "running", { input: { taskId: task.id, kind: task.kind, aspectRatio: task.aspectRatio, templateId: task.plan.templateId } });
      try {
        const result = await generateContent("image", {
          prompt: task.finalPrompt,
          aspectRatio: task.aspectRatio,
          quality: "high",
          style: task.plan.tone,
          mode: "pro",
        }, task.provider);

        if (result.status !== "completed" || !result.outputUrl) {
          throw new Error(result.status === "pending" ? "Provider returned pending without a callback workflow for bulk processing" : "Provider did not return an output URL");
        }

        const persistedUrl = await uploadImageToSupabase(result.outputUrl, job.workspace_id, `bulk-${jobId}-${task.id}`);

        const generationInsert = {
          user_id: job.user_id,
          workspace_id: job.workspace_id,
          type: "image",
          prompt: task.finalPrompt,
          title: `${task.kind.replaceAll("_", " ")} • ${task.plan.layoutFamily}`,
          status: "completed",
          aspect_ratio: task.aspectRatio,
          quality: "high",
          style: task.plan.tone,
          output_url: persistedUrl,
          external_id: result.externalId ?? null,
          provider: task.provider,
          mode: "bulk_creative",
          cost_estimate: result.costEstimate ?? null,
          metadata: {
            bulkJobId: jobId,
            taskId: task.id,
            creativePlan: task.plan,
            sourcePrompt: payload.prompt,
          },
        };

        const { data: generationRow, error: generationError } = await admin
          .from("generations")
          .insert(generationInsert)
          .select("id, output_url")
          .single();

        if (generationError) throw new Error(`Generation insert failed: ${generationError.message}`);

        const output: BulkOutput = {
          taskId: task.id,
          url: generationRow.output_url ?? persistedUrl,
          provider: task.provider,
          generationId: generationRow.id,
          storagePath: null,
          bucket: "generations",
          mimeType: "image/png",
          createdAt: new Date().toISOString(),
          plan: task.plan,
        };

        workingPayload = { ...workingPayload, manifest: appendManifestOutput(workingPayload, output) };
        await updateJobResult(jobId, workingPayload.manifest as unknown as Record<string, unknown>);
        await recordStep(jobId, `task:${task.id}`, "completed", { output: { generationId: generationRow.id, outputUrl: output.url } });
      } catch (taskError) {
        const message = taskError instanceof Error ? taskError.message : String(taskError);
        workingPayload = { ...workingPayload, manifest: appendManifestError(workingPayload, task.id, message) };
        await updateJobResult(jobId, workingPayload.manifest as unknown as Record<string, unknown>);
        await recordStep(jobId, `task:${task.id}`, "failed", { error: message });
      }
    }

    await completeJob(jobId, workingPayload.manifest as unknown as Record<string, unknown>);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJob(jobId, message);
    throw error;
  }
}
