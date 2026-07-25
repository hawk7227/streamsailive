import { NextResponse, type NextRequest } from "next/server";
import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { processBestRepositoryExecutionJob } from "@/lib/streams-builder/repository-worker-best";

export const runtime = "nodejs";
export const maxDuration = 60;

const jobs = new StreamsAIJobsRepository();
const WORKER_NAME = "streams-builder-autonomous-repository-worker";
const BATCH_LIMIT = Math.max(1, Math.min(Number(process.env.STREAMS_BUILDER_WORKER_BATCH_LIMIT || 8), 32));
const PARALLELISM = Math.max(1, Math.min(Number(process.env.STREAMS_BUILDER_WORKER_PARALLELISM || 4), BATCH_LIMIT));

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

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      if (item === undefined) continue;
      try {
        results[index] = { status: "fulfilled", value: await worker(item) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }));
  return results;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized repository execution worker" }, { status: 401 });
  }

  try {
    const rows = await fetchWorkBatch();
    const settled = await runWithConcurrency(rows, PARALLELISM, async (row) => {
      const scope = toScope(row);
      const jobId = String(row.id);
      await jobs.createEvent(scope, {
        jobId,
        eventType: "repository.worker.dispatch",
        message: "Autonomous repository worker dispatching job",
        data: { worker: WORKER_NAME, parallelism: PARALLELISM, batchLimit: BATCH_LIMIT },
      });
      return processBestRepositoryExecutionJob(scope, row, jobs);
    });

    const results = settled.map((entry) => entry.status === "fulfilled"
      ? entry.value
      : { ok: false, status: "failed", truthState: "FAILED", error: entry.reason instanceof Error ? entry.reason.message : String(entry.reason) });
    const failed = settled.filter((entry) => entry.status === "rejected").length;

    return NextResponse.json({
      ok: failed === 0,
      worker: WORKER_NAME,
      claimed: rows.length,
      failed,
      parallelism: PARALLELISM,
      results,
      proof: rows.length ? ["worker authorized", "repository_execution batch fetched", "autonomous runtime processor invoked"] : ["worker authorized", "no repository_execution jobs queued"],
      unproven: failed ? [`${failed} worker executions rejected`] : [],
    }, { status: failed ? 207 : 200 });
  } catch (error) {
    console.error("[streams-builder-autonomous-repository-worker]", error);
    return NextResponse.json(
      { ok: false, worker: WORKER_NAME, error: error instanceof Error ? error.message : "Unknown repository worker error" },
      { status: 500 },
    );
  }
}
