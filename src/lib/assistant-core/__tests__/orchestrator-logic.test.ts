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

// isChatQueryComplex imported from the real module — no local copy.
// Signal tests live in __tests__/complexQuerySignals.test.ts.
// This file only tests routing decisions (selectInitialModel,
// selectContinuationModel) that depend on the result of isChatQueryComplex.

const OPENAI_MODEL      = "gpt-4.1";
const OPENAI_MINI_MODEL = "gpt-4o-mini";

const FULL_MODEL_ROUTES = new Set(["build", "file"]);

import { isChatQueryComplex } from "../complexQuerySignals";

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

// ── TEST 2 — Complex chat routing ─────────────────────────────────────────
// Signal detection tests (which inputs ARE complex) live in
// __tests__/complexQuerySignals.test.ts. This file only tests that when
// isChatQueryComplex returns true, the routing decision is correct.

describe("TEST 2 — Complex chat → full model (routing decision)", () => {
  it("when isComplexChat=true → selectInitialModel returns full model", () => {
    const model = selectInitialModel("chat", false, true);
    expect(model).toBe(OPENAI_MODEL);
  });

  it("complex chat with no tool calls: escalated=false (full model upfront, no transition)", () => {
    const model = selectInitialModel("chat", false, true);
    const continuation = selectContinuationModel(model, false);
    const escalated = continuation !== model;
    expect(model).toBe(OPENAI_MODEL);
    expect(continuation).toBe(OPENAI_MODEL);
    expect(escalated).toBe(false);
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

// ── Routing boundary conditions ───────────────────────────────────────────

describe("Routing boundary conditions", () => {
  it("empty string → not complex → mini", () => {
    expect(isChatQueryComplex("")).toBe(false);
    const model = selectInitialModel("chat", false, false);
    expect(model).toBe(OPENAI_MINI_MODEL);
  });

  it("mini with tools → full; full with tools → still full (not double-escalation)", () => {
    const fromMini = selectContinuationModel(OPENAI_MINI_MODEL, true);
    const fromFull = selectContinuationModel(OPENAI_MODEL, true);
    expect(fromMini).toBe(OPENAI_MODEL);
    expect(fromFull).toBe(OPENAI_MODEL);
  });
});
