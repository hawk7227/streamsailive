/**
 * intakeGate.ts
 *
 * The mandatory pre-pipeline gate.
 * No pipeline step can run until the intake brief is validated and the
 * governance ruleset version is locked for this run.
 *
 * Enforcement: executeNode() checks this before allowing creativeStrategy to proceed.
 */

import crypto from 'crypto'
import { loadGovernance } from '@/lib/pipeline/governance'

// ─── Types ───────────────────────────────────────────────────────────────────

export type TargetPlatform = 'meta' | 'google' | 'tiktok' | 'instagram' | 'organic'
export type FunnelStage = 'awareness' | 'consideration' | 'conversion'
export type ProofType = 'process-based' | 'social-proof' | 'outcome-based'

export interface IntakeBrief {
  targetPlatform: TargetPlatform
  audienceSegment: string       // min 20 chars — who specifically is this for
  funnelStage: FunnelStage
  campaignObjective: string     // min 10 chars — what this campaign must achieve
  proofTypeAllowed: ProofType   // what kind of proof can be used in copy
  brandVoiceStatement: string   // min 30 chars — what IS and IS NOT the brand voice
  approvedFacts: string[]       // min 3 entries — the only facts copy can assert
  governanceNicheId: string     // which ruleset: 'telehealth', 'google_ads', or custom id
}

export interface IntakeGateResult {
  passed: boolean
  missingFields: string[]
  validationErrors: string[]
  rulesetVersionLocked: string  // governance version locked at this intake
  lockedAt: string              // ISO timestamp
  intakeBriefId: string         // UUID — links all pipeline assets to this run
}

// ─── Validation ──────────────────────────────────────────────────────────────

const VALID_PLATFORMS: TargetPlatform[] = ['meta', 'google', 'tiktok', 'instagram', 'organic']
const VALID_FUNNEL_STAGES: FunnelStage[] = ['awareness', 'consideration', 'conversion']
const VALID_PROOF_TYPES: ProofType[] = ['process-based', 'social-proof', 'outcome-based']

/**
 * Validates the intake brief and locks the governance ruleset version.
 * Returns IntakeGateResult. If passed=false, pipeline CANNOT start.
 *
 * This is called once per pipeline run. The returned intakeBriefId
 * must be attached to every subsequent step's audit record.
 */
export function validateIntakeBrief(brief: Partial<IntakeBrief>): IntakeGateResult {
  const missingFields: string[] = []
  const validationErrors: string[] = []

  // Required field presence
  if (!brief.targetPlatform) missingFields.push('targetPlatform')
  if (!brief.audienceSegment) missingFields.push('audienceSegment')
  if (!brief.funnelStage) missingFields.push('funnelStage')
  if (!brief.campaignObjective) missingFields.push('campaignObjective')
  if (!brief.proofTypeAllowed) missingFields.push('proofTypeAllowed')
  if (!brief.brandVoiceStatement) missingFields.push('brandVoiceStatement')
  if (!brief.governanceNicheId) missingFields.push('governanceNicheId')
  if (!brief.approvedFacts) missingFields.push('approvedFacts')

  // Value validation (only if field is present)
  if (brief.targetPlatform && !VALID_PLATFORMS.includes(brief.targetPlatform)) {
    validationErrors.push(
      `targetPlatform "${brief.targetPlatform}" is not valid. Must be one of: ${VALID_PLATFORMS.join(', ')}`
    )
  }

  if (brief.funnelStage && !VALID_FUNNEL_STAGES.includes(brief.funnelStage)) {
    validationErrors.push(
      `funnelStage "${brief.funnelStage}" is not valid. Must be one of: ${VALID_FUNNEL_STAGES.join(', ')}`
    )
  }

  if (brief.proofTypeAllowed && !VALID_PROOF_TYPES.includes(brief.proofTypeAllowed)) {
    validationErrors.push(
      `proofTypeAllowed "${brief.proofTypeAllowed}" is not valid. Must be one of: ${VALID_PROOF_TYPES.join(', ')}`
    )
  }

  if (brief.audienceSegment && brief.audienceSegment.trim().length < 20) {
    validationErrors.push(
      `audienceSegment must be at least 20 characters. Received: ${brief.audienceSegment.trim().length} chars.`
    )
  }

  if (brief.campaignObjective && brief.campaignObjective.trim().length < 10) {
    validationErrors.push(
      `campaignObjective must be at least 10 characters. Received: ${brief.campaignObjective.trim().length} chars.`
    )
  }

  if (brief.brandVoiceStatement && brief.brandVoiceStatement.trim().length < 30) {
    validationErrors.push(
      `brandVoiceStatement must be at least 30 characters. Received: ${brief.brandVoiceStatement.trim().length} chars.`
    )
  }

  if (brief.approvedFacts) {
    if (!Array.isArray(brief.approvedFacts)) {
      validationErrors.push('approvedFacts must be an array')
    } else if (brief.approvedFacts.length < 3) {
      validationErrors.push(
        `approvedFacts requires at least 3 entries. Received: ${brief.approvedFacts.length}`
      )
    } else {
      const emptyFacts = brief.approvedFacts.filter(f => !f || f.trim().length < 5)
      if (emptyFacts.length > 0) {
        validationErrors.push(
          `${emptyFacts.length} approved fact(s) are empty or too short (min 5 chars each)`
        )
      }
    }
  }

  const passed = missingFields.length === 0 && validationErrors.length === 0

  // Lock governance version — even on failure, so the caller can see which ruleset was attempted
  let rulesetVersionLocked = 'unknown'
  if (brief.governanceNicheId) {
    try {
      const governance = loadGovernance(brief.governanceNicheId)
      rulesetVersionLocked = governance.rulesetVersion
    } catch {
      validationErrors.push(`Could not load governance for niche: ${brief.governanceNicheId}`)
    }
  }

  return {
    passed,
    missingFields,
    validationErrors,
    rulesetVersionLocked,
    lockedAt: new Date().toISOString(),
    intakeBriefId: crypto.randomUUID(),
  }
}

/**
 * Asserts that an intake gate result has passed.
 * Throws a structured error if not — this is the enforcement point
 * called by executeNode() before creativeStrategy runs.
 */
export function assertIntakePassed(gateResult: IntakeGateResult | undefined | null): void {
  if (!gateResult) {
    throw new Error(
      '[IntakeGate] No intake brief found. Pipeline cannot start. Complete the intake brief first.'
    )
  }
  if (!gateResult.passed) {
    const details = [
      gateResult.missingFields.length > 0
        ? `Missing fields: ${gateResult.missingFields.join(', ')}`
        : null,
      gateResult.validationErrors.length > 0
        ? `Validation errors: ${gateResult.validationErrors.join('; ')}`
        : null,
    ]
      .filter(Boolean)
      .join(' | ')

    throw new Error(`[IntakeGate] Intake brief failed validation. ${details}`)
  }
}

/**
 * Asserts that the governance ruleset version in the current context
 * matches what was locked at intake. Prevents mid-run governance drift.
 */
export function assertRulesetVersionMatch(
  gateResult: IntakeGateResult,
  currentRulesetVersion: string
): void {
  if (gateResult.rulesetVersionLocked !== currentRulesetVersion) {
    throw new Error(
      `[IntakeGate] Ruleset version mismatch. ` +
      `Locked at intake: "${gateResult.rulesetVersionLocked}". ` +
      `Current: "${currentRulesetVersion}". ` +
      `Governance was updated after this run started. Restart the pipeline.`
    )
  }
}
