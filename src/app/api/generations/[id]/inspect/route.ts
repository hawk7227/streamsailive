/**
 * POST /api/generations/[id]/inspect
 *
 * Non-blocking post-generation semantic inspector.
 * Called as fire-and-forget after image generation completes.
 *
 * Runs vision-based semantic QA checks against the generated image URL,
 * then writes the result back to the generations DB row.
 *
 * Auth: requires authenticated user who owns the generation.
 * Never blocks the generation response — always called in background.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inspectImageSemantics } from "@/lib/generator-intelligence/services/visionInspector";
import type { SemanticQaCheck } from "@/lib/generator-intelligence/types";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await props.params;

  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { imageUrl?: string; semanticQaChecks?: SemanticQaCheck[] };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { imageUrl, semanticQaChecks } = body;

  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }
  if (!Array.isArray(semanticQaChecks) || semanticQaChecks.length === 0) {
    return NextResponse.json({ skipped: true, reason: "No semantic QA checks provided" });
  }

  const admin = createAdminClient();

  // Verify generation exists and belongs to this user
  const { data: gen, error: fetchErr } = await admin
    .from("generations")
    .select("id, user_id, status, output_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !gen) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  if (gen.status !== "completed") {
    return NextResponse.json({ error: "Generation not yet completed" }, { status: 409 });
  }

  // Run vision inspection
  const result = await inspectImageSemantics(imageUrl, semanticQaChecks);

  // Write result back to DB
  // Uses metadata JSONB column — no schema migration needed
  const { error: updateErr } = await admin
    .from("generations")
    .update({
      metadata: {
        semanticInspection: {
          passed: result.passed,
          flaggedForReview: result.flaggedForReview,
          rejectReasons: result.rejectReasons,
          warnReasons: result.warnReasons,
          checks: result.checks,
          skipped: result.skipped,
          skipReason: result.skipReason,
          inspectedAt: new Date().toISOString(),
        },
      },
    })
    .eq("id", id);

  if (updateErr) {
    console.error("[inspect] DB update failed:", updateErr.message);
    // Non-fatal — return result anyway
  }

  return NextResponse.json({
    generationId: id,
    passed: result.passed,
    flaggedForReview: result.flaggedForReview,
    rejectReasons: result.rejectReasons,
    warnReasons: result.warnReasons,
    checks: result.checks,
    skipped: result.skipped,
    skipReason: result.skipReason,
  });
}
