import { vi } from 'vitest'
import { render, RenderOptions } from '@testing-library/react'
import React from 'react'
import QueryProvider from '@/providers/QueryProvider'

// ── Render wrapper with all providers ────────────────────────────────────
export function renderWithProviders(ui: React.ReactElement, options?: RenderOptions) {
  return render(
    React.createElement(QueryProvider, null, ui),
    options
  )
}

// ── Fetch mock builder ────────────────────────────────────────────────────
// Sets up global.fetch to return specific responses for specific URLs
type FetchMockEntry = { url: string | RegExp; response: any; status?: number; once?: boolean }

export function mockFetch(entries: FetchMockEntry[]) {
  const calls: { url: string; options: any }[] = []

  ;(global.fetch as any) = vi.fn(async (url: string, options: any) => {
    calls.push({ url, options })
    const entry = entries.find(e =>
      typeof e.url === 'string' ? url.includes(e.url) : e.url.test(url)
    )
    if (!entry) {
      console.warn(`[mockFetch] Unmatched URL: ${url}`)
      return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) }
    }
    return {
      ok: (entry.status ?? 200) < 400,
      status: entry.status ?? 200,
      json: async () => entry.response,
      text: async () => JSON.stringify(entry.response),
      arrayBuffer: async () => new ArrayBuffer(0),
      headers: { get: () => 'application/json' }
    }
  })

  return { calls }
}

// ── File mock builder ─────────────────────────────────────────────────────
export function createMockFile(name: string, type: string, sizeKB = 100): File {
  const content = new Uint8Array(sizeKB * 1024).fill(0)
  return new File([content], name, { type })
}

export function createMockImageFile(name = 'test.jpg'): File {
  return createMockFile(name, 'image/jpeg', 200)
}

export function createMockVideoFile(name = 'test.mp4'): File {
  return createMockFile(name, 'video/mp4', 5000)
}

export function createMockPDFFile(name = 'test.pdf'): File {
  return createMockFile(name, 'application/pdf', 500)
}

export function createMockAudioFile(name = 'test.mp3'): File {
  return createMockFile(name, 'audio/mpeg', 1000)
}

// ── Wait helpers ──────────────────────────────────────────────────────────
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function waitForElement(fn: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitForElement timed out')
    await wait(50)
  }
}

// ── State assertion helpers ───────────────────────────────────────────────
export function expectFetchCalledWith(calls: { url: string; options: any }[], urlPattern: string | RegExp, bodyMatcher?: Record<string, any>) {
  const match = calls.find(c =>
    typeof urlPattern === 'string' ? c.url.includes(urlPattern) : urlPattern.test(c.url)
  )
  if (!match) throw new Error(`Expected fetch call to ${urlPattern} but none found. Calls: ${calls.map(c => c.url).join(', ')}`)
  if (bodyMatcher) {
    const body = typeof match.options?.body === 'string' ? JSON.parse(match.options.body) : match.options?.body
    for (const [key, value] of Object.entries(bodyMatcher)) {
      if (body?.[key] !== value) throw new Error(`Expected body.${key} to be ${value}, got ${body?.[key]}`)
    }
  }
  return match
}

// ── Canvas mock ───────────────────────────────────────────────────────────
export function mockCanvas() {
  const ctx = {
    clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
    translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(),
    drawImage: vi.fn(), filter: '',
  }
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(ctx)
  HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,testdata')
  return ctx
}

// ── Local storage mock ────────────────────────────────────────────────────
export function mockLocalStorage() {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
    store
  }
}
