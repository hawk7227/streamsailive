/**
 * copyValidator.ts
 *
 * Multi-layer copy validator.
 * Layers 1-6: deterministic (synchronous, no AI).
 * Layer 7: single AI call covering implied claims, proof type alignment, and tone.
 *
 * Rule: Layer 1 always runs first. A block from Layer 1 cannot be overridden
 * by any downstream layer. Layers 2-6 still run to collect full diagnostics.
 */

import type { ActiveGovernance } from '@/lib/pipeline/governance'
import type { IntakeBrief } from './intakeGate'
import {
  scanBannedPhrases,
  checkFieldLengths,
  checkGrammarAndSpelling,
  checkApprovedFactsAlignment,
  checkDisclaimerCompliance,
  checkVariantDifferentiation,
  type CopyOutput,
  type BannedPhraseResult,
  type FieldLengthResult,
  type GrammarResult,
  type FactsAlignmentResult,
  type DisclaimerResult,
  type DifferentiationResult,
} from './deterministicChecks'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ValidatorStatus = 'pass' | 'softFail' | 'block'

export interface ImpliedClaimResult {
  passed: boolean
  impliedClaims: string[]
  analysisNote: string
}

export interface ProofTypeResult {
  passed: boolean
  detectedProofType: string
  allowedProofType: string
  conflict: boolean
  details: string
}

export interface ToneResult {
  passed: boolean
  variantTones: Array<{ variantId: string; tone: string; aligned: boolean }>
  overallConsistent: boolean
  issues: string[]
}

export interface Layer7AiResult {
  impliedClaims: ImpliedClaimResult
  proofTypeAlignment: ProofTypeResult
  toneConsistency: ToneResult
  rawAiResponse: string
}

export interface ValidatorOutput {
  status: ValidatorStatus
  layer1BannedPhrases: BannedPhraseResult
  layer2FieldLengths: FieldLengthResult
  layer3Grammar: GrammarResult
  layer4FactsAlignment: FactsAlignmentResult
  layer5Disclaimer: DisclaimerResult
  layer6Differentiation: DifferentiationResult
  layer7Ai: Layer7AiResult | null   // null if blocked before Layer 7
  blockReasons: string[]
  softFailReasons: string[]
  warnings: string[]
  checkedAt: string
}

export interface ValidatorInput {
  copy: CopyOutput
  governance: ActiveGovernance
  intakeBrief: IntakeBrief
  strategyOutput?: string           // optional — injected if available
}

// ─── Layer 7 AI call ─────────────────────────────────────────────────────────

async function runLayer7AiChecks(
  copy: CopyOutput,
  governance: ActiveGovernance,
  intakeBrief: IntakeBrief,
  strategyOutput?: string
): Promise<Layer7AiResult> {
  const copyText = copy.variants
    .map(v =>
      `VARIANT ${v.id}:\nHeadline: ${v.headline}\nSubheadline: ${v.subheadline}\nBullets: ${v.bullets.join(' | ')}\nCTA: ${v.cta}\nMicrocopy: ${v.microcopy}\nDisclaimer: ${v.disclaimer}`
    )
    .join('\n\n')

  const prompt = [
    `You are a strict telehealth advertising compliance analyst.`,
    ``,
    `Evaluate the following copy against three criteria and return ONLY valid JSON.`,
    ``,
    `GOVERNANCE CONTEXT:`,
    `Brand tone: ${governance.brandTone}`,
    `Allowed proof type: ${intakeBrief.proofTypeAllowed}`,
    `Approved facts: ${governance.approvedFacts.join('; ')}`,
    strategyOutput ? `Active strategy: ${strategyOutput.slice(0, 500)}` : '',
    ``,
    `COPY TO EVALUATE:`,
    copyText,
    ``,
    `Return this exact JSON structure (no markdown, no preamble):`,
    `{`,
    `  "impliedClaims": {`,
    `    "passed": boolean,`,
    `    "impliedClaims": string[],`,
    `    "analysisNote": string`,
    `  },`,
    `  "proofTypeAlignment": {`,
    `    "passed": boolean,`,
    `    "detectedProofType": string,`,
    `    "allowedProofType": "${intakeBrief.proofTypeAllowed}",`,
    `    "conflict": boolean,`,
    `    "details": string`,
    `  },`,
    `  "toneConsistency": {`,
    `    "passed": boolean,`,
    `    "variantTones": [{"variantId": string, "tone": string, "aligned": boolean}],`,
    `    "overallConsistent": boolean,`,
    `    "issues": string[]`,
    `  }`,
    `}`,
    ``,
    `RULES:`,
    `- impliedClaims: flag language that implies guaranteed outcomes, speed, or diagnostic certainty without stating them explicitly`,
    `- proofTypeAlignment: check if copy uses the allowed proof type only ("${intakeBrief.proofTypeAllowed}")`,
    `- toneConsistency: check all 3 variants match the brand tone (${governance.brandTone.slice(0, 100)})`,
  ].filter(Boolean).join('\n')

  try {
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'script',
        prompt,
        temperature: 0.1,   // very low — this is a compliance judgment call
      }),
    })

    const data = await response.json() as { responseText?: string; error?: string }
    const raw = data.responseText ?? ''

    // Strip markdown fences if present
    const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()

    let parsed: {
      impliedClaims?: Partial<ImpliedClaimResult>
      proofTypeAlignment?: Partial<ProofTypeResult>
      toneConsistency?: Partial<ToneResult>
    }

    try {
      parsed = JSON.parse(clean)
    } catch {
      // AI returned non-JSON — treat as worst case (block-safe defaults)
      return {
        impliedClaims: { passed: false, impliedClaims: [], analysisNote: 'AI parse error — manual review required' },
        proofTypeAlignment: { passed: false, detectedProofType: 'unknown', allowedProofType: intakeBrief.proofTypeAllowed, conflict: true, details: 'AI parse error' },
        toneConsistency: { passed: false, variantTones: [], overallConsistent: false, issues: ['AI parse error — manual review required'] },
        rawAiResponse: raw,
      }
    }

    return {
      impliedClaims: {
        passed: parsed.impliedClaims?.passed ?? false,
        impliedClaims: parsed.impliedClaims?.impliedClaims ?? [],
        analysisNote: parsed.impliedClaims?.analysisNote ?? '',
      },
      proofTypeAlignment: {
        passed: parsed.proofTypeAlignment?.passed ?? false,
        detectedProofType: parsed.proofTypeAlignment?.detectedProofType ?? 'unknown',
        allowedProofType: intakeBrief.proofTypeAllowed,
        conflict: parsed.proofTypeAlignment?.conflict ?? true,
        details: parsed.proofTypeAlignment?.details ?? '',
      },
      toneConsistency: {
        passed: parsed.toneConsistency?.passed ?? false,
        variantTones: parsed.toneConsistency?.variantTones ?? [],
        overallConsistent: parsed.toneConsistency?.overallConsistent ?? false,
        issues: parsed.toneConsistency?.issues ?? [],
      },
      rawAiResponse: raw,
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    return {
      impliedClaims: { passed: false, impliedClaims: [], analysisNote: `Network error: ${errMsg}` },
      proofTypeAlignment: { passed: false, detectedProofType: 'unknown', allowedProofType: intakeBrief.proofTypeAllowed, conflict: true, details: `Network error: ${errMsg}` },
      toneConsistency: { passed: false, variantTones: [], overallConsistent: false, issues: [`Network error: ${errMsg}`] },
      rawAiResponse: '',
    }
  }
}

// ─── Main validator ───────────────────────────────────────────────────────────

/**
 * Runs all 7 validation layers against copy.
 * Returns full ValidatorOutput with per-layer results and aggregate status.
 *
 * Layer 1 block = final status is 'block' regardless of other layers.
 * Layer 4 blocked claims = final status is 'block'.
 * Any other layer fail = 'softFail' (retryable).
 * All layers pass = 'pass'.
 */
export async function validateCopy(input: ValidatorInput): Promise<ValidatorOutput> {
  const { copy, governance, intakeBrief, strategyOutput } = input
  const blockReasons: string[] = []
  const softFailReasons: string[] = []
  const warnings: string[] = []

  // ── Layer 1: Banned phrase scan (deterministic) ────────────────────────────
  const layer1 = scanBannedPhrases(copy, governance.bannedPhrases)
  if (!layer1.passed) {
    for (const hit of layer1.hits) {
      blockReasons.push(
        `Banned phrase "${hit.phrase}" found in variant ${hit.variantId} field "${hit.field}"`
      )
    }
  }

  // ── Layer 2: Field lengths (deterministic) ────────────────────────────────
  const rawLimits = governance.enforcementConfig.fieldLengthEnforcement
  const limits = {
    headlineMaxWords: rawLimits["headlineMaxWords"] ?? 8,
    subheadlineMaxWords: rawLimits["subheadlineMaxWords"] ?? 20,
    bulletMaxCount: rawLimits["bulletMaxCount"] ?? 3,
    bulletMaxWords: rawLimits["bulletMaxWords"] ?? 8,
    ctaMaxWords: rawLimits["ctaMaxWords"] ?? 4,
    microcopyMaxWords: rawLimits["microcopyMaxWords"] ?? 12,
    disclaimerMaxWords: rawLimits["disclaimerMaxWords"] ?? 18,
  }
  const layer2 = checkFieldLengths(copy, limits)
  if (!layer2.passed) {
    for (const v of layer2.violations) {
      softFailReasons.push(
        `Field length violation: variant ${v.variantId} "${v.field}" — ${v.actual} ${v.type} (limit: ${v.limit})`
      )
    }
  }

  // ── Layer 3: Grammar & spelling (deterministic) ───────────────────────────
  const layer3 = checkGrammarAndSpelling(copy)
  if (!layer3.passed) {
    for (const issue of layer3.issues) {
      if (issue.issue === 'urgency guarantee language') {
        blockReasons.push(
          `Urgency/guarantee language in variant ${issue.variantId} "${issue.field}": "${issue.found}"`
        )
      } else {
        softFailReasons.push(
          `Grammar issue in variant ${issue.variantId} "${issue.field}": ${issue.issue} — found "${issue.found}", suggestion: ${issue.suggestion}`
        )
      }
    }
  }

  // ── Layer 4: Approved facts alignment (deterministic) ─────────────────────
  const layer4 = checkApprovedFactsAlignment(copy, intakeBrief.approvedFacts)
  if (!layer4.passed) {
    for (const b of layer4.blocked) {
      blockReasons.push(
        `Always-blocked claim in variant ${b.variantId} "${b.field}": "${b.claim}" — ${b.reason}`
      )
    }
    for (const u of layer4.unverified) {
      softFailReasons.push(
        `Unverified claim in variant ${u.variantId} "${u.field}": "${u.claim}" — ${u.reason}`
      )
    }
  }

  // ── Layer 5: Disclaimer compliance (deterministic) ────────────────────────
  const layer5 = checkDisclaimerCompliance(copy)
  if (!layer5.passed) {
    for (const issue of layer5.issues) {
      softFailReasons.push(issue)
    }
  }

  // ── Layer 6: Variant differentiation (deterministic) ─────────────────────
  const layer6 = checkVariantDifferentiation(copy)
  if (!layer6.passed) {
    if (layer6.missingAngles.length > 0) {
      softFailReasons.push(
        `Missing objection angles: ${layer6.missingAngles.join(', ')}. Each variant must address a distinct angle (access, trust, value).`
      )
    }
    if (layer6.duplicateAngles.length > 0) {
      warnings.push(
        `Duplicate objection angles detected: ${layer6.duplicateAngles.join(', ')}. Variants may be too similar.`
      )
    }
  }

  // ── Layer 7: AI — implied claims, proof type, tone (one call) ────────────
  // Skip Layer 7 if already blocked — save API cost, result won't change status
  let layer7: Layer7AiResult | null = null

  if (blockReasons.length === 0) {
    layer7 = await runLayer7AiChecks(copy, governance, intakeBrief, strategyOutput)

    if (layer7.impliedClaims && !layer7.impliedClaims.passed) {
      softFailReasons.push(
        `Implied claims detected: ${layer7.impliedClaims.impliedClaims.join('; ')}`
      )
    }
    if (layer7.proofTypeAlignment && !layer7.proofTypeAlignment.passed && layer7.proofTypeAlignment.conflict) {
      softFailReasons.push(
        `Proof type conflict: detected "${layer7.proofTypeAlignment.detectedProofType}" but only "${intakeBrief.proofTypeAllowed}" is allowed`
      )
    }
    if (layer7.toneConsistency && !layer7.toneConsistency.passed) {
      for (const issue of layer7.toneConsistency.issues) {
        warnings.push(`Tone: ${issue}`)
      }
    }
  }

  // ── Aggregate status ──────────────────────────────────────────────────────
  let status: ValidatorStatus = 'pass'
  if (blockReasons.length > 0) status = 'block'
  else if (softFailReasons.length > 0) status = 'softFail'

  return {
    status,
    layer1BannedPhrases: layer1,
    layer2FieldLengths: layer2,
    layer3Grammar: layer3,
    layer4FactsAlignment: layer4,
    layer5Disclaimer: layer5,
    layer6Differentiation: layer6,
    layer7Ai: layer7,
    blockReasons,
    softFailReasons,
    warnings,
    checkedAt: new Date().toISOString(),
  }
}
