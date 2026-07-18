import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { assertNoProtectedFields, sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "@/lib/streams-ai/protected-reasoning";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jobs = new StreamsAIJobsRepository();
const TERMINAL = new Set(["completed", "failed", "cancelled", "blocked", "partial", "superseded"]);

function failure(error: unknown) {
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown jobs error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const jobId = request.nextUrl.searchParams.get("jobId");
    if (jobId) {
      const job = await jobs.get(scope, jobId);
      if (!job) return NextResponse.json({ ok: false, apiVersion: "v1", error: "Job not found" }, { status: 404 });
      return NextResponse.json({ ok: true, apiVersion: "v1", job });
    }
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const status = request.nextUrl.searchParams.get("status");
    return NextResponse.json({ ok: true, apiVersion: "v1", jobs: await jobs.list(scope, { sessionId, status }) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = sanitizeStreamsAIPayload(await request.json().catch(() => ({}))) as Record<string, any>;
    assertNoProtectedFields(body);
    const job = await jobs.create(scope, {
      projectId: body.projectId,
      sessionId: body.sessionId,
      messageId: body.messageId,
      toolCallId: body.toolCallId,
      productId: body.productId,
      kind: body.kind,
      status: body.status,
      inputJson: body.inputJson,
      creditEstimate: body.creditEstimate,
    });
    return NextResponse.json({ ok: true, apiVersion: "v1", job }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = sanitizeStreamsAIPayload(await request.json().catch(() => ({}))) as Record<string, any>;
    assertNoProtectedFields(body);
    const jobId = String(body.jobId || "");
    if (!jobId) return NextResponse.json({ ok: false, apiVersion: "v1", error: "jobId is required" }, { status: 400 });
    const job = await jobs.get(scope, jobId);
    if (!job) return NextResponse.json({ ok: false, apiVersion: "v1", error: "Job not found" }, { status: 404 });

    const action = String(body.action || "event");
    if (["cancel", "supersede"].includes(action)) {
      if (TERMINAL.has(String(job.status || ""))) {
        return NextResponse.json({ ok: true, apiVersion: "v1", job, alreadyTerminal: true });
      }
      const status = action === "cancel" ? "cancelled" : "superseded";
      const message = action === "cancel"
        ? "Streams stopped this operation. Completed work remains preserved."
        : "A newer user direction replaced this operation. Completed work remains preserved.";
      const updated = await jobs.update(scope, jobId, { status, error: message });
      const event = await jobs.createEvent(scope, {
        jobId,
        eventType: status,
        message,
        data: {
          status,
          completedItems: body.completedItems || [],
          remainingItems: action === "cancel" ? body.remainingItems || [] : [],
          preservedItems: body.preservedItems || job.input_json?.preservedItems || [],
          nextAction: sanitizeStreamsAIText(body.nextAction || (action === "cancel" ? "Resume only after a new user instruction." : "Continue with the newest user instruction.")),
          evidenceLevel: "runtime_verified",
          verificationState: action === "cancel" ? "inconclusive" : "passed",
        },
      });
      return NextResponse.json({ ok: true, apiVersion: "v1", job: updated, event });
    }

    if (!body.eventType) return NextResponse.json({ ok: false, apiVersion: "v1", error: "eventType is required" }, { status: 400 });
    const event = await jobs.createEvent(scope, {
      jobId,
      eventType: String(body.eventType),
      message: body.message ? sanitizeStreamsAIText(String(body.message)) : null,
      data: sanitizeStreamsAIPayload(body.data || {}),
    });
    return NextResponse.json({ ok: true, apiVersion: "v1", event });
  } catch (error) {
    return failure(error);
  }
}
