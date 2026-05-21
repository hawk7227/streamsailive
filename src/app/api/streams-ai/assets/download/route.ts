import { NextResponse, type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const assetId = request.nextUrl.searchParams.get("assetId") || "";
    if (!assetId) return NextResponse.json({ ok: false, error: "assetId is required" }, { status: 400 });

    const service = createStreamsAIServiceClient();
    const db = streamsAISchema(service);
    const { data: asset, error } = await db
      .from(streamsAITables.assets)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", assetId)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!asset) return NextResponse.json({ ok: false, error: "Asset not found" }, { status: 404 });

    if (asset.storage_bucket && asset.storage_path) {
      const { data, error: signedError } = await service.storage
        .from(asset.storage_bucket)
        .createSignedUrl(asset.storage_path, 600, { download: asset.name || "streams-ai-asset" });

      if (signedError) return NextResponse.json({ ok: false, error: signedError.message }, { status: 500 });
      return NextResponse.redirect(data.signedUrl, { status: 302 });
    }

    if (asset.public_url) return NextResponse.redirect(asset.public_url, { status: 302 });

    return NextResponse.json({ ok: false, error: "Asset has no downloadable storage path or URL" }, { status: 409 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
