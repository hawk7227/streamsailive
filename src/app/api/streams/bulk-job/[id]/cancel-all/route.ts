/**
 * POST /api/streams/bulk-job/:id/cancel-all
 * 
 * Cancel all jobs in bulk job (queued and processing).
 * 
 * Output: { cancelled_job_ids: [...] }
 * 
 * Rule 7.1: Genuine database update
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const bulkJobId = params.id;

    if (!bulkJobId) {
      return new Response(
        JSON.stringify({ error: "Missing bulk job ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Rule 7.1: Get all jobs in bulk
    const { data: jobs, error: fetchError } = await supabase
      .from("generation_jobs")
      .select("id")
      .eq("bulk_job_id", bulkJobId)
      .in("status", ["queued", "processing"]);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch jobs" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const jobIds = jobs?.map((j: any) => j.id) || [];

    if (jobIds.length === 0) {
      return new Response(
        JSON.stringify({ cancelledJobIds: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Rule 7.1: Cancel all jobs
    const { error: cancelError } = await supabase
      .from("generation_jobs")
      .update({ status: "cancelled" })
      .eq("bulk_job_id", bulkJobId);

    if (cancelError) {
      console.error("Error cancelling bulk jobs:", cancelError);
      return new Response(
        JSON.stringify({ error: "Failed to cancel jobs" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Rule 7.1: Update bulk job status
    await supabase
      .from("bulk_jobs")
      .update({ status: "cancelled" })
      .eq("id", bulkJobId);

    return new Response(
      JSON.stringify({ cancelledJobIds: jobIds }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error cancelling bulk jobs:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
