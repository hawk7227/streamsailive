import { NextResponse } from "next/server";
import { createTranscriptEdit, listTranscriptEdits } from "@/lib/admingeneration/video-editor-control-plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;
  const result = await listTranscriptEdits(id);
  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-editor-transcript-edits", error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, route: "admingeneration-editor-transcript-edits", editorProjectId: id, transcriptEdits: result.transcriptEdits });
}

export async function POST(request: Request, context: Params) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const editedText = typeof body.editedText === "string" ? body.editedText.trim() : "";
  if (!editedText) return NextResponse.json({ ok: false, error: "editedText is required" }, { status: 400 });
  const result = await createTranscriptEdit({
    editorProjectId: id,
    editedText,
    originalText: typeof body.originalText === "string" ? body.originalText : null,
    versionId: typeof body.versionId === "string" ? body.versionId : null,
    segmentId: typeof body.segmentId === "string" ? body.segmentId : null,
    startSec: typeof body.startSec === "number" ? body.startSec : null,
    endSec: typeof body.endSec === "number" ? body.endSec : null,
    metadata: { source: "admingeneration-editor-transcript-edits", request: body },
  });
  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-editor-transcript-edits", error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, route: "admingeneration-editor-transcript-edits", transcriptEdit: result.transcriptEdit });
}
