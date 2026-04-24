/**
 * POST /api/streams/bulk/status
 *
 * Polls all items in a bulk_jobs row.
 * Checks fal queue status for each pending item.
 * Downloads and uploads completed videos to Supabase storage.
 * Returns overall progress + per-item statuses.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { falPoll, extractVideoUrl, extractAudioUrl } from "@/lib/streams/fal-client";

export const maxDuration = 60;

const STORAGE_BUCKET = "generations";
const DL_TIMEOUT     = 45_000;

async function downloadAndStore(url: string, workspaceId: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(DL_TIMEOUT) });
    if (!res.ok) return null;
    const ct  = res.headers.get("content-type") ?? "video/mp4";
    const ext = ct.includes("webm") ? "webm" : ct.includes("audio") ? "mp3" : "mp4";
    const buf = await res.arrayBuffer();
    const admin = createAdminClient();
    const path  = `${workspaceId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await admin.storage.from(STORAGE_BUCKET).upload(path, buf, { contentType: ct, upsert: true });
    if (error) return null;
    const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch { return null; }
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = raw as { bulkJobId?: string };
  if (!body.bulkJobId) return NextResponse.json({ error: "bulkJobId required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = sel.current.workspace.id;
  } catch {
    return NextResponse.json({ error: "Could not resolve workspace" }, { status: 500 });
  }

  // Verify ownership
  const { data: job } = await admin.from("bulk_jobs").select("*").eq("id", body.bulkJobId).eq("workspace_id", workspaceId).single();
  if (!job) return NextResponse.json({ error: "Bulk job not found" }, { status: 404 });

  // Load items still pending
  const { data: items } = await admin.from("bulk_job_items").select("*").eq("bulk_job_id", body.bulkJobId).order("item_index");
  if (!items) return NextResponse.json({ error: "No items found" }, { status: 404 });

  const pending = items.filter((it:{ id:string; status:string; fal_request_id:string|null; output_url?:string }) => it.status === "running" && it.fal_request_id);
  let justCompleted = 0;
  let justFailed    = 0;

  // Poll each pending item (cap at 6 polls per call to stay under maxDuration)
  for (const item of pending.slice(0, 6)) {
    const poll = await falPoll(item.fal_request_id);

    if (poll.status === "processing") continue;

    if (poll.status === "failed") {
      await admin.from("bulk_job_items").update({ status: "failed", error: "fal reported FAILED" }).eq("id", item.id);
      justFailed++;
      continue;
    }

    // Completed — extract URL and upload to storage
    const providerUrl = extractVideoUrl(poll.raw) ?? extractAudioUrl(poll.raw);
    if (!providerUrl) {
      await admin.from("bulk_job_items").update({ status: "failed", error: "no output URL" }).eq("id", item.id);
      justFailed++;
      continue;
    }

    const storageUrl = await downloadAndStore(providerUrl, workspaceId);
    if (!storageUrl) {
      await admin.from("bulk_job_items").update({ status: "failed", error: "storage upload failed" }).eq("id", item.id);
      justFailed++;
      continue;
    }

    await admin.from("bulk_job_items").update({ status: "completed", output_url: storageUrl }).eq("id", item.id);
    justCompleted++;
  }

  // Refresh counts
  const { data: refreshed } = await admin.from("bulk_job_items").select("status, output_url").eq("bulk_job_id", body.bulkJobId);
  type BulkItem = { status: string; output_url: string | null };
  const completed = (refreshed ?? []).filter((it: BulkItem) => it.status === "completed").length;
  const failed    = (refreshed ?? []).filter((it: BulkItem) => it.status === "failed").length;
  const total     = (refreshed ?? []).length;
  const isFinished = completed + failed === total;

  if (isFinished) {
    await admin.from("bulk_jobs").update({
      status:           failed === total ? "failed" : failed > 0 ? "partial" : "completed",
      completed_count:  completed,
      failed_count:     failed,
      result_urls:      (refreshed ?? []).filter((it: BulkItem) => it.output_url).map((it: BulkItem) => it.output_url),
    }).eq("id", body.bulkJobId);
  } else {
    await admin.from("bulk_jobs").update({ completed_count: completed, failed_count: failed }).eq("id", body.bulkJobId);
  }

  return NextResponse.json({
    bulkJobId:   body.bulkJobId,
    status:      isFinished ? (failed === total ? "failed" : failed > 0 ? "partial" : "completed") : "running",
    total,
    completed,
    failed,
    pending:     total - completed - failed,
    outputUrls:  (refreshed ?? []).filter((it: BulkItem) => it.output_url).map((it: BulkItem) => it.output_url),
  });
}
