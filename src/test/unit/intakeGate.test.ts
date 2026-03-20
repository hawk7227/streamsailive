/**
 * intakeGate.test.ts
 *
 * Tests the pre-pipeline intake gate.
 * Every required field, every validation rule, ruleset locking, and enforcement throws.
 */

import { describe, it, expect } from 'vitest'
import {
  validateIntakeBrief,
  assertIntakePassed,
  assertRulesetVersionMatch,
  type IntakeBrief,
} from '@/lib/pipeline/qc/intakeGate'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validBrief = (): IntakeBrief => ({
  targetPlatform: 'meta',
  audienceSegment: 'Adults 30-55 experiencing chronic conditions seeking convenient private care',
  funnelStage: 'consideration',
  campaignObjective: 'Drive first-visit bookings from mid-funnel warm audience',
  proofTypeAllowed: 'process-based',
  brandVoiceStatement: 'Warm, direct, trustworthy. Not clinical, not salesy, not urgent. Premium but accessible.',
  approvedFacts: [
    'Secure online intake is available.',
    'A licensed provider may review submitted information.',
    'Eligibility may depend on provider review and applicable requirements.',
  ],
  governanceNicheId: 'telehealth',
})

// ─── validateIntakeBrief — passing cases ─────────────────────────────────────

describe('validateIntakeBrief — valid brief', () => {
  it('passes a fully valid brief', () => {
    const result = validateIntakeBrief(validBrief())
    expect(result.passed).toBe(true)
    expect(result.missingFields).toHaveLength(0)
    expect(result.validationErrors).toHaveLength(0)
  })

  it('locks the ruleset version from the governance system', () => {
    const result = validateIntakeBrief(validBrief())
    expect(result.rulesetVersionLocked).toBeDefined()
    expect(result.rulesetVersionLocked).not.toBe('unknown')
    expect(result.rulesetVersionLocked.length).toBeGreaterThan(0)
  })

  it('generates a unique intakeBriefId (UUID)', () => {
    const r1 = validateIntakeBrief(validBrief())
    const r2 = validateIntakeBrief(validBrief())
    expect(r1.intakeBriefId).not.toBe(r2.intakeBriefId)
    expect(r1.intakeBriefId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('sets lockedAt to a valid ISO timestamp', () => {
    const result = validateIntakeBrief(validBrief())
    expect(() => new Date(result.lockedAt)).not.toThrow()
    expect(new Date(result.lockedAt).getFullYear()).toBeGreaterThanOrEqual(2024)
  })

  it('accepts all valid targetPlatform values', () => {
    const platforms = ['meta', 'google', 'tiktok', 'instagram', 'organic'] as const
    for (const platform of platforms) {
      const result = validateIntakeBrief({ ...validBrief(), targetPlatform: platform })
      expect(result.passed).toBe(true)
    }
  })

  it('accepts all valid funnelStage values', () => {
    const stages = ['awareness', 'consideration', 'conversion'] as const
    for (const stage of stages) {
      const result = validateIntakeBrief({ ...validBrief(), funnelStage: stage })
      expect(result.passed).toBe(true)
    }
  })

  it('accepts all valid proofTypeAllowed values', () => {
    const types = ['process-based', 'social-proof', 'outcome-based'] as const
    for (const type of types) {
      const result = validateIntakeBrief({ ...validBrief(), proofTypeAllowed: type })
      expect(result.passed).toBe(true)
    }
  })
})

// ─── validateIntakeBrief — missing fields ─────────────────────────────────────

describe('validateIntakeBrief — missing required fields', () => {
  const requiredFields: Array<keyof IntakeBrief> = [
    'targetPlatform',
    'audienceSegment',
    'funnelStage',
    'campaignObjective',
    'proofTypeAllowed',
    'brandVoiceStatement',
    'approvedFacts',
    'governanceNicheId',
  ]

  for (const field of requiredFields) {
    it(`fails when ${field} is missing`, () => {
      const brief = { ...validBrief() }
      delete (brief as Partial<IntakeBrief>)[field]
      const result = validateIntakeBrief(brief)
      expect(result.passed).toBe(false)
      expect(result.missingFields).toContain(field)
    })
  }
})

// ─── validateIntakeBrief — validation errors ──────────────────────────────────

describe('validateIntakeBrief — validation errors', () => {
  it('fails when audienceSegment is too short (< 20 chars)', () => {
    const result = validateIntakeBrief({ ...validBrief(), audienceSegment: 'Adults only' })
    expect(result.passed).toBe(false)
    expect(result.validationErrors.some(e => e.includes('audienceSegment'))).toBe(true)
  })

  it('fails when campaignObjective is too short (< 10 chars)', () => {
    const result = validateIntakeBrief({ ...validBrief(), campaignObjective: 'Bookings' })
    expect(result.passed).toBe(false)
    expect(result.validationErrors.some(e => e.includes('campaignObjective'))).toBe(true)
  })

  it('fails when brandVoiceStatement is too short (< 30 chars)', () => {
    const result = validateIntakeBrief({ ...validBrief(), brandVoiceStatement: 'Warm and friendly.' })
    expect(result.passed).toBe(false)
    expect(result.validationErrors.some(e => e.includes('brandVoiceStatement'))).toBe(true)
  })

  it('fails when approvedFacts has fewer than 3 entries', () => {
    const result = validateIntakeBrief({
      ...validBrief(),
      approvedFacts: ['One fact only.', 'Second fact only.'],
    })
    expect(result.passed).toBe(false)
    expect(result.validationErrors.some(e => e.includes('approvedFacts'))).toBe(true)
  })

  it('fails when an approved fact is too short (< 5 chars)', () => {
    const result = validateIntakeBrief({
      ...validBrief(),
      approvedFacts: ['Valid fact one.', 'Valid fact two.', 'abc'],
    })
    expect(result.passed).toBe(false)
    expect(result.validationErrors.some(e => e.includes('too short'))).toBe(true)
  })

  it('fails with invalid targetPlatform value', () => {
    const result = validateIntakeBrief({
      ...validBrief(),
      targetPlatform: 'youtube' as 'meta',
    })
    expect(result.passed).toBe(false)
    expect(result.validationErrors.some(e => e.includes('targetPlatform'))).toBe(true)
  })

  it('fails with invalid funnelStage value', () => {
    const result = validateIntakeBrief({
      ...validBrief(),
      funnelStage: 'bottom' as 'conversion',
    })
    expect(result.passed).toBe(false)
    expect(result.validationErrors.some(e => e.includes('funnelStage'))).toBe(true)
  })

  it('fails with invalid proofTypeAllowed value', () => {
    const result = validateIntakeBrief({
      ...validBrief(),
      proofTypeAllowed: 'testimonials' as 'process-based',
    })
    expect(result.passed).toBe(false)
    expect(result.validationErrors.some(e => e.includes('proofTypeAllowed'))).toBe(true)
  })

  it('reports multiple errors at once', () => {
    const result = validateIntakeBrief({
      ...validBrief(),
      audienceSegment: 'Too short',
      approvedFacts: ['Only one.'],
    })
    expect(result.passed).toBe(false)
    expect(result.validationErrors.length).toBeGreaterThanOrEqual(2)
  })
})

// ─── assertIntakePassed ───────────────────────────────────────────────────────

describe('assertIntakePassed', () => {
  it('does not throw for a passed gate result', () => {
    const result = validateIntakeBrief(validBrief())
    expect(() => assertIntakePassed(result)).not.toThrow()
  })

  it('throws when gateResult is null', () => {
    expect(() => assertIntakePassed(null)).toThrow(/IntakeGate/)
    expect(() => assertIntakePassed(null)).toThrow(/No intake brief found/)
  })

  it('throws when gateResult is undefined', () => {
    expect(() => assertIntakePassed(undefined)).toThrow(/IntakeGate/)
  })

  it('throws with detail about missing fields when brief failed', () => {
    const failed = validateIntakeBrief({ governanceNicheId: 'telehealth' })
    expect(() => assertIntakePassed(failed)).toThrow(/Missing fields/)
  })

  it('throws with detail about validation errors when brief failed', () => {
    const failed = validateIntakeBrief({
      ...validBrief(),
      audienceSegment: 'Short',
    })
    expect(() => assertIntakePassed(failed)).toThrow()
  })

  it('error message includes [IntakeGate] prefix for traceability', () => {
    expect(() => assertIntakePassed(null)).toThrow(/\[IntakeGate\]/)
  })
})

// ─── assertRulesetVersionMatch ────────────────────────────────────────────────

describe('assertRulesetVersionMatch', () => {
  it('does not throw when versions match', () => {
    const gateResult = validateIntakeBrief(validBrief())
    expect(() =>
      assertRulesetVersionMatch(gateResult, gateResult.rulesetVersionLocked)
    ).not.toThrow()
  })

  it('throws when governance was updated mid-run', () => {
    const gateResult = validateIntakeBrief(validBrief())
    expect(() =>
      assertRulesetVersionMatch(gateResult, 'telehealth-production-v2')
    ).toThrow(/mismatch/)
  })

  it('error message includes both version strings', () => {
    const gateResult = validateIntakeBrief(validBrief())
    try {
      assertRulesetVersionMatch(gateResult, 'different-version-v99')
    } catch (err) {
      expect((err as Error).message).toContain(gateResult.rulesetVersionLocked)
      expect((err as Error).message).toContain('different-version-v99')
    }
  })
})
