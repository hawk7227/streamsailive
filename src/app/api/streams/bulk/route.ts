/**
 * POST /api/streams/bulk
 *
 * Submits N parallel or sequential generation jobs at once.
 * Writes one bulk_jobs row + N bulk_job_items rows.
 * Returns { bulkJobId, items: [{itemId, requestId}] }.
 * Client polls /api/streams/bulk/status with bulkJobId.
 *
 * Mode: parallel — all N jobs submitted simultaneously via fal queue.
 *       sequential — jobs submitted one-by-one (throttle-safe).
 *
 * Currently supports: T2V, image generation.
 * All jobs route through FAL_KEY — no per-item auth overhead.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { falSubmit, FAL_ENDPOINTS } from "@/lib/streams/fal-client";

export const maxDuration = 60;

const MAX_BULK = 12;

type BulkItem = {
  prompt:      string;
  duration?:   string;
  aspectRatio?: string;
  width?:      number;
  height?:     number;
};

type RequestBody = {
  mode:        "parallel" | "sequential";
  generation:  "video" | "image";
  model?:      string;
  items:       BulkItem[];
};

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = raw as RequestBody;

  if (!Array.isArray(body.items) || body.items.length < 1) {
    return NextResponse.json({ error: "items array required (1–12)" }, { status: 400 });
  }
  if (body.items.length > MAX_BULK) {
    return NextResponse.json({ error: `Max ${MAX_BULK} items per bulk job` }, { status: 400 });
  }
  if (!["parallel","sequential"].includes(body.mode)) {
    return NextResponse.json({ error: "mode must be parallel or sequential" }, { status: 400 });
  }

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

  // Resolve endpoint
  const endpoint = body.generation === "image"
    ? FAL_ENDPOINTS.FLUX_KONTEXT
    : FAL_ENDPOINTS.KLING_V3_T2V;

  // Write bulk_jobs row
  const bulkJobId = crypto.randomUUID();
  await admin.from("bulk_jobs").insert({
    id:          bulkJobId,
    workspace_id: workspaceId,
    mode:         body.mode,
    total_count:  body.items.length,
    status:       "running",
  });

  // Submit all jobs
  const results: { itemId: string; requestId: string | null; status: string }[] = [];

  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];
    const itemId = crypto.randomUUID();

    const falInput: Record<string, unknown> = {
      prompt:       item.prompt,
      aspect_ratio: item.aspectRatio ?? "16:9",
    };
    if (body.generation === "video") {
      falInput.duration      = item.duration ?? "5";
      falInput.generate_audio = true;
    }
    if (body.generation === "image" && item.width && item.height) {
      delete falInput.aspect_ratio;
      falInput.width  = Math.round(item.width  / 8) * 8;
      falInput.height = Math.round(item.height / 8) * 8;
    }

    const submitResult = await falSubmit(endpoint, falInput);

    await admin.from("bulk_job_items").insert({
      id:             itemId,
      bulk_job_id:    bulkJobId,
      item_index:     i,
      prompt:         item.prompt,
      fal_request_id: submitResult.ok ? submitResult.responseUrl : null,
      status:         submitResult.ok ? "running" : "failed",
      error:          submitResult.ok ? null : submitResult.error,
    });

    results.push({
      itemId,
      requestId: submitResult.ok ? submitResult.responseUrl : null,
      status:    submitResult.ok ? "running" : "failed",
    });

    // Sequential mode: small delay between submissions
    if (body.mode === "sequential" && i < body.items.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return NextResponse.json({
    bulkJobId,
    mode:        body.mode,
    totalCount:  body.items.length,
    submitted:   results.filter(r => r.status === "running").length,
    failed:      results.filter(r => r.status === "failed").length,
    items:       results,
  });
}
