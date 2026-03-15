import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { generateContent } from "@/lib/ai";
import { GenerationType } from "@/lib/ai/types";
import { uploadImageToSupabase } from "@/lib/supabase/storage";

const allowedTypes: GenerationType[] = ["video", "image", "script", "voice"];

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
      "id, type, prompt, title, status, aspect_ratio, duration, quality, style, favorited, output_url, external_id, progress, is_preview, created_at"
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

  try {
    const generationResult = await generateContent(type as GenerationType, {
      prompt,
      aspectRatio: payload?.aspectRatio,
      duration: payload?.duration,
      quality: payload?.quality,
      style: payload?.style,
    });

    payload.status = generationResult.status;
    if (generationResult.outputUrl) {
      outputUrl = generationResult.outputUrl;
    }
    if (generationResult.externalId) {
      externalId = generationResult.externalId;
    }
    if (generationResult.responseText) {
      responseText = generationResult.responseText;
    }

    // ── Upload image to Supabase Storage ───────────────────────────────
    // If the generation is a completed image, upload it from the provider
    // URL / base64 to our own Supabase bucket so the URL never expires.
    if (type === "image" && generationResult.status === "completed" && outputUrl) {
      try {
        const workspaceId = selection.current.workspace.id;
        const supabaseUrl = await uploadImageToSupabase(outputUrl, workspaceId);
        outputUrl = supabaseUrl;
        console.log("[Storage] Image uploaded to Supabase:", supabaseUrl);
      } catch (uploadErr) {
        // Non-fatal: keep provider URL if upload fails
        console.error("[Storage] Failed to upload image to Supabase Storage:", uploadErr);
      }
    }

  } catch (error) {
    console.error("Error generating content:", error);
    // Continue saving the generation as 'failed' or 'pending' depending on preference
    // We will save it as 'failed' if an error occurred in generation.
    payload.status = "failed";
  }

  const insertPayload = {
    user_id: user.id,
    workspace_id: selection.current.workspace.id,
    type,
    prompt: responseText ? responseText : prompt, // Save the generated script text in prompt column if script
    title: typeof payload?.title === "string" ? payload.title : null,
    status: payload.status === "failed" ? "failed" : payload.status === "pending" ? "pending" : "completed",
    aspect_ratio:
      typeof payload?.aspectRatio === "string" ? payload.aspectRatio : null,
    duration: typeof payload?.duration === "string" ? payload.duration : null,
    quality: typeof payload?.quality === "string" ? payload.quality : null,
    style: typeof payload?.style === "string" ? payload.style : null,
    output_url: outputUrl,
    external_id: externalId,
    is_preview: typeof payload?.isPreview === "boolean" ? payload.isPreview : false,
  };

  const { data, error } = await admin
    .from("generations")
    .insert(insertPayload)
    .select(
      "id, type, prompt, title, status, aspect_ratio, duration, quality, style, favorited, output_url, external_id, progress, is_preview, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
