// ── Preview State Store ────────────────────────────────────────────────────────
// Shared state between chat iframe and preview surface.
// Chat posts messages to window (Studio), Studio updates this store,
// PreviewSurface reads it.

export type PreviewMode = "route" | "html" | "component" | "doc" | "diff" | "idle"

export interface PreviewState {
  mode: PreviewMode
  route?: string      // for mode = "route"
  html?: string       // for mode = "html"
  code?: string       // for mode = "component"
  title?: string
  updatedAt?: number
}

export const DEFAULT_PREVIEW_STATE: PreviewState = {
  mode: "idle",
}

// ── postMessage event types ───────────────────────────────────────────────────
// Chat iframe → Studio (parent window)

export type PreviewBridgeEvent =
  | { type: "preview:html";      html: string; title?: string }
  | { type: "preview:route";     route: string; title?: string }
  | { type: "preview:component"; code: string; title?: string }
  | { type: "preview:doc";       html: string; title?: string }

export function isPreviewBridgeEvent(data: unknown): data is PreviewBridgeEvent {
  if (!data || typeof data !== "object") return false
  const d = data as Record<string, unknown>
  return typeof d.type === "string" && d.type.startsWith("preview:")
}

// ── HTML extractor ────────────────────────────────────────────────────────────
// Pull first HTML or TSX/JSX code block out of a markdown string

export function extractPreviewContent(markdown: string): PreviewBridgeEvent | null {
  // Match ```html ... ``` blocks
  const htmlMatch = markdown.match(/```html\s*\n([\s\S]*?)```/)
  if (htmlMatch) {
    return { type: "preview:html", html: htmlMatch[1].trim(), title: "Chat HTML Preview" }
  }

  // Match raw <!DOCTYPE html> blocks (no language tag)
  const doctypeMatch = markdown.match(/(<!DOCTYPE html>[\s\S]*?<\/html>)/i)
  if (doctypeMatch) {
    return { type: "preview:html", html: doctypeMatch[1].trim(), title: "Chat HTML Preview" }
  }

  // Match ```tsx or ```jsx blocks
  const tsxMatch = markdown.match(/```(?:tsx|jsx)\s*\n([\s\S]*?)```/)
  if (tsxMatch) {
    return { type: "preview:component", code: tsxMatch[1].trim(), title: "Chat Component Preview" }
  }

  return null
}
