/**
 * intakeGate.test.ts
 *
 * Tests validateIntakeBrief from the universal realism engine spec.
 * Contract: { valid: boolean, errors: string[] }
 */

import { describe, it, expect } from 'vitest'
import { validateIntakeBrief } from '@/lib/pipeline/qc/intakeGate'
import type { IntakeBrief } from '@/lib/media-realism/types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validBrief = (): Partial<IntakeBrief> => ({
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
})

// ─── Valid brief ──────────────────────────────────────────────────────────────

describe('validateIntakeBrief — valid brief', () => {
  it('passes a fully valid brief', () => {
    const result = validateIntakeBrief(validBrief())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('accepts all valid targetPlatform values', () => {
    const platforms = ['meta', 'google', 'tiktok', 'instagram', 'organic'] as const
    for (const platform of platforms) {
      const result = validateIntakeBrief({ ...validBrief(), targetPlatform: platform })
      expect(result.valid).toBe(true)
    }
  })

  it('accepts all valid funnelStage values', () => {
    const stages = ['awareness', 'consideration', 'conversion'] as const
    for (const stage of stages) {
      const result = validateIntakeBrief({ ...validBrief(), funnelStage: stage })
      expect(result.valid).toBe(true)
    }
  })

  it('accepts all valid proofTypeAllowed values', () => {
    const types = ['process-based', 'social-proof', 'outcome-based'] as const
    for (const type of types) {
      const result = validateIntakeBrief({ ...validBrief(), proofTypeAllowed: type })
      expect(result.valid).toBe(true)
    }
  })
})

// ─── Missing required fields ──────────────────────────────────────────────────

describe('validateIntakeBrief — missing required fields', () => {
  it('fails when targetPlatform is missing', () => {
    const brief = { ...validBrief() }
    delete brief.targetPlatform
    const result = validateIntakeBrief(brief)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('targetPlatform'))).toBe(true)
  })

  it('fails when funnelStage is missing', () => {
    const brief = { ...validBrief() }
    delete brief.funnelStage
    const result = validateIntakeBrief(brief)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('funnelStage'))).toBe(true)
  })

  it('fails when proofTypeAllowed is missing', () => {
    const brief = { ...validBrief() }
    delete brief.proofTypeAllowed
    const result = validateIntakeBrief(brief)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('proofTypeAllowed'))).toBe(true)
  })

  it('fails when audienceSegment is missing', () => {
    const brief = { ...validBrief() }
    delete brief.audienceSegment
    const result = validateIntakeBrief(brief)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('audienceSegment'))).toBe(true)
  })

  it('fails when campaignObjective is missing', () => {
    const brief = { ...validBrief() }
    delete brief.campaignObjective
    const result = validateIntakeBrief(brief)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('campaignObjective'))).toBe(true)
  })

  it('fails when brandVoiceStatement is missing', () => {
    const brief = { ...validBrief() }
    delete brief.brandVoiceStatement
    const result = validateIntakeBrief(brief)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('brandVoiceStatement'))).toBe(true)
  })

  it('fails when approvedFacts is missing', () => {
    const brief = { ...validBrief() }
    delete brief.approvedFacts
    const result = validateIntakeBrief(brief)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('approvedFacts'))).toBe(true)
  })
})

// ─── Validation errors ────────────────────────────────────────────────────────

describe('validateIntakeBrief — validation errors', () => {
  it('fails when audienceSegment is too short (< 20 chars)', () => {
    const result = validateIntakeBrief({ ...validBrief(), audienceSegment: 'Adults only' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('audienceSegment'))).toBe(true)
  })

  it('fails when campaignObjective is too short (< 10 chars)', () => {
    const result = validateIntakeBrief({ ...validBrief(), campaignObjective: 'Bookings' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('campaignObjective'))).toBe(true)
  })

  it('fails when brandVoiceStatement is too short (< 30 chars)', () => {
    const result = validateIntakeBrief({ ...validBrief(), brandVoiceStatement: 'Warm and friendly.' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('brandVoiceStatement'))).toBe(true)
  })

  it('fails when approvedFacts has fewer than 3 entries', () => {
    const result = validateIntakeBrief({ ...validBrief(), approvedFacts: ['One fact only.', 'Second fact only.'] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('approvedFacts'))).toBe(true)
  })

  it('reports multiple errors at once', () => {
    const result = validateIntakeBrief({
      ...validBrief(),
      audienceSegment: 'Too short',
      approvedFacts: ['Only one.'],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })
})
