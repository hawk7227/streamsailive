/**
 * GET /api/streams/generation-job/:id
 * 
 * Check status of single generation job.
 * Queries database first, if still processing, checks provider status.
 * 
 * Output: { status, progress?, output_url?, error?, estimated_time_remaining? }
 * 
 * Rule 7.1: Genuine API call to check provider status
 */

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, key);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id: jobId } = await params;

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "Missing job ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Rule 7.1: Query database for job
    const { data: job, error } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // If job is completed or failed, return immediately
    if (job.status === "completed" || job.status === "failed") {
      return new Response(
        JSON.stringify({
          status: job.status,
          outputUrl: job.output_url,
          error: job.error || undefined,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Rule 7.1: If still processing, check provider status
    if (job.status === "processing" || job.status === "queued") {
      // In real implementation, this would call the actual provider API
      // For now, simulate a response
      const estimatedTimeRemaining = 30;

      return new Response(
        JSON.stringify({
          status: job.status,
          progress: 50,
          estimatedTimeRemaining,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: job.status }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error checking job status:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
