import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsFeatureFlagsRepository, type StreamsFeaturePlatform } from "@/lib/streams-mobile/feature-flags-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const flags = new StreamsFeatureFlagsRepository();
const PLATFORMS: StreamsFeaturePlatform[] = ["web", "ios", "android"];

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const featureKey = request.nextUrl.searchParams.get("featureKey") || "";
    const platform = request.nextUrl.searchParams.get("platform") as StreamsFeaturePlatform | null;
    if (!featureKey || !platform || !PLATFORMS.includes(platform)) {
      return NextResponse.json({ ok: false, apiVersion: "v1", error: "featureKey and platform=web|ios|android are required" }, { status: 400 });
    }
    const evaluation = await flags.evaluate(scope, {
      featureKey,
      platform,
      appVersion: request.nextUrl.searchParams.get("appVersion"),
      planId: request.nextUrl.searchParams.get("planId"),
      region: request.nextUrl.searchParams.get("region"),
      deviceId: request.nextUrl.searchParams.get("deviceId"),
    });
    return NextResponse.json({ ok: true, apiVersion: "v1", evaluation });
  } catch (error) {
    return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown feature flag error" }, { status: 500 });
  }
}
