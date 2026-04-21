/**
 * src/lib/assistant-core/__tests__/metaQuerySignals.test.ts
 *
 * Tests for meta/capability query detection.
 *
 * ADDING A TEST FOR A ROUTING MISS
 * ─────────────────────────────────
 * When a real capability question is not detected:
 *   1. Add the phrase to META_CAPABILITY_QUERY_PATTERN in metaQuerySignals.ts
 *   2. Add a test here in the "routing miss regressions" describe block
 *      using the EXACT failing user message as the test name
 *   3. Commit both:
 *      git commit -m "fix(meta): add '<phrase>' — capability routing miss"
 */

import { describe, it, expect } from "vitest";
import { isMetaCapabilityQuery, META_CAPABILITY_QUERY_PATTERN } from "../metaQuerySignals";
import { isChatQueryComplex } from "../complexQuerySignals";

// ── Direct detection ──────────────────────────────────────────────────────────

describe("isMetaCapabilityQuery — positive matches", () => {
  const metaInputs: string[] = [
    "What can you do?",
    "what are your capabilities",
    "Who are you?",
    "How do you work?",
    "What are you?",
    "what kind of assistant are you",
    "what kind of system is this",
    "What are your strengths?",
    "What are your limitations?",
    "what are you good at",
    "what are you best at",
    "what can this system do",
    "How intelligent are you?",
    "What is your role?",
    "what is your purpose",
    "Tell me about yourself",
    "describe yourself",
    "introduce yourself",
    "your capabilities",
  ];

  it.each(metaInputs)("'%s' → isMetaCapabilityQuery: true", (input) => {
    expect(isMetaCapabilityQuery(input)).toBe(true);
  });
});

describe("isMetaCapabilityQuery — negative matches (must NOT trigger)", () => {
  const nonMetaInputs: string[] = [
    "What can you generate?",          // "generate" not in pattern
    "How does React work?",            // about React, not STREAMS itself
    "Generate an image",
    "What is 2+2?",
    "Build me a landing page",
    "hello",
    "What is the capital of France?",
    "How do embeddings work?",         // content question, not identity
    "Write me a poem",
    "",
    "   ",
  ];

  it.each(nonMetaInputs)("'%s' → isMetaCapabilityQuery: false", (input) => {
    expect(isMetaCapabilityQuery(input)).toBe(false);
  });
});

// ── Escalation: meta queries must escalate to full model ─────────────────────

describe("isChatQueryComplex — meta queries escalate to full model", () => {
  it("'What can you do?' → complex (full model)", () => {
    expect(isChatQueryComplex("What can you do?")).toBe(true);
  });

  it("'what are your capabilities' → complex (full model)", () => {
    expect(isChatQueryComplex("what are your capabilities")).toBe(true);
  });

  it("'Who are you?' → complex (full model)", () => {
    expect(isChatQueryComplex("Who are you?")).toBe(true);
  });

  it("meta escalation is Signal 0 — fires before length/keyword check", () => {
    // Short meta query — would NOT trigger length or keyword signal alone
    expect(isChatQueryComplex("What are you?")).toBe(true);
  });
});

// ── Case insensitivity ────────────────────────────────────────────────────────

describe("isMetaCapabilityQuery — case insensitivity", () => {
  it("uppercase → detected", () => {
    expect(isMetaCapabilityQuery("WHAT CAN YOU DO?")).toBe(true);
  });

  it("mixed case → detected", () => {
    expect(isMetaCapabilityQuery("What Are Your Capabilities")).toBe(true);
  });
});

// ── Invariants ────────────────────────────────────────────────────────────────

describe("Invariants", () => {
  it("META_CAPABILITY_QUERY_PATTERN is case-insensitive", () => {
    expect(META_CAPABILITY_QUERY_PATTERN.flags).toContain("i");
  });

  it("empty string → false", () => {
    expect(isMetaCapabilityQuery("")).toBe(false);
  });

  it("whitespace only → false", () => {
    expect(isMetaCapabilityQuery("   ")).toBe(false);
  });

  it("isMetaCapabilityQuery is pure (same input → same output)", () => {
    const input = "what can you do";
    expect(isMetaCapabilityQuery(input)).toBe(isMetaCapabilityQuery(input));
  });
});

// ── Routing miss regressions ──────────────────────────────────────────────────
// Each test documents a real miss observed in production.
// Test name = exact user message that failed.
// Pattern fix: what\s+are\s+your\s+cap\w+ covers ALL typo variants.

describe("Routing miss regressions", () => {
  // 2026-04-21: "WHAT ARE YOUR CAPBILTIES" — misspelling of capabilities
  it("'WHAT ARE YOUR CAPBILTIES' → detected", () => {
    expect(isMetaCapabilityQuery("WHAT ARE YOUR CAPBILTIES")).toBe(true);
  });

  // Common variant: CAPABILTIES (transposed letters)
  it("'WHAT ARE YOUR CAPABILTIES' → detected", () => {
    expect(isMetaCapabilityQuery("WHAT ARE YOUR CAPABILTIES")).toBe(true);
  });

  // Common variant: CAPABILITES (extra e)
  it("'what are your capabilites' → detected", () => {
    expect(isMetaCapabilityQuery("what are your capabilites")).toBe(true);
  });

  // Common variant: CAPABALITIES (extra a)
  it("'what are your capabalities' → detected", () => {
    expect(isMetaCapabilityQuery("what are your capabalities")).toBe(true);
  });

  // Confirm no false positive: content question about React
  it("'How does React work?' → NOT detected (content, not identity)", () => {
    expect(isMetaCapabilityQuery("How does React work?")).toBe(false);
  });
});
