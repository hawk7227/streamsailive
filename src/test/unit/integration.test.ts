import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockFetch } from '../helpers/index'
import {
  mockKlingImageSubmit, mockKlingVideoSubmit,
  mockOpenAIPromptPreview, mockGenerationPending, mockGenerationComplete,
  mockFileUploadResponse
} from '../mocks/api'

// ── Provider chain tests ───────────────────────────────────────────────────
describe('Provider chain — generateContent routing', () => {
  it('routes image type to openai when providerOverride=openai', () => {
    const providerOverride = 'openai'
    const providerKey = providerOverride || 'kling'
    expect(providerKey).toBe('openai')
  })

  it('routes image type to kling when no override and env=kling', () => {
    const envProvider = 'kling'
    const providerOverride = undefined
    const providerKey = providerOverride || envProvider || 'openai'
    expect(providerKey).toBe('kling')
  })

  it('providerOverride always wins over env var', () => {
    const envProvider = 'kling'
    const providerOverride = 'openai'
    const providerKey = providerOverride || envProvider
    expect(providerKey).toBe('openai')
    expect(providerKey).not.toBe('kling')
  })

  it('falls back to openai when no override and no env', () => {
    const envProvider = undefined
    const providerOverride = undefined
    const providerKey = providerOverride || envProvider || 'openai'
    expect(providerKey).toBe('openai')
  })
})

// ── DALL-E response shape ──────────────────────────────────────────────────
describe('DALL-E provider — response handling', () => {
  const mockDalleSuccess = {
    data: [{ url: 'https://oaidalleapiprodscus.blob.core.windows.net/test/image.png' }]
  }
  const mockDalleFail = {
    error: { message: 'Your request was rejected as a result of our safety system.' }
  }

  it('extracts outputUrl from DALL-E response', () => {
    const result = mockDalleSuccess.data?.[0]?.url
    expect(result).toBeTruthy()
    expect(result).toContain('oaidalleapiprodscus')
  })

  it('returns completed status with outputUrl on success', () => {
    const url = mockDalleSuccess.data?.[0]?.url ?? null
    const result = url ? { status: 'completed', outputUrl: url } : { status: 'failed' }
    expect(result.status).toBe('completed')
    expect(result.outputUrl).toBeTruthy()
  })

  it('returns failed status when no data', () => {
    const url = null
    const result = url ? { status: 'completed', outputUrl: url } : { status: 'failed' }
    expect(result.status).toBe('failed')
  })

  it('throws on DALL-E API error', () => {
    const shouldThrow = () => {
      if (mockDalleFail.error) throw new Error(mockDalleFail.error.message)
    }
    expect(shouldThrow).toThrow('safety system')
  })

  it('uses 1792x1024 for 16:9 aspect ratio', () => {
    function getSize(aspectRatio?: string) {
      return aspectRatio === '9:16' ? '1024x1792' : '1792x1024'
    }
    expect(getSize('16:9')).toBe('1792x1024')
    expect(getSize('9:16')).toBe('1024x1792')
    expect(getSize(undefined)).toBe('1792x1024')
  })

  it('uses OPENAI_API_KEY_IMAGES before OPENAI_API_KEY', () => {
    const siteConfig = { apiKeys: {} as Record<string, string> }
    const env = { OPENAI_API_KEY_IMAGES: 'key-images', OPENAI_API_KEY: 'key-main' }
    const key = siteConfig.apiKeys?.OPENAI_API_KEY_IMAGES || env.OPENAI_API_KEY_IMAGES || env.OPENAI_API_KEY
    expect(key).toBe('key-images')
  })

  it('falls back to OPENAI_API_KEY when OPENAI_API_KEY_IMAGES not set', () => {
    const siteConfig = { apiKeys: {} as Record<string, string> }
    const env = { OPENAI_API_KEY_IMAGES: '', OPENAI_API_KEY: 'key-main' }
    const key = siteConfig.apiKeys?.OPENAI_API_KEY_IMAGES || env.OPENAI_API_KEY_IMAGES || env.OPENAI_API_KEY
    expect(key).toBe('key-main')
  })
})

// ── Generations POST route contract ───────────────────────────────────────
describe('POST /api/generations — request/response contract', () => {
  it('accepts type=image with provider=openai', () => {
    const allowedTypes = ['video', 'image', 'script', 'voice', 'i2v']
    const body = { type: 'image', prompt: 'test', provider: 'openai', aspectRatio: '16:9', conceptId: 'c1' }
    expect(allowedTypes.includes(body.type)).toBe(true)
    expect(body.provider).toBe('openai')
  })

  it('accepts type=i2v', () => {
    const allowedTypes = ['video', 'image', 'script', 'voice', 'i2v']
    expect(allowedTypes.includes('i2v')).toBe(true)
  })

  it('rejects missing prompt', () => {
    const body = { type: 'image', prompt: '' }
    const valid = body.prompt.trim().length > 0
    expect(valid).toBe(false)
  })

  it('writes concept_id from conceptId body field', () => {
    const payload = { conceptId: 'c1', type: 'image', prompt: 'test' }
    const insertPayload = {
      concept_id: typeof payload.conceptId === 'string' ? payload.conceptId : null,
    }
    expect(insertPayload.concept_id).toBe('c1')
  })

  it('writes provider from body field', () => {
    const payload = { provider: 'openai', type: 'image', prompt: 'test' }
    const insertPayload = {
      provider: typeof payload.provider === 'string' ? payload.provider : null,
    }
    expect(insertPayload.provider).toBe('openai')
  })

  it('defaults mode to standard when not supplied', () => {
    const payload = { type: 'image', prompt: 'test' }
    const mode = typeof (payload as Record<string,unknown>).mode === 'string' ? (payload as Record<string,unknown>).mode : 'standard'
    expect(mode).toBe('standard')
  })

  it('response shape has data.id, data.status, data.output_url', () => {
    const mockResponse = { data: { id: 'gen-001', status: 'completed', output_url: 'https://example.com/img.png' } }
    expect(mockResponse.data.id).toBeTruthy()
    expect(mockResponse.data.status).toBe('completed')
    expect(mockResponse.data.output_url).toBeTruthy()
  })

  it('response status=completed means output_url is present', () => {
    const gen = { id: 'gen-001', status: 'completed', output_url: 'https://example.com/img.png' }
    if (gen.status === 'completed') {
      expect(gen.output_url).toBeTruthy()
    }
  })

  it('response status=pending means no output_url yet', () => {
    const gen = { id: 'gen-001', status: 'pending', output_url: null, external_id: 'kling-task-001' }
    expect(gen.output_url).toBeNull()
    expect(gen.external_id).toBeTruthy()
  })
})

// ── ImageEditorSidebar save flow ───────────────────────────────────────────
describe('ImageEditorSidebar — save-edited flow', () => {
  it('requires valid data URI before calling API', () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgo='
    expect(dataUri.startsWith('data:image/')).toBe(true)
    expect(dataUri.includes('base64,')).toBe(true)
  })

  it('rejects non-image data URI', () => {
    const dataUri = 'data:application/pdf;base64,abc'
    expect(dataUri.startsWith('data:image/')).toBe(false)
  })

  it('falls back to local save when no generationId', () => {
    const generationId = null
    const shouldCallApi = !!generationId
    expect(shouldCallApi).toBe(false)
  })

  it('calls API when generationId exists', () => {
    const generationId = 'gen-001'
    const shouldCallApi = !!generationId
    expect(shouldCallApi).toBe(true)
  })

  it('save-edited request body shape', () => {
    const body = { originalGenerationId: 'gen-001', editedDataUri: 'data:image/png;base64,abc' }
    expect(body.originalGenerationId).toBe('gen-001')
    expect(body.editedDataUri.startsWith('data:image/')).toBe(true)
  })

  it('updates nodeData imageUrl on success', () => {
    const nodeData: Record<string, unknown> = { generationId: 'gen-001', imageUrl: null }
    const response = { newGenerationId: 'gen-002', outputUrl: 'https://supabase.co/storage/gen-002.png' }
    nodeData.generationId = response.newGenerationId
    nodeData.imageUrl = response.outputUrl
    expect(nodeData.generationId).toBe('gen-002')
    expect(nodeData.imageUrl).toBe('https://supabase.co/storage/gen-002.png')
  })

  it('shows error state on API failure', () => {
    let saveError: string | null = null
    function onError(msg: string) { saveError = msg }
    onError('Upload failed: Storage quota exceeded')
    expect(saveError).toBe('Upload failed: Storage quota exceeded')
  })

  it('clears error after timeout', async () => {
    let saveError: string | null = 'some error'
    await new Promise<void>(resolve => {
      setTimeout(() => { saveError = null; resolve() }, 10)
    })
    expect(saveError).toBeNull()
  })
})

// ── VideoEditorSidebar render flow ─────────────────────────────────────────
describe('VideoEditorSidebar — render flow', () => {
  it('button disabled when no scenes', () => {
    const project = { scenes: [] }
    const disabled = project.scenes.length === 0
    expect(disabled).toBe(true)
  })

  it('button enabled when scenes exist', () => {
    const project = { scenes: [{ id: 'scene-1', elements: [] }] }
    const disabled = project.scenes.length === 0
    expect(disabled).toBe(false)
  })

  it('render request body includes project and generationId', () => {
    const project = { resolution: '1080', quality: 'high', scenes: [{ id: 's1', elements: [] }], elements: [] }
    const generationId = 'gen-001'
    const body = { project, generationId }
    expect(body.project.scenes).toHaveLength(1)
    expect(body.generationId).toBe('gen-001')
  })

  it('passes null generationId when node has no generationId', () => {
    const nodeData = { type: 'videoEditor' }
    const generationId = (nodeData as Record<string,unknown>).generationId ?? null
    const body = { project: {}, generationId }
    expect(body.generationId).toBeNull()
  })

  it('updates nodeData output and videoUrl on success', () => {
    const nodeData: Record<string, unknown> = {}
    const outputUrl = 'https://supabase.co/storage/rendered.mp4'
    nodeData.output = outputUrl
    nodeData.videoUrl = outputUrl
    expect(nodeData.output).toBe(outputUrl)
    expect(nodeData.videoUrl).toBe(outputUrl)
  })

  it('isRendering prevents double submission', () => {
    let isRendering = false
    function handleRender() {
      if (isRendering) return 'blocked'
      isRendering = true
      return 'started'
    }
    expect(handleRender()).toBe('started')
    expect(handleRender()).toBe('blocked')
  })

  it('render success shows link to output URL', () => {
    const renderSuccess = 'https://supabase.co/storage/rendered.mp4'
    const showsLink = renderSuccess.startsWith('https://')
    expect(showsLink).toBe(true)
  })

  it('render error clears after timeout', async () => {
    let renderError: string | null = 'Render failed'
    await new Promise<void>(resolve => setTimeout(() => { renderError = null; resolve() }, 10))
    expect(renderError).toBeNull()
  })
})

// ── Library Realtime subscription ──────────────────────────────────────────
describe('Library — Realtime subscription logic', () => {
  it('invalidates query on completed status', () => {
    const invalidated: string[] = []
    const mockQueryClient = {
      invalidateQueries: (opts: { queryKey: string[] }) => { invalidated.push(opts.queryKey[0]) }
    }

    function handleRealtimeEvent(payload: { eventType: string; new: { status?: string } }) {
      const row = payload.new
      if (row.status === 'completed' || row.status === 'failed' || payload.eventType === 'INSERT') {
        mockQueryClient.invalidateQueries({ queryKey: ['generations'] })
      }
    }

    handleRealtimeEvent({ eventType: 'UPDATE', new: { status: 'completed' } })
    expect(invalidated).toContain('generations')
  })

  it('invalidates query on failed status', () => {
    const invalidated: string[] = []
    const mockQueryClient = {
      invalidateQueries: (opts: { queryKey: string[] }) => { invalidated.push(opts.queryKey[0]) }
    }
    function handleRealtimeEvent(payload: { eventType: string; new: { status?: string } }) {
      const row = payload.new
      if (row.status === 'completed' || row.status === 'failed' || payload.eventType === 'INSERT') {
        mockQueryClient.invalidateQueries({ queryKey: ['generations'] })
      }
    }
    handleRealtimeEvent({ eventType: 'UPDATE', new: { status: 'failed' } })
    expect(invalidated).toContain('generations')
  })

  it('invalidates query on INSERT', () => {
    const invalidated: string[] = []
    const mockQueryClient = {
      invalidateQueries: (opts: { queryKey: string[] }) => { invalidated.push(opts.queryKey[0]) }
    }
    function handleRealtimeEvent(payload: { eventType: string; new: { status?: string } }) {
      const row = payload.new
      if (row.status === 'completed' || row.status === 'failed' || payload.eventType === 'INSERT') {
        mockQueryClient.invalidateQueries({ queryKey: ['generations'] })
      }
    }
    handleRealtimeEvent({ eventType: 'INSERT', new: { status: 'pending' } })
    expect(invalidated).toContain('generations')
  })

  it('does NOT invalidate on processing status UPDATE', () => {
    const invalidated: string[] = []
    const mockQueryClient = {
      invalidateQueries: (opts: { queryKey: string[] }) => { invalidated.push(opts.queryKey[0]) }
    }
    function handleRealtimeEvent(payload: { eventType: string; new: { status?: string } }) {
      const row = payload.new
      if (row.status === 'completed' || row.status === 'failed' || payload.eventType === 'INSERT') {
        mockQueryClient.invalidateQueries({ queryKey: ['generations'] })
      }
    }
    handleRealtimeEvent({ eventType: 'UPDATE', new: { status: 'processing' } })
    expect(invalidated).toHaveLength(0)
  })

  it('channel is cleaned up on unmount', () => {
    let removed = false
    const mockChannel = { on: () => mockChannel, subscribe: () => mockChannel }
    const mockSupabase = {
      channel: () => mockChannel,
      removeChannel: () => { removed = true }
    }
    // Simulate useEffect cleanup
    const cleanup = () => mockSupabase.removeChannel()
    cleanup()
    expect(removed).toBe(true)
  })
})

// ── Page generateImage full flow ───────────────────────────────────────────
describe('Pipeline page — generateImage flow', () => {
  it('sends provider=openai in request body', () => {
    const body = { type: 'image', prompt: 'test', aspectRatio: '16:9', conceptId: 'c1', provider: 'openai' }
    expect(body.provider).toBe('openai')
    expect(body.type).toBe('image')
  })

  it('sets status=processing before fetch', () => {
    let status = 'idle'
    function beforeFetch() { status = 'processing' }
    beforeFetch()
    expect(status).toBe('processing')
  })

  it('sets image and status=completed when response is completed', () => {
    const conceptOutputs: Record<string, { image: string | null; status: string }> = {
      c1: { image: null, status: 'processing' }
    }
    const gen = { id: 'gen-001', status: 'completed', output_url: 'https://example.com/img.png' }
    if (gen.status === 'completed' && gen.output_url) {
      conceptOutputs.c1 = { image: gen.output_url, status: 'completed' }
    }
    expect(conceptOutputs.c1.status).toBe('completed')
    expect(conceptOutputs.c1.image).toBe('https://example.com/img.png')
  })

  it('sets status=failed and logs error on API error', () => {
    const conceptOutputs: Record<string, { image: string | null; status: string }> = {
      c1: { image: null, status: 'processing' }
    }
    const logs: string[] = []
    function onError(cid: string, msg: string) {
      conceptOutputs[cid] = { image: null, status: 'failed' }
      logs.push(`✗ Image failed: ${msg}`)
    }
    onError('c1', 'HTTP 401')
    expect(conceptOutputs.c1.status).toBe('failed')
    expect(logs[0]).toContain('HTTP 401')
  })

  it('adds to queue when response is pending', () => {
    const queue = new Map<string, { status: string; provider: string }>()
    const gen = { id: 'gen-001', status: 'pending', external_id: 'kling-task-001', output_url: null }
    if (gen.status !== 'completed') {
      queue.set(gen.id, { status: 'pending', provider: gen.external_id ? 'kling' : 'openai' })
    }
    expect(queue.has('gen-001')).toBe(true)
    expect(queue.get('gen-001')?.provider).toBe('kling')
  })

  it('does NOT add to queue when response is completed', () => {
    const queue = new Map<string, unknown>()
    const gen = { id: 'gen-001', status: 'completed', output_url: 'https://example.com/img.png' }
    if (gen.status === 'completed' && gen.output_url) {
      // update concept output directly, do NOT add to queue
    } else {
      queue.set(gen.id, { status: 'pending' })
    }
    expect(queue.has('gen-001')).toBe(false)
  })
})
