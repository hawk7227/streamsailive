import { NextResponse } from "next/server";
import { buildObjectMaskData } from "@/lib/admingeneration/editor/object-mask-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function internalUrl(request: Request, path: string) {
  return new URL(path, new URL(request.url).origin).toString();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await context.params;
  const projectId = params.id;

  const response = await fetch(internalUrl(request, `/api/admingeneration/editor/projects/${projectId}/intelligence`), {
    cache: "no-store",
  });

  const intelligence = await response.json().catch(() => null);

  return NextResponse.json({
    ok: true,
    projectId,
    objectMaskData: buildObjectMaskData({ intelligence }),
  });
}
