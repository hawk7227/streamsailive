import AdmZip from "adm-zip";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getJobStatus } from "@/lib/jobs/queue";
import type { BulkManifest, BulkJobPayload } from "@/lib/bulk/job-schema";

function isBulkManifest(value: unknown): value is BulkManifest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BulkManifest>;
  return (
    typeof candidate.jobId === "string" &&
    typeof candidate.prompt === "string" &&
    (candidate.sourceType === "prompt" || candidate.sourceType === "document") &&
    typeof candidate.total === "number" &&
    typeof candidate.completed === "number" &&
    typeof candidate.failed === "number" &&
    Array.isArray(candidate.outputs) &&
    Array.isArray(candidate.errors)
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = job.payload as BulkJobPayload;
  const manifest = isBulkManifest(job.result) ? job.result : payload.manifest;

  if (!manifest.outputs.length) {
    return NextResponse.json({ error: "No outputs available to export" }, { status: 400 });
  }

  const zip = new AdmZip();
  for (let i = 0; i < manifest.outputs.length; i += 1) {
    const output = manifest.outputs[i];
    const response = await fetch(output.url);
    if (!response.ok) throw new Error(`Failed to download output ${i + 1}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    zip.addFile(`${String(i + 1).padStart(2, "0")}-${output.plan.kind}-${output.plan.layoutFamily}.png`, buffer);
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
