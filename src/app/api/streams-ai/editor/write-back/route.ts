import { NextResponse } from "next/server";
import { assertLikelyTsx, callOpenAIForEditor } from "@/lib/streams-ai/editor/openai-editor";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const source = String(body.source || "").trim();
  const instruction = String(body.instruction || body.prompt || "").trim();

  if (!source) {
    return NextResponse.json({ ok: false, error: "source is required" }, { status: 400 });
  }

  if (!instruction) {
    return NextResponse.json({ ok: false, error: "instruction is required" }, { status: 400 });
  }

  try {
    const output = await callOpenAIForEditor(
      `Update this TSX/React file according to the instruction. Preserve unrelated logic. Return the complete updated TSX file only.

Instruction:
${instruction}

Source:
${source}`,
      {
        system:
          "You edit TSX/React files. Return only the complete updated TSX source. No markdown. No explanations. Preserve unrelated logic.",
      }
    );

    const candidate = assertLikelyTsx(output);

    return NextResponse.json({ ok: true, candidate });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "OpenAI write-back failed." },
      { status: 500 }
    );
  }
}
