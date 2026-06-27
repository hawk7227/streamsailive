import { NextResponse, type NextRequest } from "next/server";
import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { processBestRepositoryExecutionJob } from "@/lib/streams-builder/repository-worker-best";

export const runtime = "nodejs";
export const maxDuration = 60;

const jobs = new StreamsAIJobsRepository();
const WORKER_NAME = "streams-builder-best-repository-worker";
const BATCH_LIMIT = 1;

function isAuthorized(request: NextRequest) {
  const expected = (process.env.STREAMS_BUILDER_WORKER_SECRET || process.env.STREAMS_AI_WORKER_SECRET || process.env.CRON_SECRET || "").trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization") || "";
  const querySecret = request.nextUrl.searchParams.get("secret") || "";
  return auth === `Bearer ${expected}` || querySecret === expected;
}

function toScope(row: Record<string, unknown>): StreamsAIScope {
  return {
    tenantId: String(row.tenant_id),
    userId: String(row.user_id),
    defaultProjectId: typeof row.project_id === "string" ? row.project_id : null,
    workspaceId: "streams-ai",
    moduleId: "streams-ai-core",
    productId: "streams-ai",
  };
}

async function fetchWorkBatch() {
  const client = streamsAISchema(createStreamsAIServiceClient());
  const { data, error } = await client
    .from(streamsAITables.jobs)
    .select("*")
    .eq("kind", "repository_execution")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) throw new Error(`Failed to fetch repository execution jobs: ${error.message}`);
  return (data || []) as Array<Record<string, unknown>>;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized repository execution worker" }, { status: 401 });
  }

  try {
    const rows = await fetchWorkBatch();
    const results = [];

    for (const row of rows) {
      const scope = toScope(row);
      const jobId = String(row.id);
      await jobs.createEvent(scope, {
        jobId,
        eventType: "repository.worker.dispatch",
        message: "Best-builder repository worker dispatching job",
        data: { worker: WORKER_NAME },
      });
      results.push(await processBestRepositoryExecutionJob(scope, row, jobs));
    }

    return NextResponse.json({
      ok: true,
      worker: WORKER_NAME,
      claimed: rows.length,
      results,
      proof: rows.length ? ["worker authorized", "repository_execution batch fetched", "best-builder job processor invoked"] : ["worker authorized", "no repository_execution jobs queued"],
      unproven: rows.length ? ["browser screenshot artifact requires browser verification job completion", "approval workflow requires user review"] : [],
    });
  } catch (error) {
    console.error("[streams-builder-best-repository-worker]", error);
    return NextResponse.json(
      { ok: false, worker: WORKER_NAME, error: error instanceof Error ? error.message : "Unknown repository worker error" },
      { status: 500 },
    );
  }
}
