/**
 * generateCreative.ts
 *
 * AI-generated creative concepts driven entirely by intake brief.
 * No hardcoded angles, subjects, actions, environments, or copy.
 */

import type {
  ConceptDirection,
  IntakeBrief,
  OverlayIntent,
  RealismMode,
  StrategyOutput,
  SubjectType,
} from "../media-realism/types";
import { REALISM_RULESET_VERSION } from "../media-realism/realismPolicy";

interface RawConcept {
  angle: string;
  subject: string;
  action: string;
  environment: string;
  mood: string;
  headline: string;
  cta: string;
  realismMode?: string;
}

function safeParseJson<T>(text: string): T {
  // Strip markdown code fences GPT-4o sometimes adds
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  return JSON.parse(stripped) as T;
}

function buildOverlayIntent(concept: RawConcept): OverlayIntent {
  const headlineWords = concept.headline.trim().split(/\s+/).length;
  const ctaWords = concept.cta.trim().split(/\s+/).length;
  return {
    headline: concept.headline,
    cta: concept.cta,
    disclaimer: "",
    textDensityHint: "medium",
    titleLengthClass: headlineWords <= 4 ? "short" : headlineWords <= 7 ? "medium" : "long",
    ctaLengthClass: ctaWords <= 2 ? "short" : "medium",
  };
}

function toRealismMode(raw: string | undefined): RealismMode {
  const modes: RealismMode[] = ["human_lifestyle_real", "clinical_real", "workspace_real", "product_in_use_real", "home_real"];
  return modes.find(m => m === raw) ?? "human_lifestyle_real";
}

function toSubjectType(raw: string): SubjectType {
  const types: SubjectType[] = ["patient", "doctor", "provider", "caregiver", "person"];
  const lower = raw.toLowerCase();
  return types.find(t => lower.includes(t)) ?? "person";
}

export async function generateCreative(intake: IntakeBrief): Promise<StrategyOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const prompt = `You are a creative director generating ad concepts.

Campaign objective: ${intake.campaignObjective}
Target audience: ${intake.audienceSegment}
Brand voice: ${intake.brandVoiceStatement}
Platform: ${intake.targetPlatform}
Funnel stage: ${intake.funnelStage}
Proof type: ${intake.proofTypeAllowed}
Approved facts: ${intake.approvedFacts.join("; ")}

Generate exactly 3 distinct creative concepts. Each must be a realistic, believable scenario.

Return ONLY valid JSON, no markdown fences, no preamble:
{
  "strategySummary": "one sentence describing the campaign direction",
  "concepts": [
    {
      "angle": "the strategic angle in 3-5 words",
      "subject": "who is in the scene",
      "action": "what they are doing right now — specific and ordinary",
      "environment": "where they are — real and lived-in",
      "mood": "how the scene feels — 3 words max",
      "headline": "ad headline — direct, human, max 8 words",
      "cta": "call to action — max 4 words",
      "realismMode": "one of: human_lifestyle_real | clinical_real | workspace_real | product_in_use_real | home_real"
    }
  ]
}

Rules:
- Each concept must be visually distinct
- No cinematic, premium, or abstract language
- Actions must be specific (not 'using technology' — say 'scrolling through notifications')
- Environments must be real places (not 'modern space' — say 'kitchen table with a coffee mug')
- Do not repeat the same subject type across all 3 concepts`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Creative generation failed (${response.status}): ${err}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("Creative generation returned empty response");

  let raw: { strategySummary: string; concepts: RawConcept[] };
  try {
    raw = safeParseJson(content);
  } catch {
    throw new Error(`Creative generation returned invalid JSON: ${content.slice(0, 200)}`);
  }

  if (!Array.isArray(raw.concepts) || raw.concepts.length === 0) {
    throw new Error("Creative generation returned no concepts");
  }

  const conceptDirections: ConceptDirection[] = raw.concepts.slice(0, 3).map((c, i) => ({
    id: `concept-${i + 1}`,
    angle: c.angle ?? `concept ${i + 1}`,
    hook: intake.campaignObjective,
    subjectType: toSubjectType(c.subject ?? ""),
    action: c.action ?? "using a device at home",
    environment: c.environment ?? "home",
    realismMode: toRealismMode(c.realismMode),
    desiredMood: c.mood ?? "calm, natural",
    overlayIntent: buildOverlayIntent({
      ...c,
      headline: c.headline ?? intake.campaignObjective.slice(0, 40),
      cta: c.cta ?? "Get started",
    }),
  }));

  return {
    runId: crypto.randomUUID(),
    strategySummary: raw.strategySummary ?? intake.campaignObjective,
    conceptDirections,
    rulesetVersion: REALISM_RULESET_VERSION,
  };
}
