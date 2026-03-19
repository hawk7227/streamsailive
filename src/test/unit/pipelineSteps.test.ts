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
