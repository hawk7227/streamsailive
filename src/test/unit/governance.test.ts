import { describe, it, expect } from 'vitest'

// We'll import the real governance once built
// For now test the expected contract
const TELEHEALTH_GOVERNANCE = {
  pipelineType: 'telehealth',
  rulesetVersion: 'telehealth-production-v1',
  approvedFacts: [
    'Secure online intake is available.',
    'A licensed provider may review submitted information.',
    'Care can begin from a private digital experience.',
    'Next steps are shared after review.',
    'Treatment decisions are made only when clinically appropriate.',
    'Prescription availability is not guaranteed.',
    'Eligibility may depend on provider review and applicable requirements.',
    'Patients often value privacy, convenience, and clear expectations.',
  ],
  bannedPhrases: [
    'guaranteed cure', 'instant prescription', 'diagnosis in minutes',
    'best doctor', 'miracle results', 'cure fast', 'get treated instantly',
    'no questions asked', '100% guaranteed', 'works every time',
    'skip the doctor', 'prescription guaranteed', 'instant diagnosis',
    'emergency treatment online', 'see a doctor now guaranteed',
  ],
  brandTone: 'Premium, calm, clinical, warm, trustworthy, discreet, reassuring, direct, modern, and human.',
  complianceLayer: {
    noDiagnosticClaims: true, noGuarantees: true, noOutcomePromises: true,
    noPrescriptionCertainty: true, noEmergencyCareImplication: true,
    noFakeTestimonials: true, privacySafe: true
  },
  enforcementConfig: {
    fieldLengthEnforcement: {
      headlineMaxWords: 8, subheadlineMaxWords: 20, bulletMaxCount: 3,
      bulletMaxWords: 8, ctaMaxWords: 4, microcopyMaxWords: 12, disclaimerMaxWords: 18
    },
    blockTriggers: [
      'unsupported medical claim', 'diagnosis claim', 'cure claim',
      'guaranteed outcome', 'guaranteed prescription implication',
      'fabricated provider credential', 'banned phrase usage'
    ],
    autoFix: {
      enabled: true, maxAttempts: 2,
      allowedFor: ['capitalization inconsistency', 'minor length overflow under 10 percent', 'punctuation cleanup'],
      disallowedFor: ['medical claim change', 'outcome implication', 'provider credential creation']
    }
  },
  motionPlanRules: {
    allowedMotions: ['slow push-in', 'gentle pan', 'soft parallax', 'minor posture shift', 'natural blink', 'slight hand movement', 'subtle fabric movement', 'soft focus transition'],
    bannedMotions: ['fast zoom', 'whip pan', 'aggressive camera shake', 'dramatic action movement', 'face distortion', 'lip sync simulation', 'mouth talking animation', 'body morphing', 'hand morphing'],
    durationDefaults: { minSeconds: 3, maxSeconds: 6 }
  }
}

describe('Telehealth Governance — Structure', () => {
  it('has correct pipelineType', () => {
    expect(TELEHEALTH_GOVERNANCE.pipelineType).toBe('telehealth')
  })
  it('has rulesetVersion', () => {
    expect(TELEHEALTH_GOVERNANCE.rulesetVersion).toBe('telehealth-production-v1')
  })
  it('has exactly 8 approved facts', () => {
    expect(TELEHEALTH_GOVERNANCE.approvedFacts).toHaveLength(8)
  })
  it('has at least 15 banned phrases', () => {
    expect(TELEHEALTH_GOVERNANCE.bannedPhrases.length).toBeGreaterThanOrEqual(15)
  })
  it('brandTone includes premium and trustworthy', () => {
    const tone = TELEHEALTH_GOVERNANCE.brandTone.toLowerCase()
    expect(tone).toContain('premium')
    expect(tone).toContain('trustworthy')
    expect(tone).toContain('calm')
  })
})

describe('Telehealth Governance — Compliance Layer', () => {
  it('blocks diagnostic claims', () => {
    expect(TELEHEALTH_GOVERNANCE.complianceLayer.noDiagnosticClaims).toBe(true)
  })
  it('blocks guarantees', () => {
    expect(TELEHEALTH_GOVERNANCE.complianceLayer.noGuarantees).toBe(true)
  })
  it('blocks prescription certainty', () => {
    expect(TELEHEALTH_GOVERNANCE.complianceLayer.noPrescriptionCertainty).toBe(true)
  })
  it('blocks emergency care implication', () => {
    expect(TELEHEALTH_GOVERNANCE.complianceLayer.noEmergencyCareImplication).toBe(true)
  })
  it('blocks fake testimonials', () => {
    expect(TELEHEALTH_GOVERNANCE.complianceLayer.noFakeTestimonials).toBe(true)
  })
  it('requires privacy safety', () => {
    expect(TELEHEALTH_GOVERNANCE.complianceLayer.privacySafe).toBe(true)
  })
})

describe('Telehealth Governance — Field Length Enforcement', () => {
  const limits = TELEHEALTH_GOVERNANCE.enforcementConfig.fieldLengthEnforcement
  it('headline max is 8 words', () => { expect(limits.headlineMaxWords).toBe(8) })
  it('subheadline max is 20 words', () => { expect(limits.subheadlineMaxWords).toBe(20) })
  it('bullet max count is 3', () => { expect(limits.bulletMaxCount).toBe(3) })
  it('bullet max is 8 words each', () => { expect(limits.bulletMaxWords).toBe(8) })
  it('cta max is 4 words', () => { expect(limits.ctaMaxWords).toBe(4) })
  it('microcopy max is 12 words', () => { expect(limits.microcopyMaxWords).toBe(12) })
  it('disclaimer max is 18 words', () => { expect(limits.disclaimerMaxWords).toBe(18) })
})

describe('Telehealth Governance — Banned Phrase Detection', () => {
  function containsBannedPhrase(text: string): string | null {
    const lower = text.toLowerCase()
    for (const phrase of TELEHEALTH_GOVERNANCE.bannedPhrases) {
      if (lower.includes(phrase.toLowerCase())) return phrase
    }
    return null
  }

  it('detects "guaranteed cure"', () => {
    expect(containsBannedPhrase('We offer a guaranteed cure for your condition')).toBe('guaranteed cure')
  })
  it('detects "instant prescription"', () => {
    expect(containsBannedPhrase('Get an instant prescription today')).toBe('instant prescription')
  })
  it('detects "skip the doctor"', () => {
    expect(containsBannedPhrase('Skip the doctor and get meds fast')).toBe('skip the doctor')
  })
  it('detects "100% guaranteed"', () => {
    expect(containsBannedPhrase('100% guaranteed results')).toBe('100% guaranteed')
  })
  it('does NOT flag compliant copy', () => {
    expect(containsBannedPhrase('A licensed provider may review submitted information')).toBeNull()
    expect(containsBannedPhrase('Care begins from a private digital experience')).toBeNull()
    expect(containsBannedPhrase('Treatment decisions made when clinically appropriate')).toBeNull()
  })
  it('does NOT flag the CTA "Start Your Visit"', () => {
    expect(containsBannedPhrase('Start Your Visit')).toBeNull()
  })
})

describe('Telehealth Governance — Field Length Validation', () => {
  function validateHeadline(text: string): { valid: boolean; wordCount: number } {
    const wordCount = text.trim().split(/\s+/).length
    return { valid: wordCount <= TELEHEALTH_GOVERNANCE.enforcementConfig.fieldLengthEnforcement.headlineMaxWords, wordCount }
  }
  function validateCTA(text: string): { valid: boolean; wordCount: number } {
    const wordCount = text.trim().split(/\s+/).length
    return { valid: wordCount <= TELEHEALTH_GOVERNANCE.enforcementConfig.fieldLengthEnforcement.ctaMaxWords, wordCount }
  }

  it('accepts "Private Care, From Home" (4 words)', () => {
    expect(validateHeadline('Private Care, From Home').valid).toBe(true)
  })
  it('accepts "Care Without the Wait" (4 words)', () => {
    expect(validateHeadline('Care Without the Wait').valid).toBe(true)
  })
  it('rejects headline over 8 words', () => {
    expect(validateHeadline('Get Private Online Healthcare Care From Your Home Today').valid).toBe(false)
  })
  it('accepts "Start Your Visit" CTA (3 words)', () => {
    expect(validateCTA('Start Your Visit').valid).toBe(true)
  })
  it('accepts "Begin Intake" CTA (2 words)', () => {
    expect(validateCTA('Begin Intake').valid).toBe(true)
  })
  it('rejects CTA over 4 words', () => {
    expect(validateCTA('Click Here To Start Your Visit Now').valid).toBe(false)
  })
})

describe('Telehealth Governance — Motion Plan Rules', () => {
  const rules = TELEHEALTH_GOVERNANCE.motionPlanRules

  it('allows slow push-in', () => {
    expect(rules.allowedMotions).toContain('slow push-in')
  })
  it('allows gentle pan', () => {
    expect(rules.allowedMotions).toContain('gentle pan')
  })
  it('bans fast zoom', () => {
    expect(rules.bannedMotions).toContain('fast zoom')
  })
  it('bans face distortion', () => {
    expect(rules.bannedMotions).toContain('face distortion')
  })
  it('bans lip sync simulation', () => {
    expect(rules.bannedMotions).toContain('lip sync simulation')
  })
  it('bans mouth talking animation', () => {
    expect(rules.bannedMotions).toContain('mouth talking animation')
  })
  it('duration min is 3 seconds', () => {
    expect(rules.durationDefaults.minSeconds).toBe(3)
  })
  it('duration max is 6 seconds', () => {
    expect(rules.durationDefaults.maxSeconds).toBe(6)
  })
})

describe('Telehealth Governance — Auto-Fix Rules', () => {
  const autoFix = TELEHEALTH_GOVERNANCE.enforcementConfig.autoFix

  it('auto-fix is enabled', () => {
    expect(autoFix.enabled).toBe(true)
  })
  it('max 2 auto-fix attempts', () => {
    expect(autoFix.maxAttempts).toBe(2)
  })
  it('allows capitalization fix', () => {
    expect(autoFix.allowedFor).toContain('capitalization inconsistency')
  })
  it('allows punctuation fix', () => {
    expect(autoFix.allowedFor).toContain('punctuation cleanup')
  })
  it('NEVER allows medical claim change', () => {
    expect(autoFix.disallowedFor).toContain('medical claim change')
  })
  it('NEVER allows outcome implication change', () => {
    expect(autoFix.disallowedFor).toContain('outcome implication')
  })
  it('NEVER allows provider credential creation', () => {
    expect(autoFix.disallowedFor).toContain('provider credential creation')
  })
})

describe('Telehealth Governance — Block Triggers', () => {
  const triggers = TELEHEALTH_GOVERNANCE.enforcementConfig.blockTriggers

  it('blocks unsupported medical claim', () => {
    expect(triggers).toContain('unsupported medical claim')
  })
  it('blocks diagnosis claim', () => {
    expect(triggers).toContain('diagnosis claim')
  })
  it('blocks cure claim', () => {
    expect(triggers).toContain('cure claim')
  })
  it('blocks guaranteed outcome', () => {
    expect(triggers).toContain('guaranteed outcome')
  })
  it('blocks banned phrase usage', () => {
    expect(triggers).toContain('banned phrase usage')
  })
})
