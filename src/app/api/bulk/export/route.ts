import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";

import { createClient } from "@/lib/supabase/server";
import { getJob } from "@/lib/jobs/queue";
import type { BulkManifest, BulkJobPayload } from "@/lib/bulk/job-schema";

type BulkManifestOutput = BulkManifest["outputs"][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBulkOutput(value: unknown): value is BulkManifestOutput {
  if (!isRecord(value)) return false;
  return (
    typeof value.taskId === "string" &&
    typeof value.url === "string" &&
    typeof value.provider === "string" &&
    typeof value.createdAt === "number"
  );
}

function isBulkManifest(value: unknown): value is BulkManifest {
  if (!isRecord(value)) return false;
  return (
    typeof value.jobId === "string" &&
    typeof value.prompt === "string" &&
    typeof value.sourceType === "string" &&
    typeof value.total === "number" &&
    typeof value.completed === "number" &&
    Array.isArray(value.outputs) &&
    value.outputs.every(isBulkOutput)
  );
}

function isBulkJobPayload(value: unknown): value is BulkJobPayload {
  if (!isRecord(value)) return false;
  return (
    typeof value.prompt === "string" &&
    typeof value.sourceType === "string" &&
    Array.isArray(value.tasks) &&
    isBulkManifest(value.manifest)
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { jobId?: string };
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isBulkJobPayload(job.payload)) {
    return NextResponse.json(
      { error: "Invalid bulk job payload shape" },
      { status: 500 },
    );
  }

  const payload = job.payload;
  const manifest = isBulkManifest(job.result) ? job.result : payload.manifest;

  if (!manifest.outputs.length) {
    return NextResponse.json(
      { error: "No outputs available to export" },
      { status: 400 },
    );
  }

  const zip = new AdmZip();

  for (let i = 0; i < manifest.outputs.length; i += 1) {
    const output = manifest.outputs[i];
    const response = await fetch(output.url);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Failed to fetch output ${i + 1}`,
          status: response.status,
        },
        { status: 502 },
      );
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    zip.addFile(`bulk-output-${i + 1}.png`, bytes);
  }

  const archive = zip.toBuffer();

  return new NextResponse(archive, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="bulk-${jobId}.zip"`,
      "Content-Length": String(archive.length),
      "Cache-Control": "no-store",
    },
  });
}
