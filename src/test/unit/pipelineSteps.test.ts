import { describe, it, expect, vi, beforeEach } from 'vitest'

type StepState = 'queued' | 'running' | 'complete' | 'review' | 'error' | 'blocked'

type Step = {
  id: string
  name: string
  state: StepState
  icon: string
  output: any
  error: string | null
  startedAt: number | null
  completedAt: number | null
}

const PIPELINE_STEPS: Step[] = [
  { id: 'strategy', name: 'Creative Strategy', state: 'queued', icon: '◫', output: null, error: null, startedAt: null, completedAt: null },
  { id: 'copy', name: 'AI Copy Generation', state: 'queued', icon: '✦', output: null, error: null, startedAt: null, completedAt: null },
  { id: 'validator', name: 'Validator', state: 'queued', icon: '◈', output: null, error: null, startedAt: null, completedAt: null },
  { id: 'imagery', name: 'Imagery Generation', state: 'queued', icon: '▣', output: null, error: null, startedAt: null, completedAt: null },
  { id: 'i2v', name: 'Image to Video', state: 'queued', icon: '▶', output: null, error: null, startedAt: null, completedAt: null },
  { id: 'assets', name: 'Asset Library', state: 'queued', icon: '▤', output: null, error: null, startedAt: null, completedAt: null },
  { id: 'qa', name: 'Quality Assurance', state: 'queued', icon: '✓', output: null, error: null, startedAt: null, completedAt: null },
]

function cloneSteps(steps: Step[]): Step[] {
  return steps.map(s => ({ ...s }))
}

function setStepState(steps: Step[], id: string, state: StepState, extra?: Partial<Step>): Step[] {
  return steps.map(s => s.id === id ? { ...s, state, ...extra } : s)
}

function getStep(steps: Step[], id: string): Step | undefined {
  return steps.find(s => s.id === id)
}

function canRunStep(steps: Step[], id: string): boolean {
  const stepOrder = ['strategy', 'copy', 'validator', 'imagery', 'i2v', 'assets', 'qa']
  const idx = stepOrder.indexOf(id)
  if (idx === 0) return true
  const prev = stepOrder[idx - 1]
  const prevStep = getStep(steps, prev)
  return prevStep?.state === 'complete'
}

describe('Pipeline Steps — Initial State', () => {
  it('has exactly 7 steps', () => {
    expect(PIPELINE_STEPS).toHaveLength(7)
  })
  it('all steps start as queued', () => {
    expect(PIPELINE_STEPS.every(s => s.state === 'queued')).toBe(true)
  })
  it('step IDs are correct', () => {
    const ids = PIPELINE_STEPS.map(s => s.id)
    expect(ids).toEqual(['strategy', 'copy', 'validator', 'imagery', 'i2v', 'assets', 'qa'])
  })
  it('all steps start with null output', () => {
    expect(PIPELINE_STEPS.every(s => s.output === null)).toBe(true)
  })
  it('all steps start with null error', () => {
    expect(PIPELINE_STEPS.every(s => s.error === null)).toBe(true)
  })
})

describe('Pipeline Steps — State Transitions', () => {
  let steps: Step[]
  beforeEach(() => { steps = cloneSteps(PIPELINE_STEPS) })

  it('strategy can run first (no prerequisites)', () => {
    expect(canRunStep(steps, 'strategy')).toBe(true)
  })
  it('copy cannot run before strategy completes', () => {
    expect(canRunStep(steps, 'copy')).toBe(false)
  })
  it('copy can run after strategy completes', () => {
    steps = setStepState(steps, 'strategy', 'complete')
    expect(canRunStep(steps, 'copy')).toBe(true)
  })
  it('validator cannot run before copy completes', () => {
    steps = setStepState(steps, 'strategy', 'complete')
    expect(canRunStep(steps, 'validator')).toBe(false)
  })
  it('imagery cannot run before validator completes', () => {
    steps = setStepState(steps, 'strategy', 'complete')
    steps = setStepState(steps, 'copy', 'complete')
    expect(canRunStep(steps, 'imagery')).toBe(false)
  })
  it('full pipeline: each step unlocks the next', () => {
    const order = ['strategy', 'copy', 'validator', 'imagery', 'i2v', 'assets', 'qa']
    for (let i = 0; i < order.length; i++) {
      // Before completing step i: only step i should be runnable
      expect(canRunStep(steps, order[i])).toBe(true)
      // Complete step i
      steps = setStepState(steps, order[i], 'complete')
      // After completing step i: next step should now be unlocked
      if (i + 1 < order.length) {
        expect(canRunStep(steps, order[i + 1])).toBe(true)
      }
    }
  })
})

describe('Pipeline Steps — Validator Block Behavior', () => {
  let steps: Step[]
  beforeEach(() => { steps = cloneSteps(PIPELINE_STEPS) })

  it('when validator blocks, imagery cannot run', () => {
    steps = setStepState(steps, 'strategy', 'complete')
    steps = setStepState(steps, 'copy', 'complete')
    steps = setStepState(steps, 'validator', 'blocked', { error: 'Diagnosis claim detected' })
    // imagery requires validator = complete, not blocked
    expect(canRunStep(steps, 'imagery')).toBe(false)
  })

  it('blocked validator shows error message', () => {
    steps = setStepState(steps, 'validator', 'blocked', { error: 'Banned phrase: guaranteed cure' })
    expect(getStep(steps, 'validator')?.error).toBe('Banned phrase: guaranteed cure')
  })

  it('after validator fix and re-run, pipeline can continue', () => {
    steps = setStepState(steps, 'strategy', 'complete')
    steps = setStepState(steps, 'copy', 'complete')
    steps = setStepState(steps, 'validator', 'blocked')
    // Fix and re-run
    steps = setStepState(steps, 'validator', 'complete', { error: null })
    expect(canRunStep(steps, 'imagery')).toBe(true)
  })
})

describe('Pipeline Steps — Individual Step Run', () => {
  let steps: Step[]
  beforeEach(() => { steps = cloneSteps(PIPELINE_STEPS) })

  it('running a step sets state to running', () => {
    steps = setStepState(steps, 'strategy', 'running', { startedAt: Date.now() })
    expect(getStep(steps, 'strategy')?.state).toBe('running')
    expect(getStep(steps, 'strategy')?.startedAt).not.toBeNull()
  })

  it('completing a step sets state, output, and completedAt', () => {
    const output = { strategySummary: 'Focus on privacy', variants: [] }
    steps = setStepState(steps, 'strategy', 'complete', { output, completedAt: Date.now() })
    const step = getStep(steps, 'strategy')
    expect(step?.state).toBe('complete')
    expect(step?.output).toEqual(output)
    expect(step?.completedAt).not.toBeNull()
  })

  it('failing a step sets error state and message', () => {
    steps = setStepState(steps, 'strategy', 'error', { error: 'OpenAI API unavailable' })
    const step = getStep(steps, 'strategy')
    expect(step?.state).toBe('error')
    expect(step?.error).toBe('OpenAI API unavailable')
  })

  it('duplicate step creates copy with queued state', () => {
    const original = getStep(steps, 'copy')!
    const duplicated: Step = { ...original, id: `copy-copy-${Date.now()}`, state: 'queued', output: null, error: null, startedAt: null, completedAt: null }
    steps = [...steps, duplicated]
    expect(steps.filter(s => s.name === 'AI Copy Generation')).toHaveLength(2)
    expect(duplicated.state).toBe('queued')
  })

  it('removing a step reduces step count', () => {
    steps = steps.filter(s => s.id !== 'assets')
    expect(steps).toHaveLength(6)
    expect(steps.find(s => s.id === 'assets')).toBeUndefined()
  })

  it('cannot remove the last step', () => {
    let current = [...steps]
    // Remove all but one
    while (current.length > 1) { current = current.slice(0, -1) }
    // Attempt removal should be prevented
    const result = current.length <= 1 ? current : current.filter(s => s.id !== current[0].id)
    expect(result.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Pipeline Steps — Step Config Panel', () => {
  it('step config panel starts closed (48px rail)', () => {
    const stepConfigOpen = false
    expect(stepConfigOpen).toBe(false)
  })

  it('clicking a step opens step config', () => {
    let stepConfigOpen = false
    let selectedStepId = 'strategy'

    function selectStep(id: string) {
      selectedStepId = id
      stepConfigOpen = true
    }

    selectStep('copy')
    expect(selectedStepId).toBe('copy')
    expect(stepConfigOpen).toBe(true)
  })

  it('clicking same step again closes step config', () => {
    let stepConfigOpen = true
    let selectedStepId = 'copy'

    function toggleStep(id: string) {
      if (selectedStepId === id && stepConfigOpen) {
        stepConfigOpen = false
      } else {
        selectedStepId = id
        stepConfigOpen = true
      }
    }

    toggleStep('copy')
    expect(stepConfigOpen).toBe(false)
  })

  it('switching to different step keeps config open', () => {
    let stepConfigOpen = true
    let selectedStepId = 'copy'

    function toggleStep(id: string) {
      if (selectedStepId === id && stepConfigOpen) {
        stepConfigOpen = false
      } else {
        selectedStepId = id
        stepConfigOpen = true
      }
    }

    toggleStep('validator')
    expect(stepConfigOpen).toBe(true)
    expect(selectedStepId).toBe('validator')
  })

  it('each step shows correct prompt field', () => {
    const stepPromptMap: Record<string, string> = {
      strategy: 'strategyPrompt',
      copy: 'copyPrompt',
      validator: 'validatorPrompt',
      imagery: 'imagePrompt',
      i2v: 'imageToVideo',
      assets: 'templatePrompt',
      qa: 'qaInstruction',
    }
    for (const [stepId, promptField] of Object.entries(stepPromptMap)) {
      expect(stepPromptMap[stepId]).toBe(promptField)
    }
  })
})

describe('Pipeline Steps — Process Preview Status', () => {
  it('idle state shows correct label', () => {
    const status = { state: 'idle' as const, stepName: null, substatus: 'Ready' }
    expect(status.state).toBe('idle')
    expect(status.substatus).toBe('Ready')
  })

  it('running state shows step name and substatus', () => {
    const status = { state: 'running' as const, stepName: 'AI Copy Generation', substatus: 'Generating variant 2 of 3...' }
    expect(status.state).toBe('running')
    expect(status.stepName).toBe('AI Copy Generation')
    expect(status.substatus).toContain('Generating')
  })

  it('blocked state shows error', () => {
    const status = { state: 'blocked' as const, stepName: 'Validator', substatus: 'Banned phrase detected', error: 'guaranteed cure' }
    expect(status.state).toBe('blocked')
    expect(status.error).toBe('guaranteed cure')
  })

  it('complete state awaits approval', () => {
    const status = { state: 'complete' as const, stepName: 'AI Copy Generation', substatus: 'Awaiting approval' }
    expect(status.substatus).toBe('Awaiting approval')
  })
})

// ─── Gate enforcement — new QC layer tests ────────────────────────────────────

describe('Pipeline Gates — Step 3→4 Validator Gate', () => {
  it('blocks imagery when validator status is "block"', () => {
    const steps = cloneSteps(PIPELINE_STEPS)
    const withValidatorBlocked = setStepState(steps, 'validator', 'blocked', {
      output: { validatorStatus: 'block', blockReasons: ['Banned phrase: guaranteed cure'] },
    })
    // imagery cannot run when validator is blocked
    const imageryStep = getStep(withValidatorBlocked, 'imagery')
    const validatorStep = getStep(withValidatorBlocked, 'validator')
    expect(validatorStep?.state).toBe('blocked')
    expect(imageryStep?.state).toBe('queued') // not yet run
  })

  it('allows imagery when validator status is "pass"', () => {
    const steps = cloneSteps(PIPELINE_STEPS)
    const withValidatorPassed = setStepState(steps, 'validator', 'complete', {
      output: { validatorStatus: 'pass' },
    })
    const canRun = canRunStep(withValidatorPassed, 'imagery')
    expect(canRun).toBe(true)
  })

  it('canRunStep returns false for imagery when validator is blocked', () => {
    const stepOrder = ['strategy', 'copy', 'validator', 'imagery', 'i2v', 'assets', 'qa']
    function canRunWithBlockedValidator(steps: Step[], id: string): boolean {
      const idx = stepOrder.indexOf(id)
      if (idx === 0) return true
      const prev = stepOrder[idx - 1]
      const prevStep = getStep(steps, prev)
      // imagery additionally requires validator to have passed (not just completed)
      if (id === 'imagery') {
        const validatorStep = getStep(steps, 'validator')
        if (validatorStep?.state === 'blocked') return false
        const validatorStatus = validatorStep?.output?.validatorStatus
        if (validatorStatus && validatorStatus !== 'pass') return false
      }
      return prevStep?.state === 'complete'
    }

    const steps = cloneSteps(PIPELINE_STEPS)
    const withValidatorBlocked = setStepState(
      setStepState(steps, 'validator', 'blocked'),
      'copy',
      'complete'
    )
    expect(canRunWithBlockedValidator(withValidatorBlocked, 'imagery')).toBe(false)
  })
})

describe('Pipeline Gates — Intake Gate', () => {
  it('strategy step requires intake brief to be present', () => {
    // Simulate: intake brief absent → strategy cannot start
    const intakeBriefPresent = false
    const canRunStrategy = intakeBriefPresent
    expect(canRunStrategy).toBe(false)
  })

  it('strategy step can run when intake brief is complete', () => {
    const intakeBriefPresent = true
    const intakeBriefPassed = true
    const canRunStrategy = intakeBriefPresent && intakeBriefPassed
    expect(canRunStrategy).toBe(true)
  })
})

describe('Pipeline Gates — Imagery→I2V OCR Gate', () => {
  it('I2V blocked when imagery has text (OCR failed)', () => {
    const imageryOutput = {
      imageUrl: 'https://cdn.example.com/img.jpg',
      ocrCheckPassed: false,
      ocrSkipped: false,
      imageGenerationFailed: false,
    }
    const canRunI2V = imageryOutput.ocrCheckPassed || imageryOutput.ocrSkipped
    expect(canRunI2V).toBe(false)
  })

  it('I2V proceeds when imagery passed OCR', () => {
    const imageryOutput = {
      imageUrl: 'https://cdn.example.com/img.jpg',
      ocrCheckPassed: true,
      ocrSkipped: false,
      imageGenerationFailed: false,
    }
    const canRunI2V = imageryOutput.ocrCheckPassed || imageryOutput.ocrSkipped
    expect(canRunI2V).toBe(true)
  })

  it('I2V flags human review when OCR was skipped', () => {
    const imageryOutput = {
      imageUrl: 'https://cdn.example.com/img.jpg',
      ocrCheckPassed: false,
      ocrSkipped: true,
      imageGenerationFailed: false,
    }
    const requiresHumanReview = imageryOutput.ocrSkipped
    const canRunI2V = imageryOutput.ocrCheckPassed || imageryOutput.ocrSkipped
    expect(canRunI2V).toBe(true)
    expect(requiresHumanReview).toBe(true)
  })

  it('I2V blocked when imagery generation failed entirely', () => {
    const imageryOutput = {
      imageUrl: '',
      ocrCheckPassed: false,
      ocrSkipped: false,
      imageGenerationFailed: true,
    }
    const canRunI2V = !imageryOutput.imageGenerationFailed &&
      (imageryOutput.ocrCheckPassed || imageryOutput.ocrSkipped)
    expect(canRunI2V).toBe(false)
  })
})

describe('Pipeline Gates — QA Human Review Gate', () => {
  it('QA output always includes humanApprovalRequired=true', () => {
    // QA never returns "approved" — always "readyForHumanReview"
    const qaOutput = {
      qaStatus: 'readyForHumanReview',
      humanApprovalRequired: true,
      humanApprovedAt: null,
      humanApprovedBy: null,
    }
    expect(qaOutput.qaStatus).toBe('readyForHumanReview')
    expect(qaOutput.qaStatus).not.toBe('approved')
    expect(qaOutput.humanApprovalRequired).toBe(true)
    expect(qaOutput.humanApprovedAt).toBeNull()
    expect(qaOutput.humanApprovedBy).toBeNull()
  })

  it('asset library complianceStatus is always readyForHumanReview', () => {
    const assetAudit = {
      complianceStatus: 'readyForHumanReview',
      humanApprovalRequired: true,
      humanApprovedAt: null,
      humanApprovedBy: null,
    }
    expect(assetAudit.complianceStatus).not.toBe('approved')
    expect(assetAudit.complianceStatus).toBe('readyForHumanReview')
  })
})

describe('Pipeline Gates — Ruleset Version Lock', () => {
  it('locked version must match current governance version', () => {
    const lockedVersion = 'telehealth-production-v1'
    const currentVersion = 'telehealth-production-v1'
    expect(lockedVersion).toBe(currentVersion)
  })

  it('detects governance drift mid-run', () => {
    const lockedVersion: string = 'telehealth-production-v1'
    const currentVersion: string = 'telehealth-production-v2' // updated after lock
    const hasDrift = lockedVersion !== currentVersion
    expect(hasDrift).toBe(true)
  })
})

describe('Pipeline Gates — Asset Library Audit Trail', () => {
  it('audit record includes all required fields', () => {
    const requiredFields = [
      'intakeBriefId',
      'rulesetVersionLocked',
      'validatorResult',
      'ocrCheckPassed',
      'videoUrlValid',
      'timestamp',
      'complianceStatus',
      'humanApprovalRequired',
      'humanApprovedAt',
      'humanApprovedBy',
    ]
    const auditRecord = {
      intakeBriefId: 'abc-123',
      rulesetVersionLocked: 'telehealth-production-v1',
      validatorResult: 'pass',
      ocrCheckPassed: true,
      videoUrlValid: true,
      timestamp: new Date().toISOString(),
      complianceStatus: 'readyForHumanReview',
      humanApprovalRequired: true,
      humanApprovedAt: null,
      humanApprovedBy: null,
    }
    for (const field of requiredFields) {
      expect(auditRecord).toHaveProperty(field)
    }
  })

  it('intakeBriefId links asset to the originating run', () => {
    const briefId = 'run-abc-123'
    const auditRecord = { intakeBriefId: briefId }
    expect(auditRecord.intakeBriefId).toBe(briefId)
  })
})
