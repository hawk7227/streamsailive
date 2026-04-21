/**
 * src/lib/assistant-core/__tests__/complexQuerySignals.test.ts
 *
 * Tests for the query complexity signal system.
 *
 * ADDING A TEST FOR A ROUTING MISS
 * ─────────────────────────────────
 * When a real routing miss is observed:
 *   1. Add the term to COMPLEX_QUERY_KEYWORDS in complexQuerySignals.ts
 *   2. Add a test here in the "routing miss regressions" describe block
 *      using the EXACT failing user message as the test name
 *   3. Commit both files together:
 *      git commit -m "fix(signals): add '<term>' — routing miss observed"
 *
 * Tests import directly from complexQuerySignals.ts.
 * One edit to the module covers both production and test.
 */

import { describe, it, expect } from "vitest";
import {
  isChatQueryComplex,
  COMPLEX_QUERY_KEYWORDS,
  COMPLEX_QUERY_LENGTH_THRESHOLD,
} from "../complexQuerySignals";

// ── Signal 1: Length threshold ────────────────────────────────────────────────

describe("Signal 1 — length threshold", () => {
  it(`exactly ${COMPLEX_QUERY_LENGTH_THRESHOLD} chars → NOT complex`, () => {
    expect(isChatQueryComplex("a".repeat(COMPLEX_QUERY_LENGTH_THRESHOLD))).toBe(false);
  });

  it(`${COMPLEX_QUERY_LENGTH_THRESHOLD + 1} chars → complex`, () => {
    expect(isChatQueryComplex("a".repeat(COMPLEX_QUERY_LENGTH_THRESHOLD + 1))).toBe(true);
  });

  it("very long question → complex regardless of content", () => {
    expect(isChatQueryComplex("what is the weather like today in ".repeat(12))).toBe(true);
  });
});

// ── Signal 2: Multi-part questions ───────────────────────────────────────────

describe("Signal 2 — multi-part questions", () => {
  it("1 question mark → NOT complex", () => {
    expect(isChatQueryComplex("What is 2+2?")).toBe(false);
  });

  it("2 question marks → complex", () => {
    expect(isChatQueryComplex("What is 2+2? And what is 3+3?")).toBe(true);
  });

  it("3 question marks → complex", () => {
    expect(isChatQueryComplex("What? Why? How?")).toBe(true);
  });
});

// ── Signal 3: Keyword coverage ────────────────────────────────────────────────

describe("Signal 3 — keyword coverage", () => {
  const keywordCases: [string, string][] = [
    ["explain in detail",    "Explain in detail how pgvector works"],
    ["step by step",         "Walk me step by step through the setup"],
    ["step-by-step",         "Give me a step-by-step breakdown"],
    ["compare",              "Compare REST and GraphQL APIs"],
    ["compared to",          "How does Redis compare compared to Memcached"],
    ["analyze",              "Analyze the performance bottlenecks"],
    ["analyse",              "Analyse this code for issues"],
    ["in-depth",             "Give me an in-depth look at embeddings"],
    ["in depth",             "An in depth explanation of transformers"],
    ["comprehensive",        "Give me a comprehensive overview of RAG"],
    ["thorough",             "I need a thorough explanation of RLHF"],
    ["elaborate",            "Can you elaborate on this approach"],
    ["walk me through",      "Walk me through the authentication flow"],
    ["break it down",        "Break it down for me step by step"],
    ["break down",           "Break down the differences between these"],
    ["outline",              "Outline the key concepts in distributed systems"],
    ["pros and cons",        "What are the pros and cons of serverless"],
    ["pro and con",          "Give me the pro and con of each approach"],
    ["tradeoffs",            "Explain the tradeoffs between vector search and full-text search in large-scale systems."],
    ["tradeoff",             "What is the tradeoff here?"],
    ["best practices",       "What are the best practices for API design"],
    ["best practice",        "What is the best practice for error handling"],
    ["architecture",         "Describe the architecture of a real-time chat system"],
    ["implementation",       "Walk through the implementation of OAuth2"],
  ];

  it.each(keywordCases)("'%s' keyword → complex", (_keyword, input) => {
    expect(isChatQueryComplex(input)).toBe(true);
  });

  it("keyword match is case-insensitive", () => {
    expect(isChatQueryComplex("EXPLAIN IN DETAIL how this works")).toBe(true);
    expect(isChatQueryComplex("TRADEOFFS between X and Y")).toBe(true);
    expect(isChatQueryComplex("ARCHITECTURE of the system")).toBe(true);
  });
});

// ── Simple queries — should NOT escalate ─────────────────────────────────────

describe("Simple queries — must NOT trigger escalation (false-positive guard)", () => {
  const simpleInputs = [
    "What is 2+2?",
    "Hello",
    "Thanks",
    "ok",
    "What time is it?",
    "Who made you?",
    "tell me a joke",
    "what is the capital of France?",
    "hi",
    "yes",
    "no",
    "what does HTTP stand for?",
  ];

  it.each(simpleInputs)("'%s' → NOT complex", (input) => {
    expect(isChatQueryComplex(input)).toBe(false);
  });
});

// ── Routing miss regressions ──────────────────────────────────────────────────
// Each test here documents a real miss observed in production.
// Test name = exact user message that failed.
// Format: it("EXACT FAILING INPUT", () => { ... })

describe("Routing miss regressions", () => {
  it(
    "Explain the tradeoffs between vector search and full-text search in large-scale systems.",
    () => {
      // MISS DATE: 2025-04 (discovered during PRD test validation)
      // SIGNAL: 'tradeoffs' — added to COMPLEX_QUERY_KEYWORDS
      expect(
        isChatQueryComplex(
          "Explain the tradeoffs between vector search and full-text search in large-scale systems.",
        ),
      ).toBe(true);
    },
  );
});

// ── Invariants ────────────────────────────────────────────────────────────────

describe("Invariants", () => {
  it("isChatQueryComplex is a pure function (same input → same output)", () => {
    const input = "explain in detail";
    const r1 = isChatQueryComplex(input);
    const r2 = isChatQueryComplex(input);
    expect(r1).toBe(r2);
  });

  it("COMPLEX_QUERY_KEYWORDS is a case-insensitive regex", () => {
    expect(COMPLEX_QUERY_KEYWORDS.flags).toContain("i");
  });

  it("COMPLEX_QUERY_LENGTH_THRESHOLD is a positive integer", () => {
    expect(COMPLEX_QUERY_LENGTH_THRESHOLD).toBeGreaterThan(0);
    expect(Number.isInteger(COMPLEX_QUERY_LENGTH_THRESHOLD)).toBe(true);
  });

  it("empty string → not complex", () => {
    expect(isChatQueryComplex("")).toBe(false);
  });

  it("whitespace only → not complex", () => {
    expect(isChatQueryComplex("   ")).toBe(false);
  });
});
