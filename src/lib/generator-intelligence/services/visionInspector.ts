/**
 * visionInspector.ts
 *
 * Post-generation semantic inspector.
 * Calls GPT-4o vision with the compiled SemanticQaChecks and returns a
 * structured pass/fail result per check.
 *
 * Designed to run non-blocking after generation completes.
 * Never delays the generation response to the client.
 */

import type { SemanticQaCheck } from "../types";

export interface SemanticInspectionResult {
  passed: boolean;                    // true only if ALL rejectOnMismatch checks passed
  checks: SemanticCheckResult[];
  flaggedForReview: boolean;          // true if any check failed (including warn-only)
  rejectReasons: string[];            // rejectOnMismatch failures only
  warnReasons: string[];              // rejectOnMismatch=false failures
  rawVisionResponse: string;          // full model output for traceability
  skipped: boolean;                   // true if OPENAI_API_KEY missing or imageUrl invalid
  skipReason?: string;
}

export interface SemanticCheckResult {
  label: string;
  expected: string;
  rejectOnMismatch: boolean;
  passed: boolean;
  confidence: "high" | "medium" | "low";
  note: string;
}

function buildInspectionPrompt(checks: SemanticQaCheck[]): string {
  const checkLines = checks.map((c, i) =>
    `CHECK_${i + 1}: label="${c.label}", expected="${c.expected}", rejectOnMismatch=${c.rejectOnMismatch}`
  ).join("\n");

  return [
    "You are a semantic image inspector. Analyze the image and answer each check below.",
    "Return ONLY valid JSON — no preamble, no markdown, no explanation outside the JSON.",
    "",
    "CHECKS:",
    checkLines,
    "",
    'Return JSON: { "checks": [ { "label": "...", "expected": "...", "passed": boolean, "confidence": "high"|"medium"|"low", "note": "one sentence" } ] }',
    "Rules:",
    "- passed=true only if the image clearly contains what is expected",
    "- confidence reflects how certain you are",
    "- note must be a single concrete observation about what you saw",
    "- Do not guess. If you cannot determine, set passed=false, confidence=low",
  ].join("\n");
}

export async function inspectImageSemantics(
  imageUrl: string,
  checks: SemanticQaCheck[],
): Promise<SemanticInspectionResult> {
  const empty: SemanticInspectionResult = {
    passed: true,
    checks: [],
    flaggedForReview: false,
    rejectReasons: [],
    warnReasons: [],
    rawVisionResponse: "",
    skipped: true,
  };

  if (!checks.length) return empty;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ...empty, skipReason: "OPENAI_API_KEY not set" };
  }

  if (!imageUrl || !imageUrl.startsWith("http")) {
    return { ...empty, skipReason: "Invalid image URL" };
  }

  let rawVisionResponse = "";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "low" },
              },
              {
                type: "text",
                text: buildInspectionPrompt(checks),
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      return { ...empty, skipReason: `Vision API error ${res.status}: ${err.slice(0, 120)}` };
    }

    const payload = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    rawVisionResponse = payload.choices?.[0]?.message?.content?.trim() ?? "";

    if (!rawVisionResponse) {
      return { ...empty, skipReason: "Empty vision response" };
    }

    const parsed = JSON.parse(rawVisionResponse) as {
      checks?: Array<{
        label?: string;
        expected?: string;
        passed?: boolean;
        confidence?: string;
        note?: string;
      }>;
    };

    const checkResults: SemanticCheckResult[] = (parsed.checks ?? []).map((c, i) => {
      const original = checks[i];
      return {
        label: original?.label ?? c.label ?? "unknown",
        expected: original?.expected ?? c.expected ?? "",
        rejectOnMismatch: original?.rejectOnMismatch ?? false,
        passed: c.passed === true,
        confidence: (c.confidence as "high" | "medium" | "low") ?? "low",
        note: c.note ?? "",
      };
    });

    const rejectReasons = checkResults
      .filter(c => !c.passed && c.rejectOnMismatch)
      .map(c => `${c.label}: expected "${c.expected}" — ${c.note}`);

    const warnReasons = checkResults
      .filter(c => !c.passed && !c.rejectOnMismatch)
      .map(c => `${c.label}: expected "${c.expected}" — ${c.note}`);

    return {
      passed: rejectReasons.length === 0,
      checks: checkResults,
      flaggedForReview: checkResults.some(c => !c.passed),
      rejectReasons,
      warnReasons,
      rawVisionResponse,
      skipped: false,
    };
  } catch (err) {
    return {
      ...empty,
      skipReason: err instanceof Error ? err.message : "Inspection threw",
      rawVisionResponse,
    };
  }
}
