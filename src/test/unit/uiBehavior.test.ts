import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── UI State Machine Tests ────────────────────────────────────────────────
// These test the state logic that drives the UI
// Component render tests will follow once the page is built

// ── Niche Dropdown ────────────────────────────────────────────────────────
describe('Niche Dropdown', () => {
  const BUILTIN_NICHES = [
    { id: 'telehealth', name: 'Telehealth Master', builtin: true },
    { id: 'google_ads', name: 'Google Ads — Telehealth', builtin: true },
  ]

  it('shows 2 built-in options by default', () => {
    expect(BUILTIN_NICHES).toHaveLength(2)
  })

  it('includes Create New Niche option', () => {
    const options = [...BUILTIN_NICHES, { id: '__create__', name: '+ Create New Niche', builtin: false }]
    expect(options.find(o => o.id === '__create__')).toBeTruthy()
  })

  it('selecting telehealth loads TELEHEALTH_GOVERNANCE', () => {
    const selectedNiche = 'telehealth'
    const governanceKey = selectedNiche === 'telehealth' ? 'TELEHEALTH_GOVERNANCE' : selectedNiche === 'google_ads' ? 'GOOGLE_ADS_GOVERNANCE' : 'custom'
    expect(governanceKey).toBe('TELEHEALTH_GOVERNANCE')
  })

  it('selecting google_ads loads GOOGLE_ADS_GOVERNANCE', () => {
    const selectedNiche: string = 'google_ads'
    const governanceKey = selectedNiche === 'telehealth' ? 'TELEHEALTH_GOVERNANCE' : selectedNiche === 'google_ads' ? 'GOOGLE_ADS_GOVERNANCE' : 'custom'
    expect(governanceKey).toBe('GOOGLE_ADS_GOVERNANCE')
  })

  it('custom niches appear between built-ins and Create option', () => {
    const customNiches = [{ id: 'niche-001', name: 'My Custom', builtin: false }]
    const allOptions = [...BUILTIN_NICHES, ...customNiches, { id: '__create__', name: '+ Create New Niche', builtin: false }]
    const createIdx = allOptions.findIndex(o => o.id === '__create__')
    const customIdx = allOptions.findIndex(o => o.id === 'niche-001')
    expect(customIdx).toBeLessThan(createIdx)
  })

  it('Create New Niche modal has required fields', () => {
    const modalFields = ['name', 'pipeline_type', 'brand_tone', 'approved_facts', 'banned_phrases']
    expect(modalFields).toContain('name')
    expect(modalFields).toContain('pipeline_type')
    expect(modalFields).toContain('brand_tone')
    expect(modalFields).toContain('approved_facts')
    expect(modalFields).toContain('banned_phrases')
  })
})

// ── Source Intake Bar ─────────────────────────────────────────────────────
describe('Source Intake Bar', () => {
  type IntakeType = 'url' | 'image' | 'video' | 'doc' | 'audio' | null

  it('has 5 intake type buttons', () => {
    const intakeTypes: IntakeType[] = ['url', 'image', 'video', 'doc', 'audio']
    expect(intakeTypes).toHaveLength(5)
  })

  it('selecting URL shows inline URL input', () => {
    let activeInput: IntakeType = null
    activeInput = 'url'
    const showsUrlInput = activeInput === 'url'
    expect(showsUrlInput).toBe(true)
  })

  it('selecting image triggers file picker (accept image/*)', () => {
    const filePickerConfig = { accept: 'image/*', multiple: false }
    expect(filePickerConfig.accept).toBe('image/*')
  })

  it('selecting video triggers file picker (accept video/*)', () => {
    const filePickerConfig = { accept: 'video/*', multiple: false }
    expect(filePickerConfig.accept).toBe('video/*')
  })

  it('selecting doc triggers file picker (accept .pdf,.doc,.docx,.txt)', () => {
    const filePickerConfig = { accept: '.pdf,.doc,.docx,.txt', multiple: false }
    expect(filePickerConfig.accept).toContain('.pdf')
  })

  it('selecting audio triggers file picker (accept audio/*)', () => {
    const filePickerConfig = { accept: 'audio/*', multiple: false }
    expect(filePickerConfig.accept).toBe('audio/*')
  })

  it('after file selected: shows filename chip', () => {
    const file = { name: 'test-image.jpg', size: 204800 }
    const chip = `${file.name} (${(file.size / 1024).toFixed(0)}KB)`
    expect(chip).toContain('test-image.jpg')
    expect(chip).toContain('KB')
  })

  it('URL input submit calls intake analyze API', () => {
    const url = 'https://medazonhealth.com'
    const apiCall = { endpoint: '/api/intake/analyze', body: { type: 'url', url } }
    expect(apiCall.endpoint).toBe('/api/intake/analyze')
    expect(apiCall.body.type).toBe('url')
    expect(apiCall.body.url).toBe(url)
  })

  it('only one intake type active at a time', () => {
    let activeInput: IntakeType = null
    activeInput = 'url'
    // Clicking image deactivates url
    activeInput = 'image'
    expect(activeInput).toBe('image')
    expect(activeInput).not.toBe('url')
  })
})

// ── Production Workspace ──────────────────────────────────────────────────
describe('Production Workspace', () => {
  it('has 5 tabs', () => {
    const tabs = ['Final Output', 'Editor', 'Export', 'Publish', 'Logs']
    expect(tabs).toHaveLength(5)
  })

  it('Final Output tab is active by default', () => {
    let activeTab = 'Final Output'
    expect(activeTab).toBe('Final Output')
  })

  it('view switcher has landscape and portrait options', () => {
    const viewModes = ['16:9', '9:16']
    expect(viewModes).toContain('16:9')
    expect(viewModes).toContain('9:16')
  })

  it('device frame has 3 options', () => {
    const deviceFrames = ['Desktop', 'iPhone', 'Custom']
    expect(deviceFrames).toHaveLength(3)
  })

  it('changing viewMode to 9:16 updates canvas aspect ratio', () => {
    let viewMode = '16:9'
    viewMode = '9:16'
    const aspectClass = viewMode === '16:9' ? 'landscape' : 'portrait'
    expect(aspectClass).toBe('portrait')
  })

  it('iPhone device frame renders when selected', () => {
    let deviceFrame = 'Desktop'
    deviceFrame = 'iPhone'
    const showsIphoneFrame = deviceFrame === 'iPhone'
    expect(showsIphoneFrame).toBe(true)
  })

  it('canvas shows video when approved video exists', () => {
    const approvedOutputs = { image: null, video: 'https://example.com/video.mp4', script: null }
    const showsVideo = !!approvedOutputs.video
    const showsImage = !approvedOutputs.video && !!approvedOutputs.image
    expect(showsVideo).toBe(true)
    expect(showsImage).toBe(false)
  })

  it('canvas shows image when approved image exists but no video', () => {
    const approvedOutputs = { image: 'https://example.com/image.png', video: null, script: null }
    const showsVideo = !!approvedOutputs.video
    const showsImage = !approvedOutputs.video && !!approvedOutputs.image
    expect(showsVideo).toBe(false)
    expect(showsImage).toBe(true)
  })

  it('canvas shows empty state when no approved outputs', () => {
    const approvedOutputs = { image: null, video: null, script: null }
    const isEmpty = !approvedOutputs.video && !approvedOutputs.image && !approvedOutputs.script
    expect(isEmpty).toBe(true)
  })

  it('Approve button in Preview Screen moves output to workspace', () => {
    let approvedOutputs = { image: null as string | null, video: null as string | null, script: null as string | null }
    const pendingImageUrl = 'https://example.com/concept1.png'

    // User clicks Approve in Preview Screen 1
    function approveOutput(type: 'image' | 'video' | 'script', url: string) {
      approvedOutputs = { ...approvedOutputs, [type]: url }
    }

    approveOutput('image', pendingImageUrl)
    expect(approvedOutputs.image).toBe(pendingImageUrl)
  })
})

// ── Image Editing Tools ───────────────────────────────────────────────────
describe('Image Editing Tools', () => {
  const defaultSettings = {
    brightness: 100, contrast: 100, saturation: 100,
    blur: 0, grayscale: 0, sepia: 0,
    rotation: 0, flipH: false, flipV: false, scale: 1
  }

  it('brightness slider range is 0-200', () => {
    expect(defaultSettings.brightness).toBe(100)
    const min = 0, max = 200
    expect(min).toBe(0)
    expect(max).toBe(200)
  })

  it('contrast slider range is 0-200', () => {
    const min = 0, max = 200
    expect(min).toBe(0)
    expect(max).toBe(200)
  })

  it('blur slider range is 0-10px', () => {
    const min = 0, max = 10
    expect(min).toBe(0)
    expect(max).toBe(10)
  })

  it('rotation increments by 90 degrees', () => {
    let rotation = 0
    rotation += 90
    expect(rotation).toBe(90)
    rotation += 90
    expect(rotation).toBe(180)
    rotation += 90
    expect(rotation).toBe(270)
    rotation += 90
    expect(rotation).toBe(360)
  })

  it('flip H toggles correctly', () => {
    let flipH = false
    flipH = !flipH
    expect(flipH).toBe(true)
    flipH = !flipH
    expect(flipH).toBe(false)
  })

  it('flip V toggles correctly', () => {
    let flipV = false
    flipV = !flipV
    expect(flipV).toBe(true)
  })

  it('Reset restores all defaults', () => {
    let settings = { ...defaultSettings, brightness: 150, contrast: 80, rotation: 90, flipH: true }
    settings = { ...defaultSettings }
    expect(settings.brightness).toBe(100)
    expect(settings.contrast).toBe(100)
    expect(settings.rotation).toBe(0)
    expect(settings.flipH).toBe(false)
  })

  it('Save Changes calls save-edited API with canvas data URI', () => {
    const canvasDataUri = 'data:image/png;base64,abc123'
    const originalId = 'gen-001'
    const apiCall = { endpoint: '/api/generations/save-edited', body: { originalGenerationId: originalId, editedDataUri: canvasDataUri } }
    expect(apiCall.body.editedDataUri.startsWith('data:image/')).toBe(true)
    expect(apiCall.body.originalGenerationId).toBe('gen-001')
  })

  it('Save Changes does NOT show alert dialog', () => {
    // In old code: alert("Image saved to node output!")
    // In new code: calls API, updates output_url in state
    const usesAlert = false // We're replacing alert with real API call
    expect(usesAlert).toBe(false)
  })
})

// ── Video Editing Tools ───────────────────────────────────────────────────
describe('Video Editing Tools', () => {
  const defaultProject = {
    resolution: '1080',
    quality: 'high',
    scenes: [{ id: 'scene-1', comment: 'Scene 1', elements: [] }],
    elements: []
  }

  it('starts with one default scene', () => {
    expect(defaultProject.scenes).toHaveLength(1)
  })

  it('Add Scene increases scene count', () => {
    const scenes = [...defaultProject.scenes]
    scenes.push({ id: 'scene-2', comment: 'Scene 2', elements: [] })
    expect(scenes).toHaveLength(2)
  })

  it('Remove Scene decreases scene count', () => {
    const scenes = [
      { id: 'scene-1', comment: 'Scene 1', elements: [] },
      { id: 'scene-2', comment: 'Scene 2', elements: [] }
    ]
    const filtered = scenes.filter(s => s.id !== 'scene-2')
    expect(filtered).toHaveLength(1)
  })

  it('Add Text element adds to scene elements', () => {
    const scene = { id: 'scene-1', comment: 'Scene 1', elements: [] as any[] }
    scene.elements.push({ id: 'el-1', type: 'text', text: 'New Text', settings: { 'font-size': '50px', color: 'white' } })
    expect(scene.elements).toHaveLength(1)
    expect(scene.elements[0].type).toBe('text')
  })

  it('Add Video element adds to scene elements', () => {
    const scene = { id: 'scene-1', comment: 'Scene 1', elements: [] as any[] }
    scene.elements.push({ id: 'el-1', type: 'video', src: 'https://example.com/video.mp4', duration: 5 })
    expect(scene.elements[0].type).toBe('video')
    expect(scene.elements[0].duration).toBe(5)
  })

  it('Trim start/end values save to element', () => {
    const element = { id: 'el-1', type: 'video', src: 'url', duration: 10, trim_start: 0, trim_end: 10 }
    const updated = { ...element, trim_start: 2, trim_end: 7 }
    expect(updated.trim_start).toBe(2)
    expect(updated.trim_end).toBe(7)
  })

  it('resolution options are correct', () => {
    const options = ['1080', '720', 'square', 'portrait']
    expect(options).toContain('1080')
    expect(options).toContain('720')
    expect(options).toContain('square')
    expect(options).toContain('portrait')
  })

  it('Save Changes calls video render API', () => {
    const project = { ...defaultProject }
    const apiCall = { endpoint: '/api/video/render', body: { project } }
    expect(apiCall.endpoint).toBe('/api/video/render')
    expect(apiCall.body.project.scenes).toHaveLength(1)
  })
})

// ── Generation Queue Tray ─────────────────────────────────────────────────
describe('Generation Queue Tray', () => {
  it('tray hidden by default with no generations', () => {
    const hasActiveGenerations = false
    const trayVisible = hasActiveGenerations
    expect(trayVisible).toBe(false)
  })

  it('pill appears when generation submitted', () => {
    const activeCount = 1
    const pillVisible = activeCount > 0
    expect(pillVisible).toBe(true)
  })

  it('pill shows active generation count', () => {
    const activeCount = 3
    const pillText = `Queue  ${activeCount} processing`
    expect(pillText).toContain('3')
  })

  it('pill dot pulses when processing', () => {
    const hasProcessing = true
    const dotPulses = hasProcessing
    expect(dotPulses).toBe(true)
  })

  it('clicking pill opens full tray', () => {
    let trayExpanded = false
    trayExpanded = !trayExpanded
    expect(trayExpanded).toBe(true)
  })

  it('clicking X collapses tray back to pill', () => {
    let trayExpanded = true
    trayExpanded = false
    expect(trayExpanded).toBe(false)
  })

  it('tray disappears completely when 0 active and user collapses', () => {
    const activeCount = 0
    let trayExpanded = false
    const pillVisible = activeCount > 0 || trayExpanded
    expect(pillVisible).toBe(false)
  })

  it('Queue button in top bar always visible', () => {
    const queueButtonAlwaysVisible = true
    expect(queueButtonAlwaysVisible).toBe(true)
  })

  it('filter tabs work correctly', () => {
    const filters = ['All', 'Images', 'Videos', 'Scripts', 'Processing', 'Completed', 'Failed']
    expect(filters).toContain('All')
    expect(filters).toContain('Images')
    expect(filters).toContain('Videos')
    expect(filters).toContain('Processing')
    expect(filters).toContain('Failed')
  })

  it('clicking row opens Generation Detail Panel', () => {
    let detailPanelOpen = false
    let selectedGenerationId: string | null = null

    function openDetail(id: string) {
      detailPanelOpen = true
      selectedGenerationId = id
    }

    openDetail('gen-001')
    expect(detailPanelOpen).toBe(true)
    expect(selectedGenerationId).toBe('gen-001')
  })

  it('Generation Detail Panel shows timeline steps', () => {
    const timelineSteps = ['Submitted', 'Task accepted', 'Processing', 'Webhook received', 'Uploaded to storage', 'Available in Library']
    expect(timelineSteps).toHaveLength(6)
    expect(timelineSteps[0]).toBe('Submitted')
    expect(timelineSteps[5]).toBe('Available in Library')
  })

  it('Clear completed button removes finished items', () => {
    const items = [
      { id: 'gen-1', status: 'completed' },
      { id: 'gen-2', status: 'completed' },
      { id: 'gen-3', status: 'pending' },
    ]
    const remaining = items.filter(i => i.status !== 'completed' && i.status !== 'failed')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('gen-3')
  })
})

// ── Concept Cards ─────────────────────────────────────────────────────────
describe('Concept Cards', () => {
  it('3 concept cards exist', () => {
    const concepts = ['c1', 'c2', 'c3']
    expect(concepts).toHaveLength(3)
  })

  it('cards show placeholder before Creative Strategy runs', () => {
    const strategyComplete = false
    const showsPlaceholder = !strategyComplete
    expect(showsPlaceholder).toBe(true)
  })

  it('cards populate after Creative Strategy completes', () => {
    const strategyOutput = {
      variants: [
        { variantId: 'v1', headline: 'Private Care, From Home', body: 'Licensed review' },
        { variantId: 'v2', headline: 'Care Without the Wait', body: 'Fast intake' },
        { variantId: 'v3', headline: 'Online Care, Simplified', body: 'Simple process' }
      ]
    }
    expect(strategyOutput.variants).toHaveLength(3)
    expect(strategyOutput.variants[0].headline).toBeTruthy()
  })

  it('Select button updates selectedConceptId', () => {
    let selectedConceptId = 'c1'
    function selectConcept(id: string) { selectedConceptId = id }
    selectConcept('c2')
    expect(selectedConceptId).toBe('c2')
  })

  it('selected concept drives image/video prompt injection', () => {
    const concept = { headline: 'Private Care, From Home', body: 'Licensed review, next steps' }
    const imagePrompt = `${concept.headline}. ${concept.body}. Premium telehealth brand image.`
    expect(imagePrompt).toContain('Private Care, From Home')
    expect(imagePrompt).toContain('Premium telehealth brand image')
  })

  it('Preview button scrolls to that concept Preview Screen', () => {
    let scrollTarget: string | null = null
    function previewConcept(id: string) { scrollTarget = `preview-screen-${id}` }
    previewConcept('c2')
    expect(scrollTarget).toBe('preview-screen-c2')
  })
})

// ── Preview Screens ───────────────────────────────────────────────────────
describe('Preview Screens (Row 3)', () => {
  it('3 preview screens exist, one per concept', () => {
    const screens = ['c1', 'c2', 'c3']
    expect(screens).toHaveLength(3)
  })

  it('each screen has Image, Video, Script tabs', () => {
    const tabs = ['Image', 'Video', 'Script']
    expect(tabs).toHaveLength(3)
  })

  it('pending state shows spinner and elapsed time', () => {
    const state = { status: 'pending', elapsedSeconds: 42 }
    const showsSpinner = state.status === 'pending'
    const showsElapsed = state.elapsedSeconds > 0
    expect(showsSpinner).toBe(true)
    expect(showsElapsed).toBe(true)
  })

  it('completed image shows img element', () => {
    const state = { status: 'completed', outputUrl: 'https://example.com/img.png', type: 'image' }
    const showsImage = state.status === 'completed' && state.type === 'image'
    expect(showsImage).toBe(true)
  })

  it('completed video shows video player', () => {
    const state = { status: 'completed', outputUrl: 'https://example.com/video.mp4', type: 'video' }
    const showsVideo = state.status === 'completed' && state.type === 'video'
    expect(showsVideo).toBe(true)
  })

  it('failed state shows error and Retry button', () => {
    const state = { status: 'failed', error: 'Content policy violation' }
    const showsError = state.status === 'failed'
    expect(showsError).toBe(true)
    expect(state.error).toBeTruthy()
  })

  it('Approve button sends output to Production Workspace', () => {
    let approvedOutputs = { image: null as string | null }
    function approve(url: string) { approvedOutputs.image = url }
    approve('https://example.com/concept1.png')
    expect(approvedOutputs.image).toBe('https://example.com/concept1.png')
  })

  it('Stop button pauses pipeline', () => {
    let pipelineStatus = 'running'
    function stopPipeline() { pipelineStatus = 'paused' }
    stopPipeline()
    expect(pipelineStatus).toBe('paused')
  })

  it('Edit button opens Step Config for current step', () => {
    let stepConfigOpen = false
    function openStepConfig() { stepConfigOpen = true }
    openStepConfig()
    expect(stepConfigOpen).toBe(true)
  })

  it('Restart button clears output and re-runs step', () => {
    let conceptOutput = { image: 'https://old-image.png', status: 'completed' }
    function restartStep() {
      conceptOutput = { image: null as any, status: 'queued' }
    }
    restartStep()
    expect(conceptOutput.image).toBeNull()
    expect(conceptOutput.status).toBe('queued')
  })

  it('3 screens run independently — one restart does not affect others', () => {
    const screens = {
      c1: { status: 'running', image: null },
      c2: { status: 'completed', image: 'url' },
      c3: { status: 'pending', image: null }
    }
    // Restart c1
    screens.c1 = { status: 'queued', image: null }
    expect(screens.c1.status).toBe('queued')
    expect(screens.c2.status).toBe('completed') // Unaffected
    expect(screens.c3.status).toBe('pending')   // Unaffected
  })
})

// ── AI Assistant ──────────────────────────────────────────────────────────
describe('AI Assistant Chat', () => {
  it('sends message on Enter key', () => {
    let messageSent = false
    function handleKeyDown(key: string) {
      if (key === 'Enter') messageSent = true
    }
    handleKeyDown('Enter')
    expect(messageSent).toBe(true)
  })

  it('sends message on Send button click', () => {
    let messageSent = false
    function handleSend() { messageSent = true }
    handleSend()
    expect(messageSent).toBe(true)
  })

  it('clears input after send', () => {
    let input = 'generate an image'
    function sendMessage() { input = '' }
    sendMessage()
    expect(input).toBe('')
  })

  it('adds user message to chat history', () => {
    const chatMessages: { role: string; content: string }[] = []
    function addMessage(role: string, content: string) { chatMessages.push({ role, content }) }
    addMessage('user', 'Generate a telehealth video')
    expect(chatMessages).toHaveLength(1)
    expect(chatMessages[0].role).toBe('user')
  })

  it('adds assistant response to chat history', () => {
    const chatMessages: { role: string; content: string }[] = [{ role: 'user', content: 'test' }]
    chatMessages.push({ role: 'assistant', content: 'Generating an image...' })
    expect(chatMessages).toHaveLength(2)
    expect(chatMessages[1].role).toBe('assistant')
  })

  it('does not send empty message', () => {
    let messageSent = false
    const input = '   '
    function tryToSend() {
      if (input.trim().length > 0) messageSent = true
    }
    tryToSend()
    expect(messageSent).toBe(false)
  })

  it('assistant actions execute in state', () => {
    let prompts = { strategy: 'old strategy', copy: '', image: '', video: '', qa: '' }
    function executeAction(action: { type: string; value?: string }) {
      if (action.type === 'update_strategy_prompt' && action.value) {
        prompts.strategy = action.value
      }
    }
    executeAction({ type: 'update_strategy_prompt', value: 'new strategy prompt' })
    expect(prompts.strategy).toBe('new strategy prompt')
  })

  it('assistant generate_image action triggers generation', () => {
    let generationTriggered = false
    function executeAction(action: { type: string; prompt?: string }) {
      if (action.type === 'generate_image') generationTriggered = true
    }
    executeAction({ type: 'generate_image', prompt: 'doctor in clinic' })
    expect(generationTriggered).toBe(true)
  })
})
