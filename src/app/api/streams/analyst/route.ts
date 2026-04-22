/**
 * POST /api/streams/analyst
 *
 * Prompt pre-flight analyst — optional, not a gate.
 * Costs ~$0.002 per call (GPT-4o mini). Returns structured JSON analysis.
 *
 * Input: { prompt, mode, model? }
 * Output: {
 *   interpretation: string,      — what the model will likely generate
 *   ambiguities: string[],        — unclear or underspecified parts
 *   improvements: string[],       — specific rewrites to increase quality
 *   bestModel: string,            — recommended model for this intent
 *   estimatedCostBefore: number,  — USD at current settings
 *   estimatedCostAfter: number,   — USD with recommended model
 *   failurePatterns: string[],    — known failure modes for this prompt type
 *   improvedPrompt: string,       — rewritten prompt applying all improvements
 * }
 *
 * Per-model knowledge baked in:
 *   Kling v3/O3: directorial language, no floating feet, no face morphing
 *   Veo 3.1: precise instructional prompts, surgical composition
 *   FLUX Kontext: multi-reference workflow, edit vs regenerate
 *   ElevenLabs v3: [excited][whispers] emotion tags, stability values
 *   MiniMax Music: two-prompt rule (style vs lyrics), structure tags
 *   OmniHuman: face reference quality requirements
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { OPENAI_API_KEY } from "@/lib/env";

export const maxDuration = 30;

// Cost table (USD) — used in analyst recommendations
const COST_TABLE: Record<string, number> = {
  "Standard":   0.28,  // Kling v3 std · 5s
  "Pro":        0.56,  // Kling v3 pro · 5s
  "Precision":  0.56,  // Kling O3 · 5s
  "Cinema":     0.40,  // Veo 3.1 · 5s
  "Kontext":    0.04,  // FLUX Kontext · 1 image
  "Design":     0.08,  // Recraft V4 · 1 image
  "Voice v3":   0.10,  // ElevenLabs v3 · 1K chars
  "Music":      0.15,  // MiniMax v2.6 · 1 gen
};

const SYSTEM_PROMPT = `You are a prompt analyst for an AI generation platform.
Analyze the provided prompt and return ONLY valid JSON (no markdown, no fences):
{
  "interpretation": "string — what the model will likely generate from this prompt",
  "ambiguities": ["array of unclear or underspecified parts"],
  "improvements": ["array of specific, actionable rewrites to increase output quality"],
  "bestModel": "string — one of: Standard, Pro, Precision, Cinema, Kontext, Design, Voice v3, Music",
  "failurePatterns": ["array of known failure modes for this prompt type and model"],
  "improvedPrompt": "string — complete rewritten prompt applying all improvements"
}

Per-model knowledge:
T2V (Standard/Pro/Precision/Cinema): Use directorial language. Camera behavior FIRST, then scene, subject, lighting, temporal flow. Fix floating feet: anchor to physical objects. Fix face morphing: add 'stable face, consistent features' to negative. Specific > vague: 'golden hour backlight catching dust particles' not 'nice lighting'.
I2V: Prompt describes MOTION only — never re-describe the subject (image already defines it).
Motion Control: Prompt describes CHARACTER APPEARANCE only — motion comes from reference video.
Image (Kontext): Kontext excels at editing existing images. If user has an existing image, suggest Kontext edit over full regeneration (4x cheaper).
Voice (Voice v3): Suggest [excited] [whispers] [sighs] tags for emotional content. stability 0.30 for musical/expressive, 0.50 for consistent narration.
Music: ENFORCE two-prompt rule: style prompt = genre/mood/BPM/key ONLY. lyrics = words + [Verse][Chorus] tags ONLY. Never put lyrics in style prompt.`;

type RequestBody = {
  prompt:  string;
  mode:    string;
  model?:  string;
};

interface AnalystResult {
  interpretation:       string;
  ambiguities:          string[];
  improvements:         string[];
  bestModel:            string;
  failurePatterns:      string[];
  improvedPrompt:       string;
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = raw as RequestBody;
  if (!body.prompt?.trim()) return NextResponse.json({ error: "prompt required" }, { status: 400 });
  if (!body.mode?.trim())   return NextResponse.json({ error: "mode required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = sel.current.workspace.id;
  } catch {
    return NextResponse.json({ error: "Could not resolve workspace" }, { status: 500 });
  }

  const userMessage = `Mode: ${body.mode}${body.model ? ` | Model: ${body.model}` : ""}
Prompt: ${body.prompt.trim()}`;

  let result: AnalystResult;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 800,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: userMessage },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json() as { choices: { message: { content: string } }[] };
    const cleaned = (data.choices?.[0]?.message?.content ?? "{}").replace(/```json|```/g, "").trim();
    result = JSON.parse(cleaned) as AnalystResult;
  } catch (err) {
    return NextResponse.json({ error: `Analysis failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  // Compute cost estimates
  const currentModel   = body.model ?? "Standard";
  const recommendedModel = result.bestModel ?? currentModel;
  const costBefore = COST_TABLE[currentModel]   ?? 0.28;
  const costAfter  = COST_TABLE[recommendedModel] ?? costBefore;

  // Store in analyst_sessions
  const sessionId = crypto.randomUUID();
  await admin.from("analyst_sessions").insert({
    id:            sessionId,
    workspace_id:  workspaceId,
    mode:          body.mode,
    input_prompt:  body.prompt,
    analysis:      result,
    model_recommendation: recommendedModel,
    cost_before_usd: costBefore,
    cost_after_usd:  costAfter,
  }).catch(() => {/* non-fatal if analyst_sessions table not yet created */});

  return NextResponse.json({
    sessionId,
    ...result,
    estimatedCostBefore: costBefore,
    estimatedCostAfter:  costAfter,
    savingsUsd: Math.max(0, costBefore - costAfter),
  });
}
