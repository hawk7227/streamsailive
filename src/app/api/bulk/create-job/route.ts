import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { enqueueJob } from "@/lib/jobs/queue";
import { buildBulkPayload } from "@/lib/bulk/generation-router";
import { processBulkCreativeJob } from "@/lib/bulk/process-job";

export const maxDuration = 120;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.prompt?.trim()) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  const admin = createAdminClient();
  const selection = await getCurrentWorkspaceSelection(admin, user);
  const workspaceId = selection.current.workspace.id;
  const payload = buildBulkPayload(body.prompt);

  const job = await enqueueJob("bulk_creative", payload as unknown as Record<string, unknown>, {
    workspaceId,
    userId: user.id,
    priority: 3,
    maxRetries: 1,
  });

  void processBulkCreativeJob(job.id).catch((error) => {
    console.error("[bulk/create-job] background processing failed", error);
  });

  return NextResponse.json({ data: { jobId: job.id, status: job.status, total: payload.tasks.length } }, { status: 202 });
}
