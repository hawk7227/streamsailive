// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const contextSource = readFileSync(resolve(process.cwd(), "src/lib/streams-ai/runtime/context-package.ts"), "utf8");
const controllerSource = readFileSync(resolve(process.cwd(), "src/lib/streams-ai/runtime/authoritative-turn-controller.ts"), "utf8");
const routeSource = readFileSync(resolve(process.cwd(), "src/lib/streams-ai/routes/messages-memory-active.ts"), "utf8");

describe("Streams Stage 1 context guarantee", () => {
  it("preserves the full controlling instruction before trimming lower-priority context", () => {
    expect(contextSource).toContain('name: "current_instruction"');
    expect(contextSource).toContain("preserveWhole: true");
    expect(contextSource).toContain("Priority: current instruction > recent explicit correction");
  });

  it("enforces a final global token budget instead of trusting section percentages", () => {
    expect(contextSource).toContain("allocateSections");
    expect(contextSource).toContain("if (estimatedTokens > maxTokens + 256) throw new Error");
    expect(contextSource).not.toContain("Math.floor(maxTokens * 0.22)");
  });

  it("accepts only fresh successful same-session server runtime evidence", () => {
    expect(contextSource).toContain("same-session-successful-fresh-server-events");
    expect(contextSource).toContain("EVIDENCE_MAX_AGE_MS");
    expect(contextSource).toContain("sessionId !== input.sessionId");
    expect(contextSource).toContain("isSuccessfulEvidence");
    expect(contextSource).not.toContain("input.toolEvidence");
  });

  it("keeps response acceptance and persistence under the authoritative controller", () => {
    expect(controllerSource).toContain("executeAuthoritativeStreamsTurn");
    expect(controllerSource).toContain("STREAMS_RESPONSE_REJECTED");
    expect(controllerSource.indexOf("if (!judgment.accepted")).toBeLessThan(controllerSource.indexOf("input.persistAccepted"));
    expect(routeSource).toContain("executeAuthoritativeStreamsTurn");
  });
});
