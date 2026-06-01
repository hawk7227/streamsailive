import { NextResponse } from "next/server";
import { createBlockedEditInstruction } from "@/lib/admingeneration/video-editor-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!id || !body) return NextResponse.json({ ok: false, error: "editor project id and body are required" }, { status: 400 });

  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
  const targetType = typeof body.targetType === "string" ? body.targetType.trim() : "project";
  const targetId = typeof body.targetId === "string" ? body.targetId : null;
  const versionId = typeof body.versionId === "string" ? body.versionId : null;

  if (!instruction) return NextResponse.json({ ok: false, error: "instruction is required" }, { status: 400 });

  const result = await createBlockedEditInstruction({
    editorProjectId: id,
    versionId,
    targetType,
    targetId,
    instruction,
    metadata: { source: "admingeneration-editor-edit-instruction", requestedAction: body.requestedAction || null },
  });

  if (!result.ok) return NextResponse.json({ ok: false, route: "admingeneration-editor-edit-instruction", error: result.error }, { status: 500 });

  return NextResponse.json({ ok: true, route: "admingeneration-editor-edit-instruction", status: result.editInstruction.status, editInstruction: result.editInstruction });
}
