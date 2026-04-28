/**
 * GET /api/streams/bulk-job/:id
 * 
 * Check status of bulk job with all item details.
 * 
 * Output: { total_items, completed_items, failed_items, items: [...] }
 * 
 * Rule 7.1: Genuine API call to database
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bulkJobId } = await params;

    if (!bulkJobId) {
      return new Response(
        JSON.stringify({ error: "Missing bulk job ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Rule 7.1: Query bulk job from database
    const { data: bulkJob, error: bulkError } = await supabase
      .from("bulk_jobs")
      .select("*")
      .eq("id", bulkJobId)
      .single();

    if (bulkError || !bulkJob) {
      return new Response(
        JSON.stringify({ error: "Bulk job not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Rule 7.1: Query all items in bulk job
    const { data: items, error: itemsError } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("bulk_job_id", bulkJobId);

    if (itemsError || !items) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch bulk job items" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Calculate counts
    const completed = items.filter((i: any) => i.status === "completed").length;
    const failed = items.filter((i: any) => i.status === "failed").length;
    const queued = items.filter((i: any) => i.status === "queued").length;

    return new Response(
      JSON.stringify({
        totalItems: items.length,
        completedItems: completed,
        failedItems: failed,
        queuedItems: queued,
        items: items.map((item: any) => ({
          jobId: item.id,
          status: item.status,
          outputUrl: item.output_url,
          error: item.error,
        })),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error checking bulk job status:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
