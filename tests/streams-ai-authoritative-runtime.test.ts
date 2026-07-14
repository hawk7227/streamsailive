// @vitest-environment node

import { describe, expect, it } from "vitest";
import { classifyStreamsIntent } from "../src/lib/streams-ai/runtime/intent-engine";
import { routeStreamsModels } from "../src/lib/streams-ai/runtime/model-router";
import { judgeStreamsResponse } from "../src/lib/streams-ai/quality/semantic-judge";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Streams authoritative runtime", () => {
  it("classifies exhaustive image analysis with exact structure", () => {
    const intent = classifyStreamsIntent({
      userMessage: "Review the screenshot in a full non-compressed answer using exactly these headings and a table.",
      hasImages: true,
    });
    expect(intent.primaryIntent).toBe("image_analysis");
    expect(intent.requestedDepth).toBe("exhaustive");
    expect(intent.requestedFormat.exact).toBe(true);
    expect(intent.requestedFormat.table).toBe(true);
    expect(intent.needsImages).toBe(true);
  });

  it("routes complex research to a capable tool model", () => {
    const intent = classifyStreamsIntent({ userMessage: "Research the latest current API changes and compare the official sources in detail." });
    const route = routeStreamsModels({ intent, hasImages: false, contextChars: 50000 });
    expect(route.primary.supportsTools).toBe(true);
    expect(route.primary.researchTier).toBeGreaterThanOrEqual(3);
    expect(route.judge.role).toBe("judge");
    expect(route.repair.role).toBe("repair");
  });

  it("rejects unsupported completion claims", () => {
    const intent = classifyStreamsIntent({ userMessage: "Deploy the app to production." });
    const result = judgeStreamsResponse({
      userInstruction: "Deploy the app to production.",
      responseText: "Done. I deployed the app and it is now live.",
      intent,
      toolEvidenceCount: 0,
    });
    expect(result.accepted).toBe(false);
    expect(result.criticalDefect).toBe(true);
    expect(result.defects.some((defect) => defect.code === "UNSUPPORTED_ACTION_CLAIM")).toBe(true);
  });

  it("requires exact requested output structure", () => {
    const intent = classifyStreamsIntent({ userMessage: "Return only valid JSON with the answer." });
    const result = judgeStreamsResponse({
      userInstruction: "Return only valid JSON with the answer.",
      responseText: "The answer is yes.",
      intent,
    });
    expect(result.accepted).toBe(false);
    expect(result.defects.some((defect) => defect.code === "INVALID_JSON")).toBe(true);
  });

  it("routes active chat through the authoritative controller", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/streams-ai/routes/messages-memory-active.ts"), "utf8");
    expect(source).toContain("prepareAuthoritativeStreamsTurn");
    expect(source).toContain("buildAuthoritativeTurnPrompt");
    expect(source).toContain("judgeStreamsResponse");
    expect(source).toContain("modelRoute.primary.id");
    expect(source).toContain("contextSnapshot");
    expect(source).toContain("qualityAccepted");
  });
});
