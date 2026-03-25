/**
 * generateCopy.ts
 *
 * AI-generated copy per concept.
 * Replaces handleCopy's mechanical field extraction.
 */

import type { ConceptDirection, CopyGenerationOutput, CopyVariant } from "../media-realism/types";

export async function generateCopy(conceptDirections: ConceptDirection[]): Promise<CopyGenerationOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const variants = await Promise.all(
    conceptDirections.map(concept => generateVariant(concept, apiKey))
  );

  return { variants };
}

async function generateVariant(concept: ConceptDirection, apiKey: string): Promise<CopyVariant> {
  const prompt = `Write ad copy for this creative concept:

Concept angle: ${concept.angle}
Subject: ${concept.subjectType}
Action: ${concept.action}
Environment: ${concept.environment}
Mood: ${concept.desiredMood}
Existing headline: ${concept.overlayIntent.headline}
Existing CTA: ${concept.overlayIntent.cta}

Return ONLY valid JSON, no markdown:
{
  "headline": "final headline — direct, human, max 8 words",
  "subheadline": "supporting line — adds context, max 12 words",
  "bullets": ["benefit 1 — concrete, max 8 words", "benefit 2 — concrete, max 8 words", "benefit 3 — concrete, max 8 words"],
  "cta": "call to action — max 4 words"
}

Rules:
- No fluff words (powerful, seamless, revolutionary, game-changing)
- No repetition between headline and subheadline
- Bullets must be benefits, not features
- Human tone — sounds like a real person wrote it`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Copy generation failed for ${concept.id} (${response.status}): ${err}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  const raw = JSON.parse(data.choices[0].message.content) as {
    headline: string;
    subheadline: string;
    bullets: string[];
    cta: string;
  };

  return {
    conceptId: concept.id,
    headline: raw.headline,
    subheadline: raw.subheadline,
    bullets: raw.bullets,
    cta: raw.cta,
    disclaimer: concept.overlayIntent.disclaimer ?? "",
  };
}
