/**
 * compositeAsset.test.ts
 *
 * Tests the typography layer (Step 4.5).
 * The full compose function requires network and Sharp — tested via unit isolation.
 * spellCheckTextStrings is pure — fully tested here.
 *
 * Sharp and Satori are mocked — they require native binaries/fonts unavailable in jsdom.
 * The pure functions (spellCheckTextStrings) are tested directly without mocks.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock Satori and Sharp to prevent native binary loading in test environment
vi.mock('satori', () => ({
  default: vi.fn().mockResolvedValue('<svg></svg>'),
}))
vi.mock('sharp', () => ({
  default: vi.fn().mockReturnValue({
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-image')),
  }),
}))
import {
  spellCheckTextStrings,
  type CompositeAssetParams,
} from '@/lib/pipeline/typography/compositeAsset'
import type { CopyVariant } from '@/lib/pipeline/qc/deterministicChecks'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const cleanVariant = (): CopyVariant => ({
  id: 'v1',
  headline: 'Care from home',
  subheadline: 'Connect with a licensed provider privately',
  bullets: ['Private intake', 'Licensed review', 'Fast next steps'],
  cta: 'Start your visit',
  microcopy: 'Where eligible',
  disclaimer: 'Subject to provider review and eligibility.',
})

// ─── spellCheckTextStrings ────────────────────────────────────────────────────

describe('spellCheckTextStrings', () => {
  it('passes a clean variant with no typos', () => {
    const result = spellCheckTextStrings(cleanVariant())
    expect(result.passed).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('catches known AI typo "thier" in headline', () => {
    const variant: CopyVariant = { ...cleanVariant(), headline: 'Care on thier schedule' }
    const result = spellCheckTextStrings(variant)
    expect(result.passed).toBe(false)
    expect(result.issues[0]).toMatch(/thier/)
  })

  it('catches known AI typo "guarenteed" in subheadline', () => {
    const variant: CopyVariant = { ...cleanVariant(), subheadline: 'Guarenteed provider review' }
    const result = spellCheckTextStrings(variant)
    expect(result.passed).toBe(false)
    expect(result.issues[0]).toMatch(/guarenteed/i)
  })

  it('catches known AI typo "recieve" in microcopy', () => {
    const variant: CopyVariant = { ...cleanVariant(), microcopy: 'You will recieve next steps soon' }
    const result = spellCheckTextStrings(variant)
    expect(result.passed).toBe(false)
    expect(result.issues[0]).toMatch(/recieve/i)
  })

  it('catches brand term casing issue for "medazon"', () => {
    const variant: CopyVariant = { ...cleanVariant(), headline: 'medazon telehealth' }
    const result = spellCheckTextStrings(variant)
    expect(result.passed).toBe(false)
    expect(result.issues[0]).toMatch(/Medazon/i)
  })

  it('catches "fnp-c" lower case', () => {
    const variant: CopyVariant = {
      ...cleanVariant(),
      subheadline: 'Care provided by an fnp-c credentialed provider',
    }
    const result = spellCheckTextStrings(variant)
    expect(result.passed).toBe(false)
    expect(result.issues[0]).toMatch(/FNP-C/i)
  })

  it('catches typos in bullets', () => {
    const variant: CopyVariant = {
      ...cleanVariant(),
      bullets: ['Seperate intake step', 'Licensed review', 'Definately next steps'],
    }
    const result = spellCheckTextStrings(variant)
    expect(result.passed).toBe(false)
    expect(result.issues.some(i => i.includes('bullet[0]'))).toBe(true)
    expect(result.issues.some(i => i.includes('bullet[2]'))).toBe(true)
  })

  it('reports the field name in each issue', () => {
    const variant: CopyVariant = {
      ...cleanVariant(),
      headline: 'thier care option',
      disclaimer: 'Recieve updates',
    }
    const result = spellCheckTextStrings(variant)
    expect(result.issues.some(i => i.startsWith('headline:'))).toBe(true)
    expect(result.issues.some(i => i.startsWith('disclaimer:'))).toBe(true)
  })

  it('returns multiple issues for multiple problems', () => {
    const variant: CopyVariant = {
      ...cleanVariant(),
      headline: 'thier guarenteed care',
      cta: 'Recieve care',
    }
    const result = spellCheckTextStrings(variant)
    expect(result.passed).toBe(false)
    expect(result.issues.length).toBeGreaterThanOrEqual(2)
  })

  it('handles empty fields without throwing', () => {
    const variant: CopyVariant = { ...cleanVariant(), microcopy: '', disclaimer: '' }
    expect(() => spellCheckTextStrings(variant)).not.toThrow()
  })
})
