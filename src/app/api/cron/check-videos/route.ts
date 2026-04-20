import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadImageToSupabase } from "@/lib/supabase/storage";
import { CRON_SECRET, KLING_API_KEY, KLING_ASSESS_API_KEY, RUNWAY_API_KEY } from "@/lib/env";
import { falQueuePoll } from "@/lib/ai/providers/fal";
import { stitchVideoScenes } from "@/lib/video/scene-stitcher";
import type { SceneSiblingRow } from "@/lib/video/types";

// GET /api/cron/check-videos
// Backup poller — Vercel Cron every 2 minutes.
// Primary path: POST /api/webhook/video-complete (Kling/Runway callBackUrl)
// This catches webhook misses.

const CHUNK_SIZE = 10;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function uploadVideoToSupabase(remoteUrl: string, workspaceId: string): Promise<string> {
  const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "video/mp4";
  const ext = contentType.includes("webm") ? "webm" : "mp4";
  const storagePath = `${workspaceId}/${crypto.randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from("generations")
    .upload(storagePath, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = admin.storage.from("generations").getPublicUrl(storagePath);
  return data.publicUrl;
}

type Gen = {
  id: string;
  workspace_id: string;
  external_id: string;
  provider: string | null;
  type: string;
  parent_id: string | null;
};

type PollResultWithParent = PollResult & { parentId?: string; workspaceId?: string };
type PollResult = { id: string; status: "completed"|"failed"|"processing"|"skipped"; outputUrl?: string };

function makeKlingJWT(): string {
  // Kling requires a signed JWT — raw key is NOT a valid bearer token
  const ak = KLING_ASSESS_API_KEY;  // access key (iss)
  const sk = KLING_API_KEY;          // secret key (sign)
  if (!ak || !sk) throw new Error("KLING keys not set");
  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now     = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: ak, exp: now + 1800, nbf: now - 5 })).toString("base64url");
  const data    = `${header}.${payload}`;
  // Node built-in HMAC-SHA256
  const sig = createHmac("sha256", sk).update(data).digest("base64url");
  return `${data}.${sig}`;
}

async function pollKling(gen: Gen): Promise<PollResult> {
  // Route to correct endpoint per generation type
  let ep: string;
  if (gen.type === "image") {
    ep = `https://api-singapore.klingai.com/v1/images/generations/${gen.external_id}`;
  } else if (gen.type === "i2v") {
    ep = `https://api-singapore.klingai.com/v1/videos/image2video/${gen.external_id}`;
  } else {
    ep = `https://api-singapore.klingai.com/v1/videos/text2video/${gen.external_id}`;
  }
  let token: string;
  try { token = makeKlingJWT(); } catch { return { id: gen.id, status: "skipped" }; }
  const res = await fetch(ep, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return { id: gen.id, status: "skipped" };
  const d = await res.json() as { data: { task_status: string; task_result?: { videos?: {url:string}[]; images?: {url:string}[] } } };
  const t = d.data;
  if (t.task_status === "failed") return { id: gen.id, status: "failed" };
  if (t.task_status !== "succeed") return { id: gen.id, status: "processing" };
  const cdnUrl = t.task_result?.videos?.[0]?.url ?? t.task_result?.images?.[0]?.url;
  if (!cdnUrl) return { id: gen.id, status: "failed" };
  const outputUrl = gen.type === "video" || gen.type === "i2v"
    ? await uploadVideoToSupabase(cdnUrl, gen.workspace_id)
    : await uploadImageToSupabase(cdnUrl, gen.workspace_id);
  return { id: gen.id, status: "completed", outputUrl };
}

async function pollRunway(gen: Gen): Promise<PollResult> {
  const res = await fetch(`https://api.runwayml.com/v1/tasks/${gen.external_id}`, {
    headers: { Authorization: `Bearer ${RUNWAY_API_KEY}`, "X-Runway-Version": "2024-11-06" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return { id: gen.id, status: "skipped" };
  const d = await res.json() as { status: string; output?: string[] };
  if (d.status === "FAILED") return { id: gen.id, status: "failed" };
  if (d.status !== "SUCCEEDED") return { id: gen.id, status: "processing" };
  const cdnUrl = d.output?.[0];
  if (!cdnUrl) return { id: gen.id, status: "failed" };
  const outputUrl = await uploadVideoToSupabase(cdnUrl, gen.workspace_id);
  return { id: gen.id, status: "completed", outputUrl };
}

async function pollFal(gen: Gen): Promise<PollResult> {
  // external_id format: "fal_queue:{responseUrl}"
  const prefix = "fal_queue:";
  if (!gen.external_id.startsWith(prefix)) {
    return { id: gen.id, status: "skipped" };
  }
  const responseUrl = gen.external_id.slice(prefix.length);
  const result = await falQueuePoll(responseUrl);

  if (result.status === "processing") return { id: gen.id, status: "processing" };
  if (result.status === "failed") return { id: gen.id, status: "failed" };

  // Completed — upload video to Supabase storage
  const outputUrl = await uploadVideoToSupabase(result.videoUrl, gen.workspace_id);
  return { id: gen.id, status: "completed", outputUrl };
}

/**
 * resolveParentJobs — called after scene clips complete.
 * For each unique parent_id in the completed set:
 *   1. Query all sibling scene rows
 *   2. If all are completed with output_url: stitch → upload → update parent
 *   3. If any are still pending/processing: wait for next cron run
 */
async function resolveParentJobs(
  completed: PollResultWithParent[],
): Promise<void> {
  const admin = createAdminClient();

  // Collect unique parent IDs from this batch
  const parentIds = new Set<string>();
  const workspaceByParent = new Map<string, string>();

  for (const r of completed) {
    if (r.parentId && r.workspaceId) {
      parentIds.add(r.parentId);
      workspaceByParent.set(r.parentId, r.workspaceId);
    }
  }

  if (parentIds.size === 0) return;

  for (const parentId of parentIds) {
    const workspaceId = workspaceByParent.get(parentId);
    if (!workspaceId) continue;

    const { data: siblings, error } = await admin
      .from("generations")
      .select("id, status, output_url, scene_index")
      .eq("parent_id", parentId)
      .order("scene_index", { ascending: true });

    if (error || !siblings?.length) {
      console.error(JSON.stringify({
        level: "error",
        event: "SIBLING_QUERY_FAILED",
        parentId,
        reason: error?.message ?? "no siblings found",
      }));
      continue;
    }

    // Check if all scenes are complete with output URLs
    const rows = siblings as SceneSiblingRow[];
    const allDone = rows.every(
      (s) => s.status === "completed" && s.output_url,
    );

    if (!allDone) continue; // More scenes still pending — wait

    // All scenes complete — collect clip URLs in scene order
    const clipUrls = rows
      .sort((a, b) => (a.scene_index ?? 0) - (b.scene_index ?? 0))
      .map((s) => s.output_url)
      .filter((url): url is string => !!url);

    if (clipUrls.length === 0) continue;

    // Stitch
    const stitchResult = await stitchVideoScenes(clipUrls);

    if (stitchResult.status === "failed") {
      console.error(JSON.stringify({
        level: "error",
        event: "STITCH_FAILED",
        parentId,
        reason: stitchResult.reason,
      }));
      await admin
        .from("generations")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", parentId);
      continue;
    }

    // Upload stitched video to Supabase storage
    let storedUrl: string;
    try {
      storedUrl = await uploadVideoToSupabase(stitchResult.outputUrl, workspaceId);
    } catch (uploadErr) {
      console.error(JSON.stringify({
        level: "error",
        event: "STITCH_UPLOAD_FAILED",
        parentId,
        reason: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
      }));
      continue;
    }

    // Update parent row to completed
    await admin
      .from("generations")
      .update({
        status: "completed",
        output_url: storedUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parentId);

    console.log(JSON.stringify({
      level: "info",
      event: "LONG_VIDEO_STITCHED",
      parentId,
      sceneCount: clipUrls.length,
      outputUrl: storedUrl,
    }));
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: pending, error } = await admin
    .from("generations")
    .select("id, workspace_id, external_id, provider, type, parent_id")
    .in("status", ["pending", "processing"])
    .not("external_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pending?.length) return NextResponse.json({ checked: 0, updated: 0 });

  // Exclude long_video_parent rows — they are resolved by resolveParentJobs,
  // not polled directly. Scene clip rows (fal_queue: prefix) ARE polled.
  const pollable = (pending as Gen[]).filter(
    (g) => !g.external_id.startsWith("long_video_parent:"),
  );

  const results: PollResultWithParent[] = [];
  for (const batch of chunk(pollable, CHUNK_SIZE)) {
    const batchResults = await Promise.all(
      batch.map(async (gen) => {
        let poll: (gen: Gen) => Promise<PollResult>;
        if (gen.external_id?.startsWith("fal_queue:")) {
          poll = pollFal;
        } else if ((gen.provider ?? "kling") === "runway") {
          poll = pollRunway;
        } else {
          poll = pollKling;
        }
        const r = await poll(gen).catch(
          () => ({ id: gen.id, status: "skipped" as const }),
        );
        // Carry parent_id so resolveParentJobs can detect scene completion
        return {
          ...r,
          parentId: gen.parent_id ?? undefined,
          workspaceId: gen.workspace_id,
        } satisfies PollResultWithParent;
      }),
    );
    results.push(...batchResults);
  }

  const toUpdate = results.filter(r => r.status === "completed" || r.status === "failed");
  await Promise.all(toUpdate.map(r =>
    admin.from("generations").update({
      status: r.status,
      ...(r.outputUrl ? { output_url: r.outputUrl } : {}),
      updated_at: new Date().toISOString(),
    }).eq("id", r.id)
  ));

  // After updating scene clips, check if any parent long-video jobs can now be stitched
  const completedScenes = results.filter(
    (r) => r.status === "completed" && r.parentId,
  );
  if (completedScenes.length > 0) {
    await resolveParentJobs(completedScenes).catch((err) =>
      console.error(JSON.stringify({
        level: "error",
        event: "RESOLVE_PARENT_JOBS_FAILED",
        reason: err instanceof Error ? err.message : String(err),
      })),
    );
  }

  return NextResponse.json({
    checked: pollable.length,
    skipped_parent_rows: (pending?.length ?? 0) - pollable.length,
    updated: toUpdate.length,
    completed: results.filter(r => r.status === "completed").length,
    failed: results.filter(r => r.status === "failed").length,
    processing: results.filter(r => r.status === "processing").length,
    skipped: results.filter(r => r.status === "skipped").length,
  });
}
