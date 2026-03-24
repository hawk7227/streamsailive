/**
 * deterministicChecks.test.ts
 *
 * Tests every deterministic QC function.
 * No AI calls, no network — all synchronous pure functions.
 * Every test exercises a real failure mode documented in the research.
 */

import { describe, it, expect } from 'vitest'
import {
  scanBannedPhrases,
  checkFieldLengths,
  checkGrammarAndSpelling,
  checkApprovedFactsAlignment,
  checkDisclaimerCompliance,
  checkVariantDifferentiation,
  buildImageNegativePrompt,
  checkImageNegativePromptPresent,
  checkImagePositiveAnchorsPresent,
  type CopyOutput,
  type CopyVariant,
  type FieldLengthLimits,
} from '@/lib/pipeline/qc/deterministicChecks'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validVariant = (id: string, overrides: Partial<CopyVariant> = {}): CopyVariant => ({
  id,
  headline: 'Care from home',
  subheadline: 'Connect with a licensed provider privately and securely',
  bullets: ['Private intake process', 'Licensed provider review', 'Next steps within 24 hours'],
  cta: 'Start your visit',
  microcopy: 'Eligible patients only where available',
  disclaimer: 'Subject to provider review. Available where eligible.',
  ...overrides,
})

const validCopy = (): CopyOutput => ({
  variants: [
    validVariant('v1', {
      headline: 'Care from home',
      subheadline: 'Convenient online private care from anywhere on any device',
      bullets: ['Private secure intake', 'Easy online process', 'Flexible remote schedule'],
      cta: 'Start your visit',
    }),
    validVariant('v2', {
      headline: 'Trusted clinical care',
      subheadline: 'A licensed provider reviews your intake securely and discreetly',
      bullets: ['Licensed provider reviews', 'Secure private process', 'Clinical care online'],
      cta: 'Connect now',
    }),
    validVariant('v3', {
      headline: 'Simple flat fee',
      subheadline: 'Transparent pricing with no hidden fees and no surprises',
      bullets: ['Flat fee per visit', 'No hidden cost', 'Simple affordable care'],
      cta: 'See pricing',
    }),
  ],
})

const defaultLimits: FieldLengthLimits = {
  headlineMaxWords: 8,
  subheadlineMaxWords: 20,
  bulletMaxCount: 3,
  bulletMaxWords: 8,
  ctaMaxWords: 4,
  microcopyMaxWords: 12,
  disclaimerMaxWords: 18,
}

const defaultBannedPhrases = [
  'guaranteed cure',
  'instant prescription',
  'diagnosis in minutes',
  'skip the doctor',
  '100% guaranteed',
  'prescription guaranteed',
  'no questions asked',
]

const defaultApprovedFacts = [
  'Secure online intake is available.',
  'A licensed provider may review submitted information.',
  'Care can begin from a private digital experience.',
  'Next steps are shared after review.',
  'Treatment decisions are made only when clinically appropriate.',
  'Prescription availability is not guaranteed.',
  'Eligibility may depend on provider review and applicable requirements.',
]

// ─── scanBannedPhrases ────────────────────────────────────────────────────────

describe('scanBannedPhrases', () => {
  it('passes clean copy with no banned phrases', () => {
    const result = scanBannedPhrases(validCopy(), defaultBannedPhrases)
    expect(result.passed).toBe(true)
    expect(result.hits).toHaveLength(0)
  })

  it('catches a banned phrase in the headline', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { headline: 'Guaranteed cure available now' })],
    }
    const result = scanBannedPhrases(copy, defaultBannedPhrases)
    expect(result.passed).toBe(false)
    expect(result.hits).toHaveLength(1)
    expect(result.hits[0].phrase).toBe('guaranteed cure')
    expect(result.hits[0].field).toBe('headline')
    expect(result.hits[0].variantId).toBe('v1')
  })

  it('is case-insensitive', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { cta: 'INSTANT PRESCRIPTION today' })],
    }
    const result = scanBannedPhrases(copy, defaultBannedPhrases)
    expect(result.passed).toBe(false)
    expect(result.hits[0].phrase).toBe('instant prescription')
  })

  it('catches banned phrase in bullets', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { bullets: ['Skip the doctor entirely', 'Fast results', 'Easy process'] })],
    }
    const result = scanBannedPhrases(copy, defaultBannedPhrases)
    expect(result.passed).toBe(false)
    expect(result.hits[0].field).toBe('bullet[0]')
  })

  it('catches banned phrase in disclaimer', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { disclaimer: 'Results 100% guaranteed or your money back.' })],
    }
    const result = scanBannedPhrases(copy, defaultBannedPhrases)
    expect(result.passed).toBe(false)
    expect(result.hits[0].field).toBe('disclaimer')
  })

  it('catches multiple hits across multiple variants', () => {
    const copy: CopyOutput = {
      variants: [
        validVariant('v1', { headline: 'Get instant prescription online' }),
        validVariant('v2', { cta: 'No questions asked' }),
      ],
    }
    const result = scanBannedPhrases(copy, defaultBannedPhrases)
    expect(result.passed).toBe(false)
    expect(result.hits.length).toBeGreaterThanOrEqual(2)
  })

  it('includes context string with each hit', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { headline: 'Get your diagnosis in minutes today' })],
    }
    const result = scanBannedPhrases(copy, defaultBannedPhrases)
    expect(result.hits[0].context).toBeTruthy()
    expect(result.hits[0].context.length).toBeGreaterThan(0)
  })

  it('returns empty hits array for empty banned phrases list', () => {
    const result = scanBannedPhrases(validCopy(), [])
    expect(result.passed).toBe(true)
    expect(result.hits).toHaveLength(0)
  })
})

// ─── checkFieldLengths ────────────────────────────────────────────────────────

describe('checkFieldLengths', () => {
  it('passes copy within all limits', () => {
    const result = checkFieldLengths(validCopy(), defaultLimits)
    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('catches headline over word limit', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { headline: 'Get private licensed telehealth care from anywhere at any time today' })],
    }
    const result = checkFieldLengths(copy, defaultLimits)
    expect(result.passed).toBe(false)
    const violation = result.violations.find(v => v.field === 'headline')
    expect(violation).toBeDefined()
    expect(violation!.actual).toBeGreaterThan(8)
    expect(violation!.limit).toBe(8)
  })

  it('catches CTA over word limit', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { cta: 'Start your private telehealth visit today' })],
    }
    const result = checkFieldLengths(copy, defaultLimits)
    expect(result.passed).toBe(false)
    const v = result.violations.find(v => v.field === 'cta')
    expect(v).toBeDefined()
    expect(v!.limit).toBe(4)
  })

  it('catches too many bullets', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { bullets: ['One', 'Two', 'Three', 'Four'] })],
    }
    const result = checkFieldLengths(copy, defaultLimits)
    expect(result.passed).toBe(false)
    const v = result.violations.find(v => v.field === 'bullets' && v.type === 'count')
    expect(v).toBeDefined()
  })

  it('catches individual bullet over word limit', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', {
        bullets: [
          'Short bullet here',
          'This bullet is way too long and exceeds the eight word maximum limit set by governance',
          'Normal bullet',
        ],
      })],
    }
    const result = checkFieldLengths(copy, defaultLimits)
    expect(result.passed).toBe(false)
    const v = result.violations.find(v => v.field === 'bullet[1]')
    expect(v).toBeDefined()
  })

  it('reports violations for all variants independently', () => {
    const copy: CopyOutput = {
      variants: [
        validVariant('v1', { cta: 'Start your private telehealth visit' }),
        validVariant('v2', { cta: 'Connect now' }),
        validVariant('v3', { cta: 'See pricing options today please' }),
      ],
    }
    const result = checkFieldLengths(copy, defaultLimits)
    const violatingVariants = new Set(result.violations.map(v => v.variantId))
    expect(violatingVariants.has('v1')).toBe(true)
    expect(violatingVariants.has('v2')).toBe(false)
    expect(violatingVariants.has('v3')).toBe(true)
  })
})

// ─── checkGrammarAndSpelling ──────────────────────────────────────────────────

describe('checkGrammarAndSpelling', () => {
  it('passes clean copy', () => {
    const result = checkGrammarAndSpelling(validCopy())
    expect(result.passed).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('catches known AI typo "thier"', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { headline: 'Care on thier terms' })],
    }
    const result = checkGrammarAndSpelling(copy)
    expect(result.passed).toBe(false)
    expect(result.issues[0].found).toMatch(/thier/i)
  })

  it('catches urgency guarantee language as a block-level issue', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { cta: 'See a doctor now guaranteed' })],
    }
    const result = checkGrammarAndSpelling(copy)
    expect(result.passed).toBe(false)
    const urgencyIssue = result.issues.find(i => i.issue === 'urgency guarantee language')
    expect(urgencyIssue).toBeDefined()
  })

  it('catches brand term casing issues', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { subheadline: 'Powered by medazon health technology' })],
    }
    const result = checkGrammarAndSpelling(copy)
    expect(result.passed).toBe(false)
    const brandIssue = result.issues.find(i => i.issue === 'brand term — verify casing')
    expect(brandIssue).toBeDefined()
  })
})

// ─── checkApprovedFactsAlignment ─────────────────────────────────────────────

describe('checkApprovedFactsAlignment', () => {
  it('passes copy with no unverified factual claims', () => {
    const result = checkApprovedFactsAlignment(validCopy(), defaultApprovedFacts)
    expect(result.passed).toBe(true)
    expect(result.blocked).toHaveLength(0)
    expect(result.unverified).toHaveLength(0)
  })

  it('blocks always-blocked claim patterns regardless of approved facts', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { headline: 'Licensed in all 50 states' })],
    }
    const result = checkApprovedFactsAlignment(copy, defaultApprovedFacts)
    expect(result.passed).toBe(false)
    expect(result.blocked.length).toBeGreaterThan(0)
    expect(result.blocked[0].reason).toMatch(/always blocked/i)
  })

  it('blocks "100% covered" pattern', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { subheadline: 'Visits are 100% covered by all insurance' })],
    }
    const result = checkApprovedFactsAlignment(copy, defaultApprovedFacts)
    expect(result.passed).toBe(false)
    expect(result.blocked.length).toBeGreaterThan(0)
  })

  it('flags unverified numeric claims', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { subheadline: 'Over 50,000 patients served successfully' })],
    }
    const result = checkApprovedFactsAlignment(copy, defaultApprovedFacts)
    expect(result.passed).toBe(false)
    expect(result.unverified.length).toBeGreaterThan(0)
  })

  it('aligns $189 fee claim when present in approved facts', () => {
    const factsWithFee = [...defaultApprovedFacts, '$189 flat fee per visit.']
    const copy: CopyOutput = {
      variants: [validVariant('v1', { subheadline: 'A simple $189 flat fee per visit' })],
    }
    const result = checkApprovedFactsAlignment(copy, factsWithFee)
    expect(result.blocked).toHaveLength(0)
  })
})

// ─── checkDisclaimerCompliance ────────────────────────────────────────────────

describe('checkDisclaimerCompliance', () => {
  it('passes when all variants have qualifying disclaimer', () => {
    const result = checkDisclaimerCompliance(validCopy())
    expect(result.passed).toBe(true)
    expect(result.present).toBe(true)
    expect(result.hasEligibilityQualifier).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('fails when disclaimer is missing', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { disclaimer: '' })],
    }
    const result = checkDisclaimerCompliance(copy)
    expect(result.passed).toBe(false)
    expect(result.present).toBe(false)
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('fails when disclaimer lacks eligibility qualifier', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { disclaimer: 'Consult your doctor before use.' })],
    }
    const result = checkDisclaimerCompliance(copy)
    expect(result.passed).toBe(false)
    expect(result.hasEligibilityQualifier).toBe(false)
    expect(result.issues[0]).toMatch(/eligibility qualifier/i)
  })

  it('passes with "subject to provider review" qualifier', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { disclaimer: 'Results subject to provider review and clinical appropriateness.' })],
    }
    const result = checkDisclaimerCompliance(copy)
    expect(result.passed).toBe(true)
  })

  it('passes with "where eligible" qualifier', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { disclaimer: 'Available where eligible. Individual results may vary.' })],
    }
    const result = checkDisclaimerCompliance(copy)
    expect(result.passed).toBe(true)
  })

  it('fails when disclaimer contains banned content "guaranteed"', () => {
    const copy: CopyOutput = {
      variants: [validVariant('v1', { disclaimer: 'Results guaranteed where eligible applies.' })],
    }
    const result = checkDisclaimerCompliance(copy)
    expect(result.passed).toBe(false)
    expect(result.issues.some(i => i.includes('banned content'))).toBe(true)
  })

  it('fails only the variant missing a qualifier, not others', () => {
    const copy: CopyOutput = {
      variants: [
        validVariant('v1', { disclaimer: 'Where eligible, provider review required.' }),
        validVariant('v2', { disclaimer: 'No disclaimer here.' }),
        validVariant('v3', { disclaimer: 'Subject to review and eligibility.' }),
      ],
    }
    const result = checkDisclaimerCompliance(copy)
    expect(result.passed).toBe(false)
    const v2Issue = result.issues.find(i => i.includes('v2'))
    expect(v2Issue).toBeDefined()
  })
})

// ─── checkVariantDifferentiation ──────────────────────────────────────────────

describe('checkVariantDifferentiation', () => {
  it('passes when variants address distinct angles', () => {
    const copy: CopyOutput = {
      variants: [
        validVariant('v1', {
          headline: 'Care from home',
          subheadline: 'Convenient online private care from anywhere on any device',
          bullets: ['Easy from home', 'Online anywhere', 'Flexible remote schedule'],
        }),
        validVariant('v2', {
          headline: 'Licensed provider care',
          subheadline: 'Board-certified secure clinical professionals you can trust',
          bullets: ['Licensed providers only', 'Certified clinical team', 'Secure and safe process'],
        }),
        validVariant('v3', {
          headline: 'Affordable flat fee',
          subheadline: 'Transparent cost no hidden price simple value per visit',
          bullets: ['Flat fee per visit', 'No hidden cost', 'Simple affordable pricing'],
        }),
      ],
    }
    const result = checkVariantDifferentiation(copy)
    expect(result.passed).toBe(true)
    expect(result.missingAngles).toHaveLength(0)
  })

  it('detects access angle from keywords', () => {
    const copy: CopyOutput = {
      variants: [
        validVariant('v1', {
          headline: 'Convenient from home',
          subheadline: 'Online anywhere private convenient flexible schedule digital',
          bullets: ['Easy from home', 'Online anywhere', 'Flexible schedule'],
        }),
        validVariant('v2', {
          headline: 'Trusted licensed care',
          subheadline: 'A licensed provider reviews your care securely and safely',
          bullets: ['Licensed provider review', 'Secure safe process', 'Clinical professionals'],
        }),
        validVariant('v3', {
          headline: 'Affordable flat fee',
          subheadline: 'Transparent cost no hidden price affordable value simple',
          bullets: ['Flat fee pricing', 'No hidden cost', 'Simple value'],
        }),
      ],
    }
    const result = checkVariantDifferentiation(copy)
    expect(result.detectedAngles).toContain('access')
    expect(result.detectedAngles).toContain('trust')
    expect(result.detectedAngles).toContain('value')
  })

  it('flags missing trust angle when all variants focus on access', () => {
    const copy: CopyOutput = {
      variants: [
        validVariant('v1', { headline: 'Care from home easy', subheadline: 'Convenient online remote digital health' }),
        validVariant('v2', { headline: 'Online anywhere schedule', subheadline: 'Flexible convenient digital care from home' }),
        validVariant('v3', { headline: 'Private home care easy', subheadline: 'Online anywhere convenient flexible schedule' }),
      ],
    }
    const result = checkVariantDifferentiation(copy)
    expect(result.missingAngles).toContain('trust')
    expect(result.missingAngles).toContain('value')
  })

  it('flags duplicate angles', () => {
    const copy: CopyOutput = {
      variants: [
        validVariant('v1', { headline: 'Convenient from home', subheadline: 'Easy convenient online anywhere private' }),
        validVariant('v2', { headline: 'Easy online care', subheadline: 'Flexible convenient digital from home anywhere' }),
        validVariant('v3', { headline: 'Licensed provider care', subheadline: 'Certified secure clinical professional board' }),
      ],
    }
    const result = checkVariantDifferentiation(copy)
    expect(result.duplicateAngles).toContain('access')
  })
})

// ─── buildImageNegativePrompt ─────────────────────────────────────────────────

describe('buildImageNegativePrompt', () => {
  it('includes all mandatory text-blocking elements', () => {
    const prompt = buildImageNegativePrompt()
    expect(prompt).toContain('no text')
    expect(prompt).toContain('no words')
    expect(prompt).toContain('no letters')
    expect(prompt).toContain('no signs')
    expect(prompt).toContain('no labels')
    expect(prompt).toContain('no captions')
    expect(prompt).toContain('no watermarks')
  })

  it('includes all mandatory anatomy-blocking elements', () => {
    const prompt = buildImageNegativePrompt()
    expect(prompt).toContain('no distorted hands')
    expect(prompt).toContain('no extra fingers')
    expect(prompt).toContain('no fused fingers')
    expect(prompt).toContain('no floating limbs')
    expect(prompt).toContain('no extra limbs')
    expect(prompt).toContain('no missing limbs')
  })

  it('includes face quality blocks', () => {
    const prompt = buildImageNegativePrompt()
    expect(prompt).toContain('no asymmetric face')
    expect(prompt).toContain('no dead eyes')
    expect(prompt).toContain('no plastic skin')
    expect(prompt).toContain('no uncanny valley')
  })

  it('appends additional forbidden elements', () => {
    const prompt = buildImageNegativePrompt(['no syringes', 'no pills prominently shown'])
    expect(prompt).toContain('no syringes')
    expect(prompt).toContain('no pills prominently shown')
  })
})

// ─── checkImageNegativePromptPresent ─────────────────────────────────────────

describe('checkImageNegativePromptPresent', () => {
  it('passes a prompt containing all mandatory elements', () => {
    const negPrompt = buildImageNegativePrompt()
    const fullPrompt = `A telehealth provider in an ordinary environment. Natural expression, natural lighting, real person. Negative prompt: ${negPrompt}`
    const result = checkImageNegativePromptPresent(fullPrompt)
    expect(result.passed).toBe(true)
    expect(result.missingElements).toHaveLength(0)
  })

  it('fails when "no text" is absent', () => {
    const prompt = 'A clean telehealth scene. Negative prompt: no distorted hands, no extra fingers, no fused fingers, no floating limbs, no extra limbs, no missing limbs, no asymmetric face, no dead eyes, no plastic skin, no uncanny valley, no stock photography, no before/after, no signs, no labels, no captions, no watermarks, no words, no letters'
    const result = checkImageNegativePromptPresent(prompt)
    expect(result.passed).toBe(false)
    expect(result.missingElements).toContain('no text')
  })

  it('returns the specific missing element names', () => {
    const prompt = 'A generic healthcare scene with natural expression'
    const result = checkImageNegativePromptPresent(prompt)
    expect(result.passed).toBe(false)
    expect(result.missingElements.length).toBeGreaterThan(5)
  })

  it('is case-insensitive', () => {
    const negPrompt = buildImageNegativePrompt().toUpperCase()
    const fullPrompt = `Scene. Negative prompt: ${negPrompt}`
    const result = checkImageNegativePromptPresent(fullPrompt)
    expect(result.passed).toBe(true)
  })
})

// ─── checkImagePositiveAnchorsPresent ────────────────────────────────────────

describe('checkImagePositiveAnchorsPresent', () => {
  it('passes when all anchors are present', () => {
    const prompt = 'natural expression, natural lighting, real person, ordinary setting. No text.'
    const result = checkImagePositiveAnchorsPresent(prompt)
    expect(result.passed).toBe(true)
    expect(result.missingAnchors).toHaveLength(0)
  })

  it('fails when natural lighting is absent', () => {
    const prompt = 'natural expression, real person'
    const result = checkImagePositiveAnchorsPresent(prompt)
    expect(result.passed).toBe(false)
    expect(result.missingAnchors).toContain('natural lighting')
  })

  it('returns all missing anchors', () => {
    const prompt = 'generic healthcare scene'
    const result = checkImagePositiveAnchorsPresent(prompt)
    expect(result.passed).toBe(false)
    expect(result.missingAnchors.length).toBeGreaterThanOrEqual(3)
  })
})
