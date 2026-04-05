import AdmZip from "adm-zip";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getJobStatus } from "@/lib/jobs/queue";
import type { BulkJobPayload, BulkManifest, BulkOutput } from "@/lib/bulk/job-schema";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBulkOutput(value: unknown): value is BulkOutput {
  if (!isRecord(value)) return false;
  return (
    typeof value.taskId === "string" &&
    typeof value.url === "string" &&
    typeof value.provider === "string" &&
    typeof value.createdAt === "string" &&
    isRecord(value.plan) &&
    typeof value.plan.kind === "string" &&
    typeof value.plan.layoutFamily === "string"
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
    Array.isArray(value.outputs) &&
    value.outputs.every(isBulkOutput) &&
    Array.isArray(value.errors)
  );
}

function isBulkJobPayload(value: unknown): value is BulkJobPayload {
  if (!isRecord(value)) return false;
  return (
    typeof value.prompt === "string" &&
    (value.sourceType === "prompt" || value.sourceType === "document") &&
    Array.isArray(value.tasks) &&
    isBulkManifest(value.manifest) &&
    isRecord(value.options) &&
    typeof value.options.requestedCount === "number" &&
    typeof value.options.requestedSize === "string" &&
    Array.isArray(value.options.selectedKinds) &&
    Array.isArray(value.options.selectedAspects)
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { jobId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const job = await getJobStatus(body.jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = isBulkJobPayload(job.payload) ? job.payload : null;
  const manifest = isBulkManifest(job.result)
    ? job.result
    : payload?.manifest ?? null;

  if (!manifest) {
    return NextResponse.json({ error: "Bulk manifest unavailable for export" }, { status: 400 });
  }

  if (manifest.outputs.length === 0) {
    return NextResponse.json({ error: "No outputs available to export" }, { status: 400 });
  }

  const zip = new AdmZip();

  for (let i = 0; i < manifest.outputs.length; i += 1) {
    const output = manifest.outputs[i];
    const response = await fetch(output.url);

    if (!response.ok) {
      throw new Error(`Failed to download output ${i + 1}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    zip.addFile(
      `${String(i + 1).padStart(2, "0")}-${output.plan.kind}-${output.plan.layoutFamily}.png`,
      buffer,
    );
  }

  const archive = zip.toBuffer();

  return new Response(archive, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="bulk-${body.jobId}.zip"`,
      "Content-Length": String(archive.length),
    },
  });
}
