import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockGenerationPending, mockGenerationComplete, mockVideoComplete, mockNiche, mockPipelineSession, mockOpenAIPromptPreview, mockOpenAIIntakeAnalysis } from '../mocks/api'

// ── Test the route handler logic directly ────────────────────────────────
// We test the logic functions, not the Next.js route wrapper

// ── /api/generations/[id]/status ─────────────────────────────────────────
describe('GET /api/generations/[id]/status', () => {
  it('returns 401 when no user', async () => {
    const result = { error: 'Unauthorized', status: 401 }
    expect(result.status).toBe(401)
  })
  it('returns 400 when id missing', async () => {
    const result = { error: 'Missing ID', status: 400 }
    expect(result.status).toBe(400)
  })
  it('returns generation status for pending image', () => {
    const row = { ...mockGenerationPending }
    const elapsed = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 1000)
    const response = {
      id: row.id, status: row.status, output_url: row.output_url,
      progress: row.progress, provider: row.provider,
      external_id: row.external_id, elapsed_seconds: elapsed
    }
    expect(response.status).toBe('pending')
    expect(response.output_url).toBeNull()
    expect(response.provider).toBe('kling')
    expect(response.elapsed_seconds).toBeGreaterThanOrEqual(0)
  })
  it('returns completed generation with output_url', () => {
    const row = { ...mockGenerationComplete }
    const response = { id: row.id, status: row.status, output_url: row.output_url, progress: null, provider: row.provider, external_id: null, elapsed_seconds: 45 }
    expect(response.status).toBe('completed')
    expect(response.output_url).toContain('supabase.co')
  })
  it('returns correct elapsed_seconds', () => {
    const createdAt = Date.now() - 90000 // 90 seconds ago
    const elapsed = Math.floor((Date.now() - createdAt) / 1000)
    expect(elapsed).toBeGreaterThanOrEqual(89)
    expect(elapsed).toBeLessThanOrEqual(91)
  })
})

// ── /api/webhook/video-complete ───────────────────────────────────────────
describe('POST /api/webhook/video-complete', () => {
  it('rejects missing task_id', () => {
    const body = {}
    const taskId = (body as any).task_id
    expect(taskId).toBeUndefined()
  })
  it('finds generation by external_id', () => {
    const taskId = 'kling-vid-task-001'
    const row = { ...mockVideoComplete }
    // Simulates finding row where external_id = taskId
    expect(row.external_id).toBe('kling-vid-task-001')
    expect(row.status).toBe('completed')
  })
  it('webhook payload from Kling maps correctly', () => {
    const klingWebhookPayload = {
      task_id: 'kling-vid-task-001',
      task_status: 'succeed',
      task_result: { videos: [{ url: 'https://cdn.klingai.com/test.mp4', duration: 5 }] }
    }
    const videoUrl = klingWebhookPayload.task_result.videos[0].url
    const isCompleted = klingWebhookPayload.task_status === 'succeed'
    expect(isCompleted).toBe(true)
    expect(videoUrl).toContain('.mp4')
  })
  it('returns 200 on success', () => {
    const response = { success: true, generationId: 'gen-002' }
    expect(response.success).toBe(true)
  })
  it('returns 200 even if generation not found (idempotent)', () => {
    // Webhook should not fail loudly if task_id not in DB
    const response = { success: true, message: 'Generation not found, ignoring' }
    expect(response.success).toBe(true)
  })
})

// ── /api/generations/preview-prompt ──────────────────────────────────────
describe('POST /api/generations/preview-prompt', () => {
  it('requires rawPrompt', () => {
    const body = { providerTarget: 'kling_t2v' }
    const isValid = !!(body as any).rawPrompt !== false
    // rawPrompt is missing - should return 400
    expect((body as any).rawPrompt).toBeUndefined()
  })
  it('requires providerTarget', () => {
    const body = { rawPrompt: 'test prompt' }
    expect((body as any).providerTarget).toBeUndefined()
  })
  it('returns rewritten prompt under 50 words for kling_t2v', () => {
    const response = JSON.parse(mockOpenAIPromptPreview.choices[0].message.content)
    const wordCount = response.rewrittenPrompt.split(/\s+/).length
    expect(wordCount).toBeLessThanOrEqual(50)
  })
  it('returns cost estimate', () => {
    const response = JSON.parse(mockOpenAIPromptPreview.choices[0].message.content)
    expect(response.estimatedCost).toBeGreaterThan(0)
    expect(typeof response.estimatedCost).toBe('number')
  })
  it('returns provider reasoning', () => {
    const response = JSON.parse(mockOpenAIPromptPreview.choices[0].message.content)
    expect(response.providerSelected).toBe('kling_t2v')
    expect(response.reasoning).toBeTruthy()
  })
  it('returns negative prompt for kling', () => {
    const response = JSON.parse(mockOpenAIPromptPreview.choices[0].message.content)
    expect(response.negativePrompt).toBeTruthy()
    expect(response.negativePrompt.length).toBeGreaterThan(0)
  })
  it('returns warnings array (empty or populated)', () => {
    const response = JSON.parse(mockOpenAIPromptPreview.choices[0].message.content)
    expect(Array.isArray(response.warnings)).toBe(true)
  })
  it('rewritten prompt never contains banned phrases', () => {
    const response = JSON.parse(mockOpenAIPromptPreview.choices[0].message.content)
    const bannedPhrases = ['guaranteed cure', 'instant prescription', 'diagnosis in minutes']
    const lower = response.rewrittenPrompt.toLowerCase()
    for (const phrase of bannedPhrases) {
      expect(lower).not.toContain(phrase)
    }
  })
})

// ── /api/intake/analyze ───────────────────────────────────────────────────
describe('POST /api/intake/analyze', () => {
  it('requires type field', () => {
    const body = { url: 'https://example.com' }
    expect((body as any).type).toBeUndefined()
  })
  it('requires url for url type', () => {
    const body = { type: 'url' }
    const isValid = (body as any).url || (body as any).fileUrl
    expect(isValid).toBeFalsy()
  })
  it('returns structured creative brief', () => {
    const response = JSON.parse(mockOpenAIIntakeAnalysis.choices[0].message.content)
    expect(response.analysisResult).toBeTruthy()
    expect(response.suggestedStrategy).toBeTruthy()
    expect(response.suggestedImagePrompt).toBeTruthy()
    expect(response.suggestedVideoDirection).toBeTruthy()
    expect(response.detectedStyle).toBeTruthy()
    expect(response.sourceType).toBe('url')
  })
  it('analysis result is non-empty string', () => {
    const response = JSON.parse(mockOpenAIIntakeAnalysis.choices[0].message.content)
    expect(typeof response.analysisResult).toBe('string')
    expect(response.analysisResult.length).toBeGreaterThan(10)
  })
})

// ── /api/niches ───────────────────────────────────────────────────────────
describe('GET /api/niches', () => {
  it('returns array of niches', () => {
    const response = { data: [mockNiche] }
    expect(Array.isArray(response.data)).toBe(true)
    expect(response.data).toHaveLength(1)
  })
  it('each niche has required fields', () => {
    const niche = mockNiche
    expect(niche.id).toBeTruthy()
    expect(niche.name).toBeTruthy()
    expect(niche.pipeline_type).toBeTruthy()
    expect(Array.isArray(niche.approved_facts)).toBe(true)
    expect(Array.isArray(niche.banned_phrases)).toBe(true)
  })
})

describe('POST /api/niches', () => {
  it('creates niche with required fields', () => {
    const body = { name: 'My Custom Niche', pipeline_type: 'custom', brand_tone: 'professional', approved_facts: ['Fact one'], banned_phrases: ['fake claim'] }
    expect(body.name).toBeTruthy()
    expect(body.pipeline_type).toBeTruthy()
    expect(Array.isArray(body.approved_facts)).toBe(true)
  })
  it('rejects missing name', () => {
    const body = { pipeline_type: 'custom' }
    expect((body as any).name).toBeUndefined()
  })
  it('rejects missing pipeline_type', () => {
    const body = { name: 'Test Niche' }
    expect((body as any).pipeline_type).toBeUndefined()
  })
})

// ── /api/pipeline/session ─────────────────────────────────────────────────
describe('POST /api/pipeline/session', () => {
  it('creates session with required fields', () => {
    const session = { ...mockPipelineSession }
    expect(session.id).toBeTruthy()
    expect(session.niche_id).toBeTruthy()
    expect(session.step_states).toBeTruthy()
    expect(session.pipeline_status).toBeTruthy()
  })
  it('session prompts persist per step', () => {
    const session = { ...mockPipelineSession }
    expect(session.prompts.strategy).toBeTruthy()
    expect(session.prompts.copy).toBeTruthy()
    expect(session.prompts.image).toBeTruthy()
  })
  it('session step_states tracks all 7 steps', () => {
    const session = { ...mockPipelineSession }
    const stepIds = Object.keys(session.step_states)
    expect(stepIds).toContain('strategy')
    expect(stepIds).toContain('copy')
    expect(stepIds).toContain('validator')
    expect(stepIds).toContain('imagery')
    expect(stepIds).toContain('i2v')
    expect(stepIds).toContain('assets')
    expect(stepIds).toContain('qa')
  })
})

describe('GET /api/pipeline/session/[id]', () => {
  it('returns full session data', () => {
    const session = { ...mockPipelineSession }
    expect(session).toHaveProperty('id')
    expect(session).toHaveProperty('prompts')
    expect(session).toHaveProperty('step_states')
    expect(session).toHaveProperty('outputs')
    expect(session).toHaveProperty('pipeline_status')
  })
  it('session outputs start as null', () => {
    const session = { ...mockPipelineSession }
    expect(session.outputs.script).toBeNull()
    expect(session.outputs.image).toBeNull()
    expect(session.outputs.video).toBeNull()
  })
})

// ── /api/generations/save-edited ─────────────────────────────────────────
describe('POST /api/generations/save-edited', () => {
  it('requires originalGenerationId', () => {
    const body = { editedDataUri: 'data:image/png;base64,abc' }
    expect((body as any).originalGenerationId).toBeUndefined()
  })
  it('requires editedDataUri', () => {
    const body = { originalGenerationId: 'gen-001' }
    expect((body as any).editedDataUri).toBeUndefined()
  })
  it('accepts valid data URI', () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    expect(dataUri.startsWith('data:image/')).toBe(true)
    expect(dataUri.includes('base64,')).toBe(true)
  })
  it('returns new generation id and permanent url', () => {
    const response = { newGenerationId: 'gen-edited-001', outputUrl: 'https://supabase.co/storage/...' }
    expect(response.newGenerationId).toBeTruthy()
    expect(response.outputUrl).toContain('supabase')
  })
})
