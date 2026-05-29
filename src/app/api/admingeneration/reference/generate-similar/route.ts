import { NextResponse } from "next/server";
import { buildProviderReadyPrompt, type VideoReferenceBlueprint } from "@/lib/admingeneration/video-reference-blueprint";
import { getReferenceAnalysis } from "@/lib/admingeneration/video-reference-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

function isBlueprint(value: unknown): value is VideoReferenceBlueprint {
  return Boolean(value && typeof value === "object" && "generation" in value && "summary" in value);
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload || typeof payload !== "object") {
    return jsonError("Invalid generate-similar request body.", 400);
  }

  const analysisId = typeof payload.analysisId === "string" ? payload.analysisId : "";
  let blueprint = isBlueprint(payload.blueprint) ? payload.blueprint : null;

  if (!blueprint && analysisId) {
    const result = await getReferenceAnalysis(analysisId);
    blueprint = result.record?.blueprint || null;
  }

  if (!blueprint) {
    return jsonError("A completed reference blueprint or analysisId with stored blueprint is required.", 400);
  }

  const providerReadyPrompt = blueprint.generation.providerReadyPrompt?.includes("Blocked until")
    ? buildProviderReadyPrompt(blueprint)
    : blueprint.generation.providerReadyPrompt || buildProviderReadyPrompt(blueprint);

  return NextResponse.json({
    ok: true,
    route: "admingeneration-reference-generate-similar",
    analysisId: analysisId || null,
    generateRequest: {
      kind: blueprint.generation.recommendedMode === "text-to-video" ? "text-to-video" : "image-to-video",
      provider: blueprint.generation.recommendedProvider || "auto",
      prompt: providerReadyPrompt,
      negativePrompt: blueprint.generation.negativePrompt,
      sourceImageUrl: blueprint.shots.flatMap((shot) => shot.frameAssetIds)[0] || null,
      blueprint,
    },
  });
}
