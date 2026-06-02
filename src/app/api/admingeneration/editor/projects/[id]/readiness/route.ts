import { NextResponse } from "next/server";
import { getProviderReadiness } from "@/lib/admingeneration/editor/provider-readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await context.params;
  const projectId = params.id;

  if (!projectId) {
    return NextResponse.json({ ok: false, error: "Missing editor project id." }, { status: 400 });
  }

  const providers = getProviderReadiness();

  return NextResponse.json({
    ok: true,
    projectId,
    providers,
    allReady: providers.every((provider) => provider.ready),
  });
}
