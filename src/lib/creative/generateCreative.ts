/**
 * generateCreative.ts
 *
 * AI-generated creative concepts driven entirely by intake brief.
 * No hardcoded angles, subjects, actions, environments, or copy.
 * Replaces createStrategyFromIntake() from telehealth.ts.
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

function buildOverlayIntent(concept: RawConcept): OverlayIntent {
  return {
    headline: concept.headline,
    cta: concept.cta,
    disclaimer: "",
    textDensityHint: "medium",
    titleLengthClass: concept.headline.split(" ").length <= 4 ? "short" : concept.headline.split(" ").length <= 7 ? "medium" : "long",
    ctaLengthClass: concept.cta.split(" ").length <= 2 ? "short" : "medium",
  };
}

function toRealismMode(raw: string | undefined): RealismMode {
  const modes: RealismMode[] = ["human_lifestyle_real", "clinical_real", "workspace_real", "product_in_use_real", "home_real"];
  return modes.find(m => m === raw) ?? "human_lifestyle_real";
}

function toSubjectType(raw: string): SubjectType {
  const types: SubjectType[] = ["person", "patient", "doctor", "provider", "caregiver", "product"];
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

Generate exactly 3 distinct creative concepts. Each concept must be a realistic, believable scenario — not stylized, not cinematic, not abstract.

Return ONLY valid JSON in this exact shape, no markdown, no preamble:
{
  "strategySummary": "one sentence describing the campaign direction",
  "concepts": [
    {
      "angle": "the strategic angle in 3-5 words",
      "subject": "who is in the scene (e.g. person, woman in 30s, professional)",
      "action": "what they are doing right now — specific, grounded, ordinary",
      "environment": "where they are — real, lived-in, believable",
      "mood": "how the scene feels — 3 words max",
      "headline": "ad headline — direct, human, no fluff, max 8 words",
      "cta": "call to action — max 4 words",
      "realismMode": "one of: human_lifestyle_real | clinical_real | workspace_real | product_in_use_real | home_real"
    }
  ]
}

Rules:
- Each concept must be visually distinct from the others
- No cinematic language, no premium language, no abstract ideas
- Actions must be specific and ordinary (not "using technology" — say "scrolling through their phone")
- Environments must be real places (not "modern space" — say "kitchen table with coffee cup")
- Headline and CTA must sound like a real human wrote them, not an AI
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
  const raw = JSON.parse(data.choices[0].message.content) as { strategySummary: string; concepts: RawConcept[] };

  const conceptDirections: ConceptDirection[] = raw.concepts.map((c, i) => ({
    id: `concept-${i + 1}`,
    angle: c.angle,
    hook: intake.campaignObjective,
    subjectType: toSubjectType(c.subject),
    action: c.action,
    environment: c.environment,
    realismMode: toRealismMode(c.realismMode),
    desiredMood: c.mood,
    overlayIntent: buildOverlayIntent(c),
  }));

  return {
    runId: crypto.randomUUID(),
    strategySummary: raw.strategySummary,
    conceptDirections,
    rulesetVersion: REALISM_RULESET_VERSION,
  };
}
