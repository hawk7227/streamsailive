import { createAdminClient } from "@/lib/supabase/admin";
import { generateContent } from "@/lib/ai";
import { uploadImageToSupabase } from "@/lib/supabase/storage";
import { appendManifestError, appendManifestOutput } from "./manifest-builder";
import type { BulkJobPayload, BulkOutput, BulkProvider, BulkTask } from "./job-schema";
import { getJobStatus, markJobRunning, completeJob, failJob, recordStep } from "@/lib/jobs/queue";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBulkJobPayload(value: unknown): value is BulkJobPayload {
  if (!isRecord(value)) return false;
  return typeof value.prompt === "string" && Array.isArray(value.tasks) && isRecord(value.manifest) && isRecord(value.options);
}

async function updateJobResult(jobId: string, result: Record<string, unknown>) {
  const admin = createAdminClient();
  const { error } = await admin.from("pipeline_jobs").update({ result, updated_at: new Date().toISOString() }).eq("id", jobId);
  if (error) throw new Error(`Failed to update bulk job result: ${error.message}`);
}

async function generateTaskImage(task: BulkTask, workspaceId: string, jobId: string): Promise<{ url: string; provider: BulkProvider; externalId?: string | null; costEstimate?: number | null; }> {
  const attempts: Array<{ provider: BulkProvider; mode: "enforced" | "provider" }> = [];

  if (process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_IMAGES) {
    attempts.push({ provider: "openai", mode: "provider" });
  }
  if (process.env.FAL_API_KEY && task.provider !== "fal") {
    attempts.push({ provider: "fal", mode: "provider" });
  }
  if (task.provider === "fal" && process.env.FAL_API_KEY) {
    attempts.unshift({ provider: "fal", mode: "provider" });
  }
  if (attempts.length === 0) {
    throw new Error("No image provider credentials are configured for bulk generation. Set OPENAI_API_KEY or FAL_API_KEY.");
  }

  const failures: string[] = [];
  for (const attempt of attempts) {
    try {
      const result = await generateContent("image", {
        prompt: task.finalPrompt,
        aspectRatio: task.aspectRatio,
        quality: "high",
        style: task.plan.tone,
        mode: "pro",
      }, attempt.provider);

      if (result.status !== "completed" || !result.outputUrl) {
        throw new Error(result.status === "pending"
          ? `${attempt.provider} returned pending without a callback-capable bulk worker`
          : `${attempt.provider} did not return an output URL`);
      }

      const persistedUrl = await uploadImageToSupabase(result.outputUrl, workspaceId, `bulk-${jobId}-${task.id}`);
      return {
        url: persistedUrl,
        provider: attempt.provider,
        externalId: result.externalId ?? null,
        costEstimate: result.costEstimate ?? null,
      };
    } catch (error) {
      failures.push(`${attempt.provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(failures.join(" | "));
}

export async function processBulkCreativeJob(jobId: string): Promise<void> {
  const job = await getJobStatus(jobId);
  if (!job) throw new Error("Bulk job not found");
  if (!isBulkJobPayload(job.payload)) throw new Error("Bulk job payload is invalid");

  const payload = job.payload;
  if (!payload.tasks.length) throw new Error("Bulk job has no tasks");

  await markJobRunning(jobId);
  let workingPayload: BulkJobPayload = payload;
  const admin = createAdminClient();

  try {
    for (const task of payload.tasks) {
      await recordStep(jobId, `task:${task.id}`, "running", { input: { taskId: task.id, kind: task.kind, aspectRatio: task.aspectRatio, templateId: task.plan.templateId } });
      try {
        const generated = await generateTaskImage(task, job.workspace_id, jobId);

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
          output_url: generated.url,
          external_id: generated.externalId ?? null,
          provider: generated.provider,
          mode: "bulk_creative",
          cost_estimate: generated.costEstimate ?? null,
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
          url: generationRow.output_url ?? generated.url,
          provider: generated.provider,
          generationId: generationRow.id,
          storagePath: null,
          bucket: "generations",
          mimeType: "image/png",
          createdAt: new Date().toISOString(),
          plan: task.plan,
        };

        workingPayload = { ...workingPayload, manifest: appendManifestOutput(workingPayload, output) };
        await updateJobResult(jobId, workingPayload.manifest as unknown as Record<string, unknown>);
        await recordStep(jobId, `task:${task.id}`, "completed", { output: { generationId: generationRow.id, outputUrl: output.url, provider: generated.provider } });
      } catch (taskError) {
        const message = taskError instanceof Error ? taskError.message : String(taskError);
        workingPayload = { ...workingPayload, manifest: appendManifestError(workingPayload, task.id, message) };
        await updateJobResult(jobId, workingPayload.manifest as unknown as Record<string, unknown>);
        await recordStep(jobId, `task:${task.id}`, "failed", { error: message });
      }
    }

    if (workingPayload.manifest.completed === 0) {
      const firstError = workingPayload.manifest.errors[0]?.message ?? "Bulk generation produced zero outputs";
      await failJob(jobId, firstError);
      return;
    }

    await completeJob(jobId, workingPayload.manifest as unknown as Record<string, unknown>);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJob(jobId, message);
    throw error;
  }
}
