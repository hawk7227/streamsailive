/**
 * src/lib/assistant-core/complexQuerySignals.ts
 *
 * Query complexity signal system for the assistant orchestrator.
 *
 * PURPOSE
 * ───────
 * Determines upfront — before any model call — whether a chat query will
 * require a long, structured, or deeply reasoned response. Used to select
 * the initial model: mini for simple turns, full model for complex ones.
 *
 * WHY THIS IS A SEPARATE MODULE
 * ──────────────────────────────
 * This keyword set is a production dependency, not a one-time config.
 * Every routing miss (a complex query wrongly sent to mini) requires:
 *   1. Adding the missed term to COMPLEX_QUERY_KEYWORDS below
 *   2. Adding a test case in __tests__/complexQuerySignals.test.ts
 *   3. Committing both in the same commit with the message:
 *      "fix(signals): add '<term>' — routing miss observed"
 *
 * Keeping the signals in their own file makes the change surface small
 * and the git diff unambiguous. Tests import directly from here, so
 * a single edit fixes both production and test coverage.
 *
 * SIGNALS (each independently sufficient to escalate)
 * ────────────────────────────────────────────────────
 * 1. LENGTH  — query > COMPLEX_QUERY_LENGTH_THRESHOLD chars
 *              Long queries correlate strongly with expected long answers.
 *
 * 2. MULTI-? — ≥ 2 question marks
 *              Multi-part questions require structured responses. Mini
 *              frequently drops sub-questions or provides uneven coverage.
 *
 * 3. KEYWORDS — explicit structured-output or deep-reasoning vocabulary
 *               See COMPLEX_QUERY_KEYWORDS for the current signal set.
 *               Add terms here when a routing miss is observed in production.
 *
 * ROUTING MISS PROCEDURE
 * ───────────────────────
 * When a turn reaches mini but should have gone to the full model:
 *
 *   Step 1 — Identify the signal gap
 *     Read TURN_TIMING log: model='gpt-4o-mini', complex_query=false
 *     Paste the actual user message. Check which signal should have fired.
 *
 *   Step 2 — Add the keyword
 *     Add to COMPLEX_QUERY_KEYWORDS below. Use a word boundary (\b).
 *     Prefer stems over exact words (e.g. tradeoffs? matches both forms).
 *
 *   Step 3 — Add the test case
 *     Add to __tests__/complexQuerySignals.test.ts in the "routing miss
 *     regression" describe block with the exact failing input as the test name.
 *
 *   Step 4 — Commit both together
 *     git commit -m "fix(signals): add '<term>' — routing miss observed"
 *
 * WHAT NOT TO DO
 * ──────────────
 * ✗ Do not add keywords to catch general "smart-sounding" questions.
 *   Only add when a real miss is observed.
 * ✗ Do not broaden patterns to avoid false-negatives at the cost of
 *   false-positives (simple queries wrongly escalated = latency regression).
 * ✗ Do not change the length threshold without checking TURN_TIMING p50/p95.
 */

// ── Signal 3: Keyword vocabulary ─────────────────────────────────────────────
//
// Each term is a word-boundary-anchored pattern.
// Case-insensitive. Order within the alternation is irrelevant.
//
// CURRENT SIGNALS (add new terms to this list):
//   explain in detail   — explicit detail request
//   step by step        — procedural walkthrough
//   compare[d to]       — comparative analysis
//   analyz[ei]e?        — analysis request (US + UK spellings)
//   analyse             — British English
//   in-depth            — explicit depth request
//   comprehensive       — broad coverage expected
//   thorough            — explicit depth request
//   elaborate           — expansion request
//   walk me through     — procedural walkthrough
//   break down          — decomposition request
//   outline             — structured overview
//   pros and cons       — balanced evaluation
//   tradeoffs?          — comparative evaluation (MISS: 2025-04 — PRD Test 2)
//   best practices?     — prescriptive guide expected
//   architecture        — system design discussion
//   implementation      — how-to detail expected

export const COMPLEX_QUERY_KEYWORDS =
  /\b(explain\s+(?:in\s+)?detail|step[- ]by[- ]step|compare(?:d\s+to)?|analyz[ei]e?|analyse|in[- ]depth|comprehensive|thorough|elaborate|walk\s+me\s+through|break\s+(?:it\s+)?down|outline|pros?\s+and\s+cons?|tradeoffs?|best\s+practices?|architecture|implementation)\b/i;

// ── Signal 1: Length threshold ────────────────────────────────────────────────
// Queries above this character count are presumed to expect detailed responses.
// Tune via TURN_TIMING logs: if complex_query=false and responses feel shallow,
// reduce this threshold.
export const COMPLEX_QUERY_LENGTH_THRESHOLD = 300;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true when the query signals complex reasoning is expected.
 * Called upfront, before any model call. Pure function. <1ms.
 */
export function isChatQueryComplex(userText: string): boolean {
  const text = userText.trim();

  // Signal 1: long query
  if (text.length > COMPLEX_QUERY_LENGTH_THRESHOLD) return true;

  // Signal 2: multi-part question
  if ((text.match(/\?/g) ?? []).length >= 2) return true;

  // Signal 3: structured-output or deep-reasoning vocabulary
  if (COMPLEX_QUERY_KEYWORDS.test(text)) return true;

  return false;
}
