/**
 * src/lib/assistant-core/metaQuerySignals.ts
 *
 * Detects user queries about STREAMS itself — identity, capabilities,
 * how it works, what it can do, its strengths and limitations.
 *
 * PURPOSE
 * ───────
 * Without this layer, capability questions route through the generic
 * system prompt and produce shallow tool-list answers. This module
 * ensures those queries are:
 *   1. Detected upfront (before model selection)
 *   2. Escalated to the full model (via complexQuerySignals.ts)
 *   3. Given a high-intelligence system prompt (via capabilityPrompt.ts)
 *
 * ROUTING MISS PROCEDURE (same rule as complexQuerySignals.ts)
 * ─────────────────────────────────────────────────────────────
 * When a real capability question routes through the wrong prompt:
 *   Step 1 — Add the missed phrase to META_CAPABILITY_QUERY_PATTERN
 *   Step 2 — Add regression test in __tests__/metaQuerySignals.test.ts
 *   Step 3 — Commit both:
 *             git commit -m "fix(meta): add '<phrase>' — capability routing miss"
 *
 * WHAT NOT TO DO
 * ──────────────
 * ✗ Do not add general "smart question" phrases here.
 *   Only phrases where the user is directly asking about STREAMS itself.
 * ✗ Do not confuse capability queries with complex content queries.
 *   "How does React work?" → complexQuerySignals (content, not meta)
 *   "What can you do?" → here (identity, meta)
 */

export const META_CAPABILITY_QUERY_PATTERN =
  /\b(what\s+can\s+you\s+do|what\s+are\s+your\s+capabilities|your\s+capabilities|capabilities|who\s+are\s+you|how\s+do\s+you\s+work|how\s+you\s+work|what\s+are\s+you|what\s+kind\s+of\s+assistant|what\s+kind\s+of\s+system|what\s+are\s+your\s+strengths|what\s+are\s+your\s+limitations|what\s+are\s+you\s+good\s+at|what\s+are\s+you\s+best\s+at|what\s+can\s+this\s+system\s+do|how\s+intelligent\s+are\s+you|what\s+is\s+your\s+role|what\s+is\s+your\s+purpose|tell\s+me\s+about\s+yourself|describe\s+yourself|introduce\s+yourself)\b/i;

/**
 * Returns true when the user is asking about STREAMS itself — its identity,
 * capabilities, intelligence, or purpose — rather than requesting content.
 */
export function isMetaCapabilityQuery(userText: string): boolean {
  const text = userText.trim();
  if (!text) return false;
  return META_CAPABILITY_QUERY_PATTERN.test(text);
}
