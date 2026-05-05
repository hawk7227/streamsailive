/**
 * POST /api/streams/generation-job/:id/cancel
 * 
 * Cancel single generation job.
 * Marks as cancelled in database, stops polling.
 * 
 * Rule 7.1: Genuine database update
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

export async function POST(
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

    // Rule 7.1: Update job status in database
    const { error } = await supabase
      .from("generation_jobs")
      .update({ status: "cancelled" })
      .eq("id", jobId);

    if (error) {
      console.error("Error cancelling job:", error);
      return new Response(
        JSON.stringify({ error: "Failed to cancel job" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error cancelling job:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
