/**
 * POST /api/generate-image
 * Realism-enforced image generation endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { generateEnforcedImage, prepareEnforcedImagePrompt, type ImageReference } from "@/lib/media-realism/enforcedImage";
import { OPENAI_API_KEY } from "@/lib/env";

export const maxDuration = 120;

type ImageMode = "responses" | "images";
type ReferencePriority = "low" | "medium" | "high";

interface GenerateImageRequest {
  prompt: string;
  mode?: ImageMode;
  references?: ImageReference[];
  realismMode?: "strict" | "balanced" | "strict_everyday" | "premium_commercial";
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9";
  referencePriority?: ReferencePriority;
}

async function resolveWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const selection = await getCurrentWorkspaceSelection(admin, user);
  return { user, workspace: selection.current.workspace, admin };
}

export async function POST(req: NextRequest) {
  const ctx = await resolveWorkspace();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });

  let body: GenerateImageRequest & { dryRun?: boolean };
  try {
    body = await req.json() as GenerateImageRequest & { dryRun?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const input = {
    prompt: body.prompt.trim(),
    apiKey,
    workspaceId: ctx.workspace.id,
    mode: body.mode ?? "images",
    references: body.references ?? [],
    realismMode: body.realismMode === "premium_commercial" ? "premium_commercial" : "strict_everyday",
    aspectRatio: body.aspectRatio ?? "16:9",
    referencePriority: body.referencePriority ?? "medium",
  } as const;

  try {
    if (body.dryRun) {
      const prepared = await prepareEnforcedImagePrompt(input);
      return NextResponse.json({
        ok: true,
        dryRun: true,
        rewrittenPrompt: prepared.rewrittenPrompt,
        finalPrompt: prepared.finalPrompt,
        strippedTerms: prepared.strippedTerms,
        ledger: prepared.ledger,
      });
    }

    const result = await generateEnforcedImage(input);
    return NextResponse.json({
      ok: true,
      outputUrl: result.outputUrl,
      prompt: result.finalPrompt,
      rewrittenPrompt: result.rewrittenPrompt,
      strippedTerms: result.strippedTerms,
      ledger: result.ledger,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

