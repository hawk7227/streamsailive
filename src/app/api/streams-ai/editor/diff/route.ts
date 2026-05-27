import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function simpleLineDiff(before: string, after: string) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const max = Math.max(beforeLines.length, afterLines.length);
  const lines: string[] = [];

  for (let index = 0; index < max; index += 1) {
    const left = beforeLines[index];
    const right = afterLines[index];

    if (left === right) {
      if (typeof left !== "undefined") lines.push(` ${left}`);
      continue;
    }

    if (typeof left !== "undefined") lines.push(`-${left}`);
    if (typeof right !== "undefined") lines.push(`+${right}`);
  }

  return lines.join("\n");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const before = String(body.before || body.source || "");
  const after = String(body.after || body.candidate || "");

  if (!before || !after) {
    return NextResponse.json({ ok: false, error: "before and after are required" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    diff: simpleLineDiff(before, after),
  });
}
