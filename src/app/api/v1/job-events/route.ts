import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { normalizeBuilderEventCursor } from "@/lib/streams-builder/versioned-builder-api-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jobs = new StreamsAIJobsRepository();

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const jobId = request.nextUrl.searchParams.get("jobId") || "";
    const afterSequence = normalizeBuilderEventCursor(request.nextUrl.searchParams.get("afterSequence"));
    if (!jobId) return NextResponse.json({ ok: false, apiVersion: "v1", error: "jobId is required" }, { status: 400 });
    if (afterSequence == null) return NextResponse.json({ ok: false, apiVersion: "v1", error: "afterSequence must be a non-negative number" }, { status: 400 });
    const job = await jobs.get(scope, jobId);
    if (!job) return NextResponse.json({ ok: false, apiVersion: "v1", error: "Job not found" }, { status: 404 });
    const allEvents = await jobs.events(scope, jobId);
    const events = allEvents.filter((event: any) => Number(event?.data?.sequenceNumber || 0) > afterSequence);
    const nextSequence = events.reduce((max: number, event: any) => Math.max(max, Number(event?.data?.sequenceNumber || 0)), afterSequence);
    return NextResponse.json({ ok: true, apiVersion: "v1", jobId, events, nextSequence, terminal: ["completed", "failed", "cancelled", "blocked", "partial", "superseded"].includes(String(job.status || "")) });
  } catch (error) {
    return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown job events error" }, { status: 500 });
  }
}
