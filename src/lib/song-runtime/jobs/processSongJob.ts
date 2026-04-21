/**
 * jobs/processSongJob.ts
 *
 * Worker entrypoint for the song job runtime.
 * Queries pending song jobs from the generation_jobs table and processes each.
 * Called by the cron route on its schedule.
 *
 * Responsibilities:
 * - Query pending/processing song jobs with provider_job_ids
 * - Route each job to pollSongJob
 * - Track and return summary statistics
 * - All state changes are persisted — no in-memory-only progress
 *
 * Does NOT:
 * - Act as an API route
 * - Rely on browser or request state
 * - Hold job state only in memory
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { SongJobRow } from "../types";
import { pollSongJob } from "./pollSongJob";

const CHUNK_SIZE = 10;
const MAX_JOBS_PER_RUN = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export async function processSongPendingJobs(): Promise<{
  checked: number;
  completed: number;
  failed: number;
  processing: number;
  skipped: number;
}> {
  const admin = createAdminClient();

  // Query jobs that have been submitted (have provider_job_id) and are not terminal
  const { data: jobs, error } = await admin
    .from("generation_jobs")
    .select(
      "id, generation_id, workspace_id, media_type, provider, model, provider_job_id, phase, status, request_payload, response_payload, output_url, error, created_at, updated_at",
    )
    .eq("media_type", "song")
    .in("status", ["pending", "queued", "processing"])
    .not("provider_job_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(MAX_JOBS_PER_RUN);

  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "PROCESS_SONG_JOBS_QUERY_FAILED",
        reason: error.message,
      }),
    );
    return { checked: 0, completed: 0, failed: 0, processing: 0, skipped: 0 };
  }

  if (!jobs?.length) {
    return { checked: 0, completed: 0, failed: 0, processing: 0, skipped: 0 };
  }

  let completed = 0;
  let failed = 0;
  let processing = 0;
  let skipped = 0;

  for (const batch of chunk(jobs as SongJobRow[], CHUNK_SIZE)) {
    const results = await Promise.allSettled(
      batch.map((job) => pollSongJob(job)),
    );

    for (const [i, result] of results.entries()) {
      if (result.status === "rejected") {
        skipped++;
        console.error(
          JSON.stringify({
            level: "error",
            event: "SONG_JOB_POLL_UNHANDLED",
            jobId: batch[i]?.id,
            reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
          }),
        );
        continue;
      }

      switch (result.value.status) {
        case "completed": completed++; break;
        case "failed": failed++; break;
        case "processing": processing++; break;
        default: skipped++;
      }
    }
  }

  console.log(
    JSON.stringify({
      level: "info",
      event: "SONG_JOBS_PROCESSED",
      checked: jobs.length,
      completed,
      failed,
      processing,
      skipped,
    }),
  );

  return { checked: jobs.length, completed, failed, processing, skipped };
}
