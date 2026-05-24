import { NextResponse, type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const assetId = request.nextUrl.searchParams.get("assetId") || "";
    if (!assetId) return NextResponse.json({ ok: false, error: "assetId is required" }, { status: 400 });

    // ?download=1 forces Content-Disposition: attachment; default is inline for <img> preview
    const forceDownload = request.nextUrl.searchParams.get("download") === "1";

    const service = createStreamsAIServiceClient();
    const db = streamsAISchema(service);
    const { data: asset, error } = await db
      .from(streamsAITables.assets)
      .select("*")
      // UUID acts as a capability token since <img> tags may lack auth headers/cookies
      .eq("id", assetId)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!asset) return NextResponse.json({ ok: false, error: "Asset not found" }, { status: 404 });

    if (asset.storage_bucket && asset.storage_path) {
      // Inline by default so <img> tags can render images; only force attachment when download=1
      const signedUrlOptions = forceDownload
        ? { download: asset.name || "streams-ai-asset" }
        : {};

      const { data, error: signedError } = await service.storage
        .from(asset.storage_bucket)
        .createSignedUrl(asset.storage_path, 600, signedUrlOptions);

      if (signedError) return NextResponse.json({ ok: false, error: signedError.message }, { status: 500 });
      return NextResponse.redirect(data.signedUrl, { 
        status: 302,
        headers: {
          // Cache the redirect for 5 minutes (the signed URL expires in 10 minutes)
          // This allows the browser's native image cache to work across chat switches
          "Cache-Control": forceDownload 
            ? "no-cache, no-store" 
            : "public, max-age=300, s-maxage=300, stale-while-revalidate=60"
        }
      });
    }

    if (asset.public_url) {
      return NextResponse.redirect(asset.public_url, { 
        status: 302,
        headers: {
          "Cache-Control": forceDownload 
            ? "no-cache, no-store" 
            : "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
        }
      });
    }

    return NextResponse.json({ ok: false, error: "Asset has no downloadable storage path or URL" }, { status: 409 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
