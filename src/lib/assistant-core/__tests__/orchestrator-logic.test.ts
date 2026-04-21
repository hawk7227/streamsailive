/**
 * src/lib/assistant-core/__tests__/orchestrator-logic.test.ts
 *
 * Unit tests for all deterministic orchestrator logic.
 * No OpenAI calls. No network. No Supabase.
 *
 * Covers:
 *   TEST 1 — Simple chat routes to mini (fast path)
 *   TEST 2 — Complex chat routes to full (escalation path)
 *   TEST 3 — File-backed routes to full (upfront)
 *   TEST 6 — Image/video route mini → escalates on tool call
 *   TEST 10 — Non-tool paths never trigger continuation escalation
 */

import { describe, it, expect } from "vitest";

// ── Re-implement the tested functions here (pure, no env imports) ──────────
// We test the logic in isolation to avoid env side effects.
// Any change to the real functions must be reflected here.

const OPENAI_MODEL      = "gpt-4.1";
const OPENAI_MINI_MODEL = "gpt-4o-mini";

const FULL_MODEL_ROUTES = new Set(["build", "file"]);

const COMPLEX_QUERY_KEYWORDS =
  /\b(explain\s+(?:in\s+)?detail|step[- ]by[- ]step|compare(?:d\s+to)?|analyz[ei]e?|analyse|in[- ]depth|comprehensive|thorough|elaborate|walk\s+me\s+through|break\s+(?:it\s+)?down|outline|pros?\s+and\s+cons?|tradeoffs?|best\s+practices?|architecture|implementation)\b/i;

const COMPLEX_QUERY_LENGTH_THRESHOLD = 300;

function isChatQueryComplex(userText: string): boolean {
  const text = userText.trim();
  if (text.length > COMPLEX_QUERY_LENGTH_THRESHOLD) return true;
  if ((text.match(/\?/g) ?? []).length >= 2) return true;
  if (COMPLEX_QUERY_KEYWORDS.test(text)) return true;
  return false;
}

function selectInitialModel(
  route: string,
  hasFileContext: boolean,
  isComplexChat: boolean,
): string {
  if (hasFileContext) return OPENAI_MODEL;
  if (FULL_MODEL_ROUTES.has(route)) return OPENAI_MODEL;
  if (isComplexChat) return OPENAI_MODEL;
  return OPENAI_MINI_MODEL;
}

function selectContinuationModel(
  initialModel: string,
  firstCallHadTools: boolean,
): string {
  if (initialModel === OPENAI_MINI_MODEL && firstCallHadTools) return OPENAI_MODEL;
  return initialModel;
}

// ── TEST 1 — Simple chat fast path ─────────────────────────────────────────

describe("TEST 1 — Simple chat → mini (fast path)", () => {
  const simpleInputs = [
    "What is 2+2?",
    "Hello",
    "Thanks",
    "What time is it?",
    "Who made you?",
    "ok",
    "tell me a joke",
    "what is the capital of France?",
  ];

  it.each(simpleInputs)("'%s' → gpt-4o-mini, escalated: false", (input) => {
    const isComplex = isChatQueryComplex(input);
    const model = selectInitialModel("chat", false, isComplex);
    const continuation = selectContinuationModel(model, false);

    expect(model).toBe(OPENAI_MINI_MODEL);
    expect(continuation).toBe(OPENAI_MINI_MODEL); // no tool call → no escalation
    expect(isComplex).toBe(false);
  });
});

// ── TEST 2 — Complex chat escalation ──────────────────────────────────────

describe("TEST 2 — Complex chat → full model (escalation path)", () => {
  it("long query (>300 chars) → full model", () => {
    const longQuery = "a".repeat(301);
    const isComplex = isChatQueryComplex(longQuery);
    const model = selectInitialModel("chat", false, isComplex);
    expect(isComplex).toBe(true);
    expect(model).toBe(OPENAI_MODEL);
  });

  it("multi-part question (≥2 question marks) → full model", () => {
    const input = "What is vector search? How does it compare to full-text search?";
    const isComplex = isChatQueryComplex(input);
    const model = selectInitialModel("chat", false, isComplex);
    expect(isComplex).toBe(true);
    expect(model).toBe(OPENAI_MODEL);
  });

  it("'explain in detail' → full model", () => {
    const input = "Explain in detail how pgvector works";
    expect(isChatQueryComplex(input)).toBe(true);
    expect(selectInitialModel("chat", false, true)).toBe(OPENAI_MODEL);
  });

  it("'step by step' → full model", () => {
    const input = "Walk me through step by step how to set up auth";
    expect(isChatQueryComplex(input)).toBe(true);
  });

  it("'compare' keyword → full model", () => {
    const input = "Compare vector search and full-text search in large-scale systems";
    expect(isChatQueryComplex(input)).toBe(true);
    expect(selectInitialModel("chat", false, true)).toBe(OPENAI_MODEL);
  });

  it("'analyze' / 'analyse' → full model", () => {
    expect(isChatQueryComplex("Analyze the performance bottlenecks")).toBe(true);
    expect(isChatQueryComplex("Analyse this code for issues")).toBe(true);
  });

  it("'comprehensive' → full model", () => {
    expect(isChatQueryComplex("Give me a comprehensive overview of RAG systems")).toBe(true);
  });

  it("'walk me through' → full model", () => {
    expect(isChatQueryComplex("Walk me through the authentication flow")).toBe(true);
  });

  it("'break it down' → full model", () => {
    expect(isChatQueryComplex("Break it down for me")).toBe(true);
  });

  it("'pros and cons' → full model", () => {
    expect(isChatQueryComplex("What are the pros and cons of serverless?")).toBe(true);
    expect(isChatQueryComplex("pros and cons of Next.js")).toBe(true);
  });

  it("'in-depth' → full model", () => {
    expect(isChatQueryComplex("Give me an in-depth explanation of embeddings")).toBe(true);
  });

  it("exact PRD test input → full model (PRD §2)", () => {
    const input = "Explain the tradeoffs between vector search and full-text search in large-scale systems.";
    const isComplex = isChatQueryComplex(input);
    const model = selectInitialModel("chat", false, isComplex);
    expect(isComplex).toBe(true);
    expect(model).toBe(OPENAI_MODEL);
  });

  it("complex chat: escalated = false (no tools ran) — answer comes from full model", () => {
    // Complex query uses full model upfront — no escalation needed
    // continuation = full (same as initial — no change)
    const model = selectInitialModel("chat", false, true);
    const continuation = selectContinuationModel(model, false);
    expect(model).toBe(OPENAI_MODEL);
    expect(continuation).toBe(OPENAI_MODEL);
    // The TURN_TIMING log will show escalated: false because
    // continuation === initial (no change, escalation tracks mini→full transition)
  });
});

// ── TEST 3 — File-backed → full model upfront ─────────────────────────────

describe("TEST 3 — File-backed → full model (upfront, not escalation)", () => {
  it("chat + has file context → full model regardless of query complexity", () => {
    const model = selectInitialModel("chat", true, false);
    expect(model).toBe(OPENAI_MODEL);
  });

  it("chat + has file context + complex query → still full model (correct)", () => {
    const model = selectInitialModel("chat", true, true);
    expect(model).toBe(OPENAI_MODEL);
  });

  it("file route (workspace ops) → full model regardless", () => {
    expect(selectInitialModel("file", false, false)).toBe(OPENAI_MODEL);
    expect(selectInitialModel("file", true, false)).toBe(OPENAI_MODEL);
  });

  it("build route → full model regardless", () => {
    expect(selectInitialModel("build", false, false)).toBe(OPENAI_MODEL);
    expect(selectInitialModel("build", true, true)).toBe(OPENAI_MODEL);
  });

  it("file-backed: escalated = false (full model was selected upfront)", () => {
    const model = selectInitialModel("chat", true, false);
    const continuation = selectContinuationModel(model, false);
    expect(model).toBe(OPENAI_MODEL);
    expect(continuation).toBe(OPENAI_MODEL);
    // escalated = continuation !== initial = false ✅
  });
});

// ── TEST 6 — Image/video → mini → tool escalation ─────────────────────────

describe("TEST 6 — Image/video → mini, escalates when tool called", () => {
  it("image route → mini initially", () => {
    const model = selectInitialModel("image", false, false);
    expect(model).toBe(OPENAI_MINI_MODEL);
  });

  it("video route → mini initially", () => {
    const model = selectInitialModel("video", false, false);
    expect(model).toBe(OPENAI_MINI_MODEL);
  });

  it("image route → mini called tool → escalates to full for synthesis", () => {
    const initial = selectInitialModel("image", false, false);
    const continuation = selectContinuationModel(initial, true); // tool was called
    expect(initial).toBe(OPENAI_MINI_MODEL);
    expect(continuation).toBe(OPENAI_MODEL);
  });

  it("video route → mini called tool → escalates", () => {
    const initial = selectInitialModel("video", false, false);
    const continuation = selectContinuationModel(initial, true);
    expect(initial).toBe(OPENAI_MINI_MODEL);
    expect(continuation).toBe(OPENAI_MODEL);
  });

  it("escalated flag = true when mini → full transition", () => {
    const initial = selectInitialModel("image", false, false);
    const continuation = selectContinuationModel(initial, true);
    const escalated = continuation !== initial;
    expect(escalated).toBe(true);
  });
});

// ── TEST 10 — No double call for non-tool simple chat ─────────────────────

describe("TEST 10 — No double call for non-tool paths", () => {
  it("simple chat, no tools → mini stays mini, escalated = false", () => {
    const initial = selectInitialModel("chat", false, false);
    const continuation = selectContinuationModel(initial, false); // no tools
    const escalated = continuation !== initial;
    expect(initial).toBe(OPENAI_MINI_MODEL);
    expect(continuation).toBe(OPENAI_MINI_MODEL);
    expect(escalated).toBe(false);
  });

  it("full model chat (complex), no tools → stays full, escalated = false", () => {
    const initial = selectInitialModel("chat", false, true);
    const continuation = selectContinuationModel(initial, false);
    const escalated = continuation !== initial;
    expect(initial).toBe(OPENAI_MODEL);
    expect(continuation).toBe(OPENAI_MODEL);
    expect(escalated).toBe(false);
  });

  it("only mini→full tool transition is 'escalated'", () => {
    // Full model calling a tool is NOT escalation — it was already full
    const initial = selectInitialModel("build", false, false); // full
    const continuation = selectContinuationModel(initial, true); // had tools
    const escalated = continuation !== initial;
    expect(escalated).toBe(false); // same model, no escalation
  });
});

// ── Boundary / edge cases ─────────────────────────────────────────────────

describe("Edge cases and boundary conditions", () => {
  it("exactly 300 chars → NOT complex (threshold is >300)", () => {
    const input = "a".repeat(300);
    expect(isChatQueryComplex(input)).toBe(false);
  });

  it("exactly 301 chars → complex", () => {
    const input = "a".repeat(301);
    expect(isChatQueryComplex(input)).toBe(true);
  });

  it("exactly 1 question mark → NOT complex", () => {
    expect(isChatQueryComplex("What is 2+2?")).toBe(false);
  });

  it("exactly 2 question marks → complex", () => {
    expect(isChatQueryComplex("What is 2+2? And what is 3+3?")).toBe(true);
  });

  it("keyword match is case-insensitive", () => {
    expect(isChatQueryComplex("EXPLAIN IN DETAIL how this works")).toBe(true);
    expect(isChatQueryComplex("Step-By-Step guide")).toBe(true);
  });

  it("'analyze' (US) and 'analyse' (UK) both match", () => {
    expect(isChatQueryComplex("analyze the logs")).toBe(true);
    expect(isChatQueryComplex("analyse the logs")).toBe(true);
  });

  it("empty string → not complex → mini", () => {
    expect(isChatQueryComplex("")).toBe(false);
    const model = selectInitialModel("chat", false, false);
    expect(model).toBe(OPENAI_MINI_MODEL);
  });

  it("mini with tools → full; full with tools → still full (not double-escalation)", () => {
    const fromMini = selectContinuationModel(OPENAI_MINI_MODEL, true);
    const fromFull = selectContinuationModel(OPENAI_MODEL, true);
    expect(fromMini).toBe(OPENAI_MODEL);
    expect(fromFull).toBe(OPENAI_MODEL); // no change — already full
  });
});
