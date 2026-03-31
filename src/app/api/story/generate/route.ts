import { NextResponse } from "next/server";
import { buildStoryBible } from "@/lib/story/storyBible";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const storyText = typeof body.storyText === "string" ? body.storyText.trim() : "";
  if (!storyText) {
    return NextResponse.json({ error: "storyText is required" }, { status: 400 });
  }

  const bible = buildStoryBible({
    title: typeof body.title === "string" ? body.title : undefined,
    storyText,
    aiFill: Boolean(body.aiFill),
    sourceKind: (typeof body.sourceKind === "string" ? body.sourceKind : "mixed") as "self" | "family_or_friend" | "synthetic" | "mixed",
    uploadedReferences: Array.isArray(body.uploadedReferences) ? body.uploadedReferences.filter((item: unknown): item is string => typeof item === "string") : [],
  });

  return NextResponse.json({
    data: bible,
    meta: {
      locked: true,
      version: "story-bible-v2",
      requiresReview: true,
      autoReviewStages: ["image_generation", "video_generation", "final_export"],
    },
  });
}
