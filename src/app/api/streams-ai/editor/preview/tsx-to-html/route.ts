import { NextResponse } from "next/server";
import { assertCompleteHtml, callOpenAIForEditor } from "@/lib/streams-ai/editor/openai-editor";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const source = String(body.source || body.tsx || "").trim();

  if (!source) {
    return NextResponse.json({ ok: false, error: "source is required" }, { status: 400 });
  }

  try {
    const output = await callOpenAIForEditor(
      `Convert this TSX/React source into a complete static HTML document for iframe preview. Return only full HTML.

${source}`,
      {
        system:
          "Convert TSX/React to static preview HTML. Return only a complete HTML document. No markdown. No explanations.",
      }
    );

    const html = assertCompleteHtml(output);

    return NextResponse.json({ ok: true, html });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "TSX preview conversion failed." },
      { status: 500 }
    );
  }
}
