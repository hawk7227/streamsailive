import { describe, it, expect, vi, beforeEach } from 'vitest'

// Queue item type matching what the frontend will use
type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed'
type QueueItem = {
  id: string
  type: 'image' | 'video' | 'script'
  status: QueueStatus
  provider: string
  model?: string | null
  prompt: string
  conceptId: string | null
  startedAt: number
  completedAt: number | null
  outputUrl: string | null
  externalId: string | null
  mode: 'standard' | 'pro'
  costEstimate: number
  elapsedSeconds: number
  estimatedTotalSeconds: number
  error: string | null
}

// The queue manager logic we'll implement in the frontend
class GenerationQueue {
  private items: Map<string, QueueItem> = new Map()

  add(item: Omit<QueueItem, 'startedAt' | 'elapsedSeconds'>): QueueItem {
    const full: QueueItem = { ...item, startedAt: Date.now(), elapsedSeconds: 0 }
    this.items.set(item.id, full)
    return full
  }

  update(id: string, updates: Partial<QueueItem>): QueueItem | null {
    const existing = this.items.get(id)
    if (!existing) return null
    const updated = { ...existing, ...updates }
    if (updates.status === 'completed' || updates.status === 'failed') {
      updated.completedAt = Date.now()
    }
    this.items.set(id, updated)
    return updated
  }

  get(id: string): QueueItem | null {
    return this.items.get(id) ?? null
  }

  getAll(): QueueItem[] {
    return Array.from(this.items.values())
  }

  getByStatus(status: QueueStatus): QueueItem[] {
    return this.getAll().filter(i => i.status === status)
  }

  getByType(type: 'image' | 'video' | 'script'): QueueItem[] {
    return this.getAll().filter(i => i.type === type)
  }

  getByConceptId(conceptId: string): QueueItem[] {
    return this.getAll().filter(i => i.conceptId === conceptId)
  }

  getActive(): QueueItem[] {
    return this.getAll().filter(i => i.status === 'pending' || i.status === 'processing')
  }

  hasActive(): boolean {
    return this.getActive().length > 0
  }

  remove(id: string): boolean {
    return this.items.delete(id)
  }

  clearCompleted(): void {
    for (const [id, item] of this.items.entries()) {
      if (item.status === 'completed' || item.status === 'failed') {
        this.items.delete(id)
      }
    }
  }

  count(): number {
    return this.items.size
  }
}

describe('GenerationQueue — Basic Operations', () => {
  let queue: GenerationQueue

  beforeEach(() => { queue = new GenerationQueue() })

  it('starts empty', () => {
    expect(queue.count()).toBe(0)
    expect(queue.hasActive()).toBe(false)
  })

  it('adds a generation item', () => {
    queue.add({ id: 'gen-1', type: 'image', status: 'pending', provider: 'kling', prompt: 'test', conceptId: 'c1', completedAt: null, outputUrl: null, externalId: 'task-1', mode: 'standard', costEstimate: 0.04, estimatedTotalSeconds: 60, error: null })
    expect(queue.count()).toBe(1)
  })

  it('retrieves a generation by id', () => {
    queue.add({ id: 'gen-1', type: 'image', status: 'pending', provider: 'kling', prompt: 'test', conceptId: 'c1', completedAt: null, outputUrl: null, externalId: 'task-1', mode: 'standard', costEstimate: 0.04, estimatedTotalSeconds: 60, error: null })
    const item = queue.get('gen-1')
    expect(item).not.toBeNull()
    expect(item?.id).toBe('gen-1')
    expect(item?.status).toBe('pending')
  })

  it('returns null for unknown id', () => {
    expect(queue.get('nonexistent')).toBeNull()
  })

  it('updates status to processing', () => {
    queue.add({ id: 'gen-1', type: 'image', status: 'pending', provider: 'kling', prompt: 'test', conceptId: 'c1', completedAt: null, outputUrl: null, externalId: 'task-1', mode: 'standard', costEstimate: 0.04, estimatedTotalSeconds: 60, error: null })
    queue.update('gen-1', { status: 'processing' })
    expect(queue.get('gen-1')?.status).toBe('processing')
  })

  it('sets completedAt when status becomes completed', () => {
    queue.add({ id: 'gen-1', type: 'image', status: 'pending', provider: 'kling', prompt: 'test', conceptId: 'c1', completedAt: null, outputUrl: null, externalId: 'task-1', mode: 'standard', costEstimate: 0.04, estimatedTotalSeconds: 60, error: null })
    queue.update('gen-1', { status: 'completed', outputUrl: 'https://example.com/image.png' })
    const item = queue.get('gen-1')
    expect(item?.status).toBe('completed')
    expect(item?.completedAt).not.toBeNull()
    expect(item?.outputUrl).toBe('https://example.com/image.png')
  })

  it('sets completedAt when status becomes failed', () => {
    queue.add({ id: 'gen-1', type: 'image', status: 'pending', provider: 'kling', prompt: 'test', conceptId: 'c1', completedAt: null, outputUrl: null, externalId: 'task-1', mode: 'standard', costEstimate: 0.04, estimatedTotalSeconds: 60, error: null })
    queue.update('gen-1', { status: 'failed', error: 'Content policy violation' })
    const item = queue.get('gen-1')
    expect(item?.status).toBe('failed')
    expect(item?.completedAt).not.toBeNull()
    expect(item?.error).toBe('Content policy violation')
  })

  it('removes an item', () => {
    queue.add({ id: 'gen-1', type: 'image', status: 'completed', provider: 'kling', prompt: 'test', conceptId: 'c1', completedAt: Date.now(), outputUrl: 'url', externalId: null, mode: 'standard', costEstimate: 0.04, estimatedTotalSeconds: 60, error: null })
    queue.remove('gen-1')
    expect(queue.count()).toBe(0)
  })
})

describe('GenerationQueue — Filtering', () => {
  let queue: GenerationQueue

  beforeEach(() => {
    queue = new GenerationQueue()
    queue.add({ id: 'img-1', type: 'image', status: 'pending', provider: 'kling', prompt: 'img prompt 1', conceptId: 'c1', completedAt: null, outputUrl: null, externalId: 'task-img-1', mode: 'standard', costEstimate: 0.04, estimatedTotalSeconds: 60, error: null })
    queue.add({ id: 'img-2', type: 'image', status: 'completed', provider: 'kling', prompt: 'img prompt 2', conceptId: 'c2', completedAt: Date.now(), outputUrl: 'url', externalId: null, mode: 'standard', costEstimate: 0.04, estimatedTotalSeconds: 60, error: null })
    queue.add({ id: 'vid-1', type: 'video', status: 'pending', provider: 'kling', prompt: 'vid prompt 1', conceptId: 'c1', completedAt: null, outputUrl: null, externalId: 'task-vid-1', mode: 'standard', costEstimate: 0.20, estimatedTotalSeconds: 300, error: null })
    queue.add({ id: 'vid-2', type: 'video', status: 'failed', provider: 'runway', prompt: 'vid prompt 2', conceptId: 'c3', completedAt: Date.now(), outputUrl: null, externalId: null, mode: 'pro', costEstimate: 0.60, estimatedTotalSeconds: 60, error: 'timeout', })
    queue.add({ id: 'scr-1', type: 'script', status: 'completed', provider: 'openai', prompt: 'script prompt', conceptId: null, completedAt: Date.now(), outputUrl: null, externalId: null, mode: 'standard', costEstimate: 0.001, estimatedTotalSeconds: 5, error: null })
  })

  it('filters by status: pending', () => {
    const pending = queue.getByStatus('pending')
    expect(pending).toHaveLength(2)
    expect(pending.every(i => i.status === 'pending')).toBe(true)
  })

  it('filters by status: completed', () => {
    const completed = queue.getByStatus('completed')
    expect(completed).toHaveLength(2)
  })

  it('filters by status: failed', () => {
    const failed = queue.getByStatus('failed')
    expect(failed).toHaveLength(1)
    expect(failed[0].id).toBe('vid-2')
  })

  it('filters by type: image', () => {
    const images = queue.getByType('image')
    expect(images).toHaveLength(2)
  })

  it('filters by type: video', () => {
    const videos = queue.getByType('video')
    expect(videos).toHaveLength(2)
  })

  it('filters by type: script', () => {
    const scripts = queue.getByType('script')
    expect(scripts).toHaveLength(1)
  })

  it('filters by conceptId: c1', () => {
    const c1 = queue.getByConceptId('c1')
    expect(c1).toHaveLength(2)
    expect(c1.every(i => i.conceptId === 'c1')).toBe(true)
  })

  it('getActive returns pending and processing only', () => {
    const active = queue.getActive()
    expect(active).toHaveLength(2)
    expect(active.every(i => i.status === 'pending' || i.status === 'processing')).toBe(true)
  })

  it('hasActive is true when pending items exist', () => {
    expect(queue.hasActive()).toBe(true)
  })

  it('hasActive is false when all items complete', () => {
    queue.update('img-1', { status: 'completed' })
    queue.update('vid-1', { status: 'completed' })
    expect(queue.hasActive()).toBe(false)
  })
})

describe('GenerationQueue — Concurrent 50+ Generations', () => {
  let queue: GenerationQueue

  beforeEach(() => { queue = new GenerationQueue() })

  it('handles 50 simultaneous image submissions', () => {
    for (let i = 0; i < 50; i++) {
      queue.add({ id: `img-${i}`, type: 'image', status: 'pending', provider: 'kling', prompt: `image prompt ${i}`, conceptId: `c${(i % 3) + 1}`, completedAt: null, outputUrl: null, externalId: `kling-task-${i}`, mode: 'standard', costEstimate: 0.04, estimatedTotalSeconds: 60, error: null })
    }
    expect(queue.count()).toBe(50)
    expect(queue.getActive()).toHaveLength(50)
    expect(queue.getByType('image')).toHaveLength(50)
  })

  it('handles 50 simultaneous video submissions', () => {
    for (let i = 0; i < 50; i++) {
      queue.add({ id: `vid-${i}`, type: 'video', status: 'pending', provider: i % 2 === 0 ? 'kling' : 'runway', prompt: `video prompt ${i}`, conceptId: `c${(i % 3) + 1}`, completedAt: null, outputUrl: null, externalId: `task-${i}`, mode: 'standard', costEstimate: 0.20, estimatedTotalSeconds: 300, error: null })
    }
    expect(queue.count()).toBe(50)
  })

  it('handles 50 images + 50 videos simultaneously (100 total)', () => {
    for (let i = 0; i < 50; i++) {
      queue.add({ id: `img-${i}`, type: 'image', status: 'pending', provider: 'kling', prompt: `image ${i}`, conceptId: 'c1', completedAt: null, outputUrl: null, externalId: `img-task-${i}`, mode: 'standard', costEstimate: 0.04, estimatedTotalSeconds: 60, error: null })
      queue.add({ id: `vid-${i}`, type: 'video', status: 'pending', provider: 'kling', prompt: `video ${i}`, conceptId: 'c1', completedAt: null, outputUrl: null, externalId: `vid-task-${i}`, mode: 'standard', costEstimate: 0.20, estimatedTotalSeconds: 300, error: null })
    }
    expect(queue.count()).toBe(100)
    expect(queue.getByType('image')).toHaveLength(50)
    expect(queue.getByType('video')).toHaveLength(50)
    expect(queue.getActive()).toHaveLength(100)
  })

  it('completes items independently — one completion does not affect others', () => {
    for (let i = 0; i < 10; i++) {
      queue.add({ id: `gen-${i}`, type: 'image', status: 'pending', provider: 'kling', prompt: `prompt ${i}`, conceptId: 'c1', completedAt: null, outputUrl: null, externalId: `task-${i}`, mode: 'standard', costEstimate: 0.04, estimatedTotalSeconds: 60, error: null })
    }
    // Complete item 5 only
    queue.update('gen-5', { status: 'completed', outputUrl: 'https://example.com/img.png' })
    expect(queue.getActive()).toHaveLength(9)
    expect(queue.getByStatus('completed')).toHaveLength(1)
    expect(queue.get('gen-5')?.status).toBe('completed')
    expect(queue.get('gen-0')?.status).toBe('pending')
    expect(queue.get('gen-9')?.status).toBe('pending')
  })

  it('clearCompleted removes only finished items, keeps active', () => {
    for (let i = 0; i < 5; i++) {
      queue.add({ id: `gen-${i}`, type: 'image', status: i < 3 ? 'completed' : 'pending', provider: 'kling', prompt: `prompt ${i}`, conceptId: 'c1', completedAt: i < 3 ? Date.now() : null, outputUrl: i < 3 ? 'url' : null, externalId: `task-${i}`, mode: 'standard', costEstimate: 0.04, estimatedTotalSeconds: 60, error: null })
    }
    queue.clearCompleted()
    expect(queue.count()).toBe(2)
    expect(queue.getActive()).toHaveLength(2)
  })

  it('no busy flag blocks concurrent submissions — all independent', () => {
    // This test confirms the architecture: no single boolean blocks multiple submissions
    const submitted: string[] = []
    for (let i = 0; i < 50; i++) {
      // In the real app, each submission fires fetch independently
      // This test validates the queue can accept all 50 without waiting
      const id = `gen-${i}`
      queue.add({ id, type: 'image', status: 'pending', provider: 'kling', prompt: `prompt ${i}`, conceptId: null, completedAt: null, outputUrl: null, externalId: null, mode: 'standard', costEstimate: 0.04, estimatedTotalSeconds: 60, error: null })
      submitted.push(id)
    }
    // All 50 submitted without any blocking
    expect(submitted).toHaveLength(50)
    expect(queue.count()).toBe(50)
    // Each can be independently updated
    submitted.slice(0, 10).forEach(id => queue.update(id, { status: 'completed', outputUrl: 'url' }))
    expect(queue.getByStatus('completed')).toHaveLength(10)
    expect(queue.getByStatus('pending')).toHaveLength(40)
  })
})

describe('GenerationQueue — Cost Tracking', () => {
  let queue: GenerationQueue

  beforeEach(() => { queue = new GenerationQueue() })

  it('tracks total estimated cost across all items', () => {
    queue.add({ id: 'img-1', type: 'image', status: 'pending', provider: 'kling', prompt: 'p', conceptId: 'c1', completedAt: null, outputUrl: null, externalId: null, mode: 'standard', costEstimate: 0.04, estimatedTotalSeconds: 60, error: null })
    queue.add({ id: 'vid-1', type: 'video', status: 'pending', provider: 'kling', prompt: 'p', conceptId: 'c1', completedAt: null, outputUrl: null, externalId: null, mode: 'standard', costEstimate: 0.20, estimatedTotalSeconds: 300, error: null })
    queue.add({ id: 'vid-2', type: 'video', status: 'pending', provider: 'runway', prompt: 'p', conceptId: 'c2', completedAt: null, outputUrl: null, externalId: null, mode: 'pro', costEstimate: 0.60, estimatedTotalSeconds: 60, error: null })
    const totalCost = queue.getAll().reduce((sum, i) => sum + i.costEstimate, 0)
    expect(totalCost).toBeCloseTo(0.84)
  })

  it('50 standard images = $2.00 estimated', () => {
    for (let i = 0; i < 50; i++) {
      queue.add({ id: `img-${i}`, type: 'image', status: 'pending', provider: 'kling', prompt: 'p', conceptId: 'c1', completedAt: null, outputUrl: null, externalId: null, mode: 'standard', costEstimate: 0.04, estimatedTotalSeconds: 60, error: null })
    }
    const total = queue.getAll().reduce((sum, i) => sum + i.costEstimate, 0)
    expect(total).toBeCloseTo(2.00)
  })

  it('50 standard 5s videos = $10.00 estimated', () => {
    for (let i = 0; i < 50; i++) {
      queue.add({ id: `vid-${i}`, type: 'video', status: 'pending', provider: 'kling', prompt: 'p', conceptId: 'c1', completedAt: null, outputUrl: null, externalId: null, mode: 'standard', costEstimate: 0.20, estimatedTotalSeconds: 300, error: null })
    }
    const total = queue.getAll().reduce((sum, i) => sum + i.costEstimate, 0)
    expect(total).toBeCloseTo(10.00)
  })
})
