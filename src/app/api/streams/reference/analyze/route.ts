/**
 * POST /api/streams/reference/analyze
 *
 * Analyzes an image or video reference using GPT-4o Vision.
 * Returns structured analysis: color palette, lighting, composition,
 * camera, style tags, subjects, reconstruction prompt, variation prompts.
 *
 * YouTube source is BLOCKED here — must go via worker (60–90s, not HTTP).
 * YouTube source returns 422 with a clear error message.
 *
 * Flow:
 *   1. Validate body: { sourceType, sourceUrl }
 *   2. Auth + workspace
 *   3. Insert reference_analyses row (status: pending)
 *   4. Fetch image (for upload/url sources)
 *   5. Call GPT-4o Vision with structured analysis prompt
 *   6. Parse structured JSON response
 *   7. Update reference_analyses row (status: done)
 *   8. Return analysis
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { OPENAI_API_KEY } from "@/lib/env";

export const maxDuration = 60;

// ─── GPT-4o Vision prompt ─────────────────────────────────────────────────────

const ANALYSIS_SYSTEM = `You are a professional visual analyst specializing in AI video and image generation.
Analyze the provided image in maximum detail and return ONLY valid JSON with this exact structure:
{
  "lighting": "string — direction, quality, color temperature, shadow description",
  "composition": "string — framing, focal point, depth of field, rule of thirds",
  "camera": "string — estimated lens, angle, motion blur, stabilization",
  "style": ["tag1", "tag2", ...],
  "subjects": ["description1", "description2", ...],
  "color_palette": ["#hexcode1", "#hexcode2", "#hexcode3", "#hexcode4", "#hexcode5"],
  "motion_summary": "string — camera movement, pacing, cuts (null for static images)",
  "reconstruction_prompt": "string — complete generation prompt that would recreate this image",
  "variation_prompts": [
    "prompt variant 1 — different angle or composition",
    "prompt variant 2 — different lighting or time of day",
    "prompt variant 3 — different mood or style treatment"
  ]
}
Do not include any text outside the JSON object. No markdown fences.`;

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceType = "upload" | "url" | "youtube";

type RequestBody = {
  sourceType: SourceType;
  sourceUrl:  string;
};

interface AnalysisResult {
  lighting:              string;
  composition:           string;
  camera:                string;
  style:                 string[];
  subjects:              string[];
  color_palette:         string[];
  motion_summary:        string | null;
  reconstruction_prompt: string;
  variation_prompts:     string[];
}

// ─── Helper: fetch image as base64 ───────────────────────────────────────────

async function fetchImageBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const arrayBuf = await res.arrayBuffer();
  // Use Uint8Array + btoa — works in both Node.js and Edge runtimes
  const uint8   = new Uint8Array(arrayBuf);
  let binary    = "";
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
  const base64  = btoa(binary);
  return { base64, mimeType: contentType.split(";")[0] };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Parse + validate
  let rawBody: unknown;
  try { rawBody = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = rawBody as Record<string, unknown>;

  if (!["upload", "url", "youtube"].includes(body.sourceType as string)) {
    return NextResponse.json({ error: "sourceType must be upload, url, or youtube" }, { status: 400 });
  }
  if (typeof body.sourceUrl !== "string" || !body.sourceUrl.trim()) {
    return NextResponse.json({ error: "sourceUrl is required" }, { status: 400 });
  }

  const sourceType = body.sourceType as SourceType;
  const sourceUrl  = (body.sourceUrl as string).trim();

  // YouTube blocked — must use worker
  if (sourceType === "youtube") {
    return NextResponse.json({
      error: "YouTube analysis requires a background worker (60–90s). Submit via /api/streams/reference/analyze-youtube instead.",
    }, { status: 422 });
  }

  // 2. Auth
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = sel.current.workspace.id;
  } catch {
    return NextResponse.json({ error: "Could not resolve workspace" }, { status: 500 });
  }

  // Check OpenAI key
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  // 3. Insert pending row
  const analysisId = crypto.randomUUID();
  await admin.from("reference_analyses").insert({
    id:          analysisId,
    workspace_id: workspaceId,
    source_type: sourceType,
    source_url:  sourceUrl,
    status:      "processing",
  });

  // 4. Fetch image
  let imageBase64: string;
  let mimeType: string;

  try {
    const result = await fetchImageBase64(sourceUrl);
    imageBase64 = result.base64;
    mimeType    = result.mimeType;
  } catch (err) {
    await admin.from("reference_analyses").update({ status: "failed" }).eq("id", analysisId);
    return NextResponse.json({
      error: `Could not fetch reference image: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 422 });
  }

  // 5. GPT-4o Vision call
  let analysis: AnalysisResult;
  try {
    const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1200,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" } },
            { type: "text",      text: ANALYSIS_SYSTEM },
          ],
        }],
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!visionRes.ok) {
      throw new Error(`OpenAI API ${visionRes.status}`);
    }

    const visionData = await visionRes.json() as { choices: { message: { content: string } }[] };
    const content    = visionData.choices?.[0]?.message?.content ?? "";
    const cleaned    = content.replace(/```json|```/g, "").trim();
    analysis         = JSON.parse(cleaned) as AnalysisResult;
  } catch (err) {
    await admin.from("reference_analyses").update({ status: "failed" }).eq("id", analysisId);
    return NextResponse.json({
      error: `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 500 });
  }

  // 7. Update row with results
  await admin.from("reference_analyses").update({
    status:               "done",
    color_palette:        analysis.color_palette   ?? [],
    lighting:             analysis.lighting        ?? "",
    composition:          analysis.composition     ?? "",
    camera_details:       analysis.camera          ?? "",
    style_tags:           analysis.style           ?? [],
    subjects:             analysis.subjects        ?? [],
    motion_summary:       analysis.motion_summary  ?? null,
    reconstruction_prompt: analysis.reconstruction_prompt ?? "",
    variation_prompts:    analysis.variation_prompts      ?? [],
  }).eq("id", analysisId);

  // 8. Return
  return NextResponse.json({
    analysisId,
    ...analysis,
    sourceUrl,
    sourceType,
  });
}
