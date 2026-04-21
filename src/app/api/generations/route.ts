import { NextResponse } from "next/server";

export const maxDuration = 60; // DALL-E + optional upload can take up to 30s
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { generateContent } from "@/lib/ai";
import { GenerationType } from "@/lib/ai/types";
import { uploadImageToSupabase } from "@/lib/supabase/storage";
import { compileGenerationRequest } from "@/lib/generator-intelligence/compiler";
import { inspectImageSemantics } from "@/lib/generator-intelligence/services/visionInspector";
import { generateEnforcedImage } from "@/lib/media-realism/enforcedImage";
import { planMediaGeneration, type MediaGenerationPlan } from "@/lib/assistant-core/media-generation";
import { ADMIN_SECRET, OPENAI_API_KEY } from "@/lib/env";

const allowedTypes: GenerationType[] = ["video", "image", "script", "voice", "i2v"];

type AllowedType = (typeof allowedTypes)[number];

const isAllowedType = (value: string): value is GenerationType =>
  allowedTypes.includes(value as GenerationType);

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const limit = Number(searchParams.get("limit") ?? "10");
  const offset = Number(searchParams.get("offset") ?? "0");

  const admin = createAdminClient();
  const selection = await getCurrentWorkspaceSelection(admin, user);

  let query = admin
    .from("generations")
    .select(
      "id, type, prompt, title, status, aspect_ratio, duration, quality, style, favorited, output_url, external_id, provider, model, progress, is_preview, created_at"
    )
    .eq("workspace_id", selection.current.workspace.id)
    .order("created_at", { ascending: false });

  if (type && isAllowedType(type)) {
    query = query.eq("type", type);
  }

  if (Number.isFinite(limit) && limit > 0) {
    const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
    query = query.range(safeOffset, safeOffset + limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const type = typeof payload?.type === "string" ? payload.type : "";
  const prompt = typeof payload?.prompt === "string" ? payload.prompt.trim() : "";

  if (!type || !isAllowedType(type)) {
    return NextResponse.json({ error: "Invalid generation type" }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const selection = await getCurrentWorkspaceSelection(admin, user);

  let outputUrl = typeof payload?.outputUrl === "string" ? payload.outputUrl : null;
  let externalId = typeof payload?.externalId === "string" ? payload.externalId : null;
  let responseText = null;
  let compiledRequest = null as ReturnType<typeof compileGenerationRequest> | null;
  let generationStatus: "pending" | "completed" | "failed" | null = null;
  let mediaPlan: MediaGenerationPlan | null = null;

  // ── bypassCompiler gate ────────────────────────────────────────────────────
  // Only allowed for admin/dev. Requires x-admin-secret header.
  const bypassCompiler = payload?.bypassCompiler === true;
  const bypassReason = typeof payload?.bypassReason === "string" ? payload.bypassReason : "admin_debug";
  if (bypassCompiler) {
    const adminSecret = request.headers.get("x-admin-secret");
    if (!adminSecret || adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "bypassCompiler requires admin authorization" }, { status: 403 });
    }
    console.warn(`[GeneratorIntelligence] BYPASS active — reason: ${bypassReason} — user: ${user.id} — prompt: ${prompt.slice(0, 80)}`);
  }

  try {
    const providerOverride = typeof payload?.provider === "string" ? payload.provider : null;
    const storyBible = typeof payload?.storyBible === "string" ? payload.storyBible : null;
    const sourceKind = typeof payload?.sourceKind === "string" ? payload.sourceKind as "self" | "family_or_friend" | "synthetic" | "mixed" : undefined;
    const referenceSummary = typeof payload?.referenceSummary === "string" ? payload.referenceSummary : null;
    const mode = typeof payload?.mode === "string" ? payload.mode : null;

    let finalPrompt = prompt;

    if (type === "image" || type === "video" || type === "i2v") {
      mediaPlan = planMediaGeneration({
        type,
        prompt,
        provider: providerOverride ?? undefined,
        model: typeof payload?.model === "string" ? payload.model : undefined,
        duration: typeof payload?.duration === "string" ? payload.duration : undefined,
        aspectRatio: typeof payload?.aspectRatio === "string" ? payload.aspectRatio : undefined,
        quality: typeof payload?.quality === "string" ? payload.quality : undefined,
        imageUrl: typeof payload?.imageUrl === "string" ? payload.imageUrl : undefined,
        workspaceId: selection.current.workspace.id,
        storyBible: storyBible ?? undefined,
        sourceKind,
        longVideo: mode === "long_video" || mode === "story" || mode === "feature",
      });
    }

    if (!bypassCompiler) {
      // ── All mediums route through the compiler — single mandatory gateway ──

      if (type === "image") {
        compiledRequest = compileGenerationRequest({
          medium: "image",
          prompt,
          provider: providerOverride ?? "openai",
          storyBible,
          sourceKind,
          referenceSummary,
        });
        finalPrompt = compiledRequest.prompt;
      }

      if (type === "video" || type === "i2v") {
        compiledRequest = compileGenerationRequest({
          medium: "video",
          prompt,
          provider: providerOverride ?? "kling",
          mode,
          storyBible,
          sourceKind,
          referenceSummary,
        });

        if (compiledRequest.structuralScore && !compiledRequest.structuralScore.isSafeForVideo && type === "i2v") {
          return NextResponse.json({
            error: "Source image is not safe for video yet.",
            code: "STRUCTURAL_SCORE_BLOCKED",
            structuralScore: compiledRequest.structuralScore,
            repairPlan: compiledRequest.repairPlan,
          }, { status: 422 });
        }

        finalPrompt = compiledRequest.prompt;
      }

      if (type === "script") {
        compiledRequest = compileGenerationRequest({
          medium: "script",
          prompt,
          provider: providerOverride ?? "openai",
          storyBible,
          sourceKind,
          referenceSummary,
        });
        finalPrompt = compiledRequest.prompt;
      }

      if (type === "voice") {
        compiledRequest = compileGenerationRequest({
          medium: "voice",
          prompt,
          provider: providerOverride ?? "openai",
          storyBible,
          sourceKind,
          referenceSummary,
        });
        finalPrompt = compiledRequest.prompt;
      }
    }

    const executionPrompt = mediaPlan
      ? [finalPrompt, mediaPlan.finalPrompt].filter(Boolean).join("\n\n")
      : finalPrompt;

    const imageProvider = providerOverride || "openai";
    if (type === "image" && !bypassCompiler && imageProvider === "openai") {
      const enforced = await generateEnforcedImage({
        prompt: executionPrompt,
        apiKey: OPENAI_API_KEY!,
        workspaceId: selection.current.workspace.id,
        mode: "images",
        realismMode: payload?.realismMode === "premium_commercial" ? "premium_commercial" : "strict_everyday",
        aspectRatio: (payload?.aspectRatio ?? "16:9"),
      });
      payload.status = "completed";
      generationStatus = "completed";
      outputUrl = enforced.outputUrl;
      responseText = null;
      finalPrompt = enforced.finalPrompt;
    } else {
      const generationResult = await generateContent(type as GenerationType, {
        prompt: executionPrompt,
        aspectRatio: payload?.aspectRatio,
        duration: payload?.duration,
        quality: payload?.quality,
        style: providerOverride ?? payload?.style,  // pass provider as style hint
        imageUrl: typeof payload?.imageUrl === "string" ? payload.imageUrl : undefined,
        callBackUrl: typeof payload?.callBackUrl === "string" ? payload.callBackUrl : undefined,
        mode: typeof payload?.mode === "string" ? payload.mode as "standard" | "pro" : "standard",
        model: typeof payload?.model === "string" ? payload.model : undefined,
      }, providerOverride ?? undefined);

      payload.status = generationResult.status;
      generationStatus = generationResult.status;
      if (generationResult.outputUrl) {
        outputUrl = generationResult.outputUrl;
      }
      if (generationResult.externalId) {
        externalId = generationResult.externalId;
      }
      if (generationResult.responseText) {
        responseText = generationResult.responseText;
      }
    }

    // ── Upload image to Supabase Storage (non-blocking) ───────────────
    // Fire-and-forget: upload runs after response is returned so the client
    // gets status="completed" + provider URL immediately without waiting.
    // The DB row is updated in the background once the upload finishes.
    if (type === "image" && generationStatus === "completed" && outputUrl) {
      const providerUrl = outputUrl; // capture before async closure
      const workspaceId = selection.current.workspace.id;
      const semanticChecksForInspect = compiledRequest?.semanticQaChecks ?? [];
      // Intentionally NOT awaited — background upload + semantic inspection
      void (async () => {
        let finalImageUrl = providerUrl;
        try {
          const supabaseUrl = await uploadImageToSupabase(providerUrl, workspaceId);
          await admin.from("generations").update({ output_url: supabaseUrl }).eq("output_url", providerUrl);
          console.log("[Storage] Image uploaded to Supabase:", supabaseUrl);
          finalImageUrl = supabaseUrl;
        } catch (uploadErr) {
          console.error("[Storage] Background upload failed — provider URL kept:", uploadErr);
        }
        // Post-generation semantic inspection — vision model checks subject/device/environment
        if (semanticChecksForInspect.length > 0) {
          try {
            const inspection = await inspectImageSemantics(finalImageUrl, semanticChecksForInspect);
            if (!inspection.skipped) {
              await admin.from("generations")
                .update({
                  metadata: {
                    semanticInspection: {
                      passed: inspection.passed,
                      flaggedForReview: inspection.flaggedForReview,
                      rejectReasons: inspection.rejectReasons,
                      warnReasons: inspection.warnReasons,
                      checks: inspection.checks,
                      skipped: false,
                      inspectedAt: new Date().toISOString(),
                    },
                  },
                })
                .eq("output_url", finalImageUrl);
              if (!inspection.passed) {
                console.warn("[SemanticQA] Image FAILED — reject reasons:", inspection.rejectReasons);
              } else {
                console.log("[SemanticQA] Image passed —", inspection.checks.length, "checks ok");
              }
            }
          } catch (inspectErr) {
            console.error("[SemanticQA] Inspection threw:", inspectErr);
          }
        }
      })();
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Generations] Generation failed:", errorMsg);
    payload.status = "failed";
    payload.generationError = errorMsg; // surfaced to client
  }

  const insertPayload = {
    user_id: user.id,
    workspace_id: selection.current.workspace.id,
    type,
    prompt: responseText ? responseText : (compiledRequest?.prompt ?? prompt), // Save compiled prompt for traceability
    title: typeof payload?.title === "string" ? payload.title : (compiledRequest?.continuityPlan?.continuityRequired ? "Locked continuity generation" : mediaPlan?.sourceMode === "story_to_video" ? "Story planned generation" : null),
    status: payload.status === "failed" ? "failed" : payload.status === "pending" ? "pending" : "completed",
    aspect_ratio:
      typeof payload?.aspectRatio === "string" ? payload.aspectRatio : null,
    duration: typeof payload?.duration === "string" ? payload.duration : null,
    quality: typeof payload?.quality === "string" ? payload.quality : null,
    style: typeof payload?.style === "string" ? payload.style : (compiledRequest?.realismPolicy?.headline ?? mediaPlan?.continuityProfile.cameraStyle ?? null),
    output_url: outputUrl,
    external_id: externalId,
    is_preview: typeof payload?.isPreview === "boolean" ? payload.isPreview : false,
    concept_id: typeof payload?.conceptId === "string" ? payload.conceptId : null,
    session_id: typeof payload?.sessionId === "string" ? payload.sessionId : null,
    provider: typeof payload?.provider === "string" ? payload.provider : (compiledRequest?.provider ?? (externalId?.startsWith("fal_queue:") ? "fal" : null)),
    mode: typeof payload?.mode === "string" ? payload.mode : "standard",
    cost_estimate: typeof payload?.costEstimate === "number" ? payload.costEstimate : null,
  };

  const { data, error } = await admin
    .from("generations")
    .insert(insertPayload)
    .select(
      "id, type, prompt, title, status, aspect_ratio, duration, quality, style, favorited, output_url, external_id, provider, model, progress, is_preview, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data.status === "failed") {
    return NextResponse.json({ data, planning: mediaPlan, error: payload.generationError ?? "Generation failed" });
  }
  return NextResponse.json({ data, planning: mediaPlan });
}
