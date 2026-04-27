/**
 * GET /api/streams/my-generations
 * 
 * Resume session - get all incomplete generations for user/workspace.
 * Called on app load to restore active jobs.
 * 
 * Input: POST body { userId, workspaceId }
 * Output: { active_jobs: [...], bulk_jobs: [...] }
 * 
 * Rule 7.1: Genuine database query
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, workspaceId } = body;

    if (!userId || !workspaceId) {
      return new Response(
        JSON.stringify({ error: "Missing userId or workspaceId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Rule 7.1: Query all active generation jobs for user
    const { data: activeJobs, error: jobsError } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .in("status", ["queued", "processing"]);

    if (jobsError) {
      console.error("Error fetching active jobs:", jobsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch active jobs" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Rule 7.1: Query all active bulk jobs for user
    const { data: activeBulkJobs, error: bulkError } = await supabase
      .from("bulk_jobs")
      .select("*")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .in("status", ["queued", "processing"]);

    if (bulkError) {
      console.error("Error fetching bulk jobs:", bulkError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch bulk jobs" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        activeJobs: activeJobs || [],
        bulkJobs: activeBulkJobs || [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error resuming session:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
