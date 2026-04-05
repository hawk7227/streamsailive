import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getJobStatus } from "@/lib/jobs/queue";
import type { BulkManifest, BulkJobPayload } from "@/lib/bulk/job-schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await getJobStatus(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = job.payload as unknown as BulkJobPayload;
  const manifest = (job.result as BulkManifest | null) ?? payload.manifest;

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
