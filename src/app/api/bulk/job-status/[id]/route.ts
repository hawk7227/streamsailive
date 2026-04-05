import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getJobStatus } from "@/lib/jobs/queue";
import type { BulkJobPayload, BulkManifest, BulkOutput, BulkTask } from "@/lib/bulk/job-schema";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBulkTask(value: unknown): value is BulkTask {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.kind === "string" &&
    typeof value.provider === "string" &&
    typeof value.size === "string" &&
    typeof value.aspectRatio === "string" &&
    typeof value.basePrompt === "string" &&
    typeof value.finalPrompt === "string" &&
    isRecord(value.plan)
  );
}

function isBulkOutput(value: unknown): value is BulkOutput {
  if (!isRecord(value)) return false;
  return (
    typeof value.taskId === "string" &&
    typeof value.url === "string" &&
    typeof value.provider === "string" &&
    typeof value.createdAt === "string" &&
    isRecord(value.plan)
  );
}

function isBulkManifest(value: unknown): value is BulkManifest {
  if (!isRecord(value)) return false;
  return (
    typeof value.jobId === "string" &&
    typeof value.prompt === "string" &&
    (value.sourceType === "prompt" || value.sourceType === "document") &&
    typeof value.total === "number" &&
    typeof value.completed === "number" &&
    typeof value.failed === "number" &&
    Array.isArray(value.outputs) && value.outputs.every(isBulkOutput) &&
    Array.isArray(value.errors)
  );
}

function isBulkJobPayload(value: unknown): value is BulkJobPayload {
  if (!isRecord(value)) return false;
  if (typeof value.prompt !== "string") return false;
  if (value.sourceType !== "prompt" && value.sourceType !== "document") return false;
  if (!Array.isArray(value.tasks) || !value.tasks.every(isBulkTask)) return false;
  if (!isBulkManifest(value.manifest)) return false;
  if (!isRecord(value.options)) return false;
  return (
    typeof value.options.requestedCount === "number" &&
    typeof value.options.requestedSize === "string" &&
    Array.isArray(value.options.selectedKinds) &&
    Array.isArray(value.options.selectedAspects)
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const job = await getJobStatus(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isBulkJobPayload(job.payload)) {
    return NextResponse.json({ error: "Invalid bulk job payload" }, { status: 500 });
  }

  const payload = job.payload;
  const manifest = isBulkManifest(job.result) ? job.result : payload.manifest;

  return NextResponse.json({
    data: {
      id: job.id,
      status: job.status,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      options: payload.options,
      tasks: payload.tasks,
      manifest,
      error: job.error ?? null,
    },
  });
}
