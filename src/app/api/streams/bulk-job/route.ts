/**
 * POST /api/streams/bulk-job
 * 
 * Create bulk job with multiple generation items.
 * Returns immediately with all job IDs.
 * 
 * Input: { items: [...], parallel: boolean }
 * Output: { bulk_job_id, job_ids: [...] }
 * 
 * Rule 7.1: Genuine API call, stores in database
 */

import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, key);
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { items, parallel } = body;

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "No items provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const bulkJobId = uuidv4();
    const jobIds: string[] = [];

    // Rule 7.1: Create individual jobs for bulk
    const jobsToInsert = items.map((item: any) => ({
      id: uuidv4(),
      mode: item.mode,
      status: "queued",
      prompt: item.prompt,
      model: item.model,
      duration: item.duration,
      aspect_ratio: item.aspectRatio,
      custom_width: item.customWidth,
      custom_height: item.customHeight,
      generation_id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      provider: getProviderForModel(item.model),
      user_id: item.userId,
      workspace_id: item.workspaceId,
      bulk_job_id: bulkJobId,
      retry_count: 0,
      created_at: new Date().toISOString(),
    }));

    const { data: jobs, error: jobError } = await supabase
      .from("generation_jobs")
      .insert(jobsToInsert)
      .select();

    if (jobError || !jobs) {
      return new Response(
        JSON.stringify({ error: "Failed to create jobs" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    jobIds.push(...jobs.map((j: any) => j.id));

    // Rule 7.1: Create bulk job record
    const { error: bulkError } = await supabase
      .from("bulk_jobs")
      .insert([
        {
          id: bulkJobId,
          user_id: items[0].userId,
          workspace_id: items[0].workspaceId,
          mode: items[0].mode,
          total_items: items.length,
          completed_items: 0,
          failed_items: 0,
          status: "processing",
          created_at: new Date().toISOString(),
        },
      ]);

    if (bulkError) {
      return new Response(
        JSON.stringify({ error: "Failed to create bulk job" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        bulkJobId,
        jobIds,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating bulk job:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

function getProviderForModel(model: string): string {
  if (model.includes("kling")) return "kling";
  if (model.includes("veo")) return "veo";
  if (model.includes("flux")) return "flux";
  if (model.includes("minimax")) return "minimax";
  if (model.includes("elevenlabs")) return "elevenlabs";
  return "unknown";
}
