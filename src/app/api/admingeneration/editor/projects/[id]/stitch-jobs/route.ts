import { NextResponse } from "next/server";
import { createStitchJob, listStitchJobs } from "@/lib/admingeneration/video-editor-control-plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;
  const result = await listStitchJobs(id);
  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-editor-stitch-jobs", error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, route: "admingeneration-editor-stitch-jobs", editorProjectId: id, stitchJobs: result.stitchJobs });
}

export async function POST(request: Request, context: Params) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await createStitchJob({
    editorProjectId: id,
    activeVersionId: typeof body.activeVersionId === "string" ? body.activeVersionId : null,
    timelineSnapshot: typeof body.timelineSnapshot === "object" && body.timelineSnapshot ? (body.timelineSnapshot as Record<string, unknown>) : {},
    metadata: { source: "admingeneration-editor-stitch-jobs", request: body },
  });
  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-editor-stitch-jobs", error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, route: "admingeneration-editor-stitch-jobs", stitchJob: result.stitchJob });
}
