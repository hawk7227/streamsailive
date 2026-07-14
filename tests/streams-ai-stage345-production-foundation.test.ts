// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildStreamsResearchPlan } from "../src/lib/streams-ai/research/research-agent";
import { collectProviderCitations, countVisibleMarkdownCitations, renderProviderCitations } from "../src/lib/streams-ai/research/provider-citation-renderer";
import { classifyStreamsIntent } from "../src/lib/streams-ai/runtime/intent-engine";
import { executeStreamsTool } from "../src/lib/streams-ai/tools/tool-runtime-contract";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("Streams Stage 3-5 production foundations", () => {
  it("creates a multi-query research contract for current information", () => {
    const instruction = "What are the latest 3 OpenAI API changes from the last 7 days?";
    const intent = classifyStreamsIntent({ userMessage: instruction });
    const plan = buildStreamsResearchPlan({ instruction, intent });
    expect(plan.required).toBe(true);
    expect(plan.queries.length).toBeGreaterThan(1);
    expect(plan.minimumSources).toBeGreaterThanOrEqual(3);
    expect(plan.requireClaimCitationMapping).toBe(true);
  });

  it("renders provider citation annotations into the user-visible research answer", () => {
    const text = "A verified announcement was published.";
    const citations = collectProviderCitations([
      { type: "url_citation", url: "https://example.com/official", title: "Official source", start_index: 0, end_index: text.length },
    ]);
    const rendered = renderProviderCitations(text, citations);
    expect(rendered.citationCount).toBe(1);
    expect(rendered.content).toContain("[Official source](https://example.com/official)");
    expect(countVisibleMarkdownCitations(rendered.content)).toBe(1);

    const activeRoute = read("src/lib/streams-ai/routes/messages-memory-active.ts");
    expect(activeRoute).toContain("collectProviderCitations");
    expect(activeRoute).toContain("renderProviderCitations");
    expect(activeRoute).toContain("CURRENT_RESEARCH_CONTRACT");
    expect(activeRoute).toContain("citationCount: candidate.citationCount");
  });

  it("accepts browser and server-runtime file objects and uploads stable bytes", () => {
    const route = read("src/app/api/streams-ai/assets/route.ts");
    const repository = read("src/lib/streams-ai/repositories/assets-repository.ts");
    expect(route).toContain("isUploadFileLike");
    expect(route).toContain('typeof (value as any)?.arrayBuffer === "function"');
    expect(route).not.toContain("item instanceof File");
    expect(route).toContain("STREAMS_UPLOAD_FILE_MISSING");
    expect(route).toContain("STREAMS_UPLOAD_STORAGE_FAILED");
    expect(repository).toContain("const bytes = await file.arrayBuffer()");
    expect(repository).toContain(".upload(storagePath, bytes");
    expect(repository).toContain('file.type === "application/pdf"');
  });

  it("never marks a tool receipt verified until verification succeeds", async () => {
    const receipt = await executeStreamsTool({
      definition: {
        name: "test-tool",
        description: "test",
        risk: "write",
        requiresApproval: true,
        validate: () => ({ value: true }),
        authorize: async () => {},
        execute: async () => ({ changed: true }),
        verify: async () => { throw new Error("verification failed"); },
      },
      rawInput: {},
      taskId: "task-1",
      toolCallId: "tool-1",
      idempotencyKey: "idem-1",
      approvalGranted: true,
    });
    expect(receipt.status).toBe("failed");
    expect(receipt.verified).toBe(false);
  });

  it("persists authoritative task states and validates transitions", () => {
    const lifecycle = read("src/lib/streams-ai/runtime/task-lifecycle.ts");
    const controller = read("src/lib/streams-ai/runtime/authoritative-turn-controller.ts");
    expect(lifecycle).toContain("Invalid Streams task transition");
    expect(lifecycle).toContain("jobs.createEvent");
    expect(controller).toContain("new StreamsTaskLifecycle");
    expect(controller).toContain("await lifecycle.create()");
    expect(controller).toContain("await lifecycle.fail(error)");
    expect(controller).toContain("await lifecycle.cancel()");
  });

  it("requires authentication and session ownership for runtime events", () => {
    const route = read("src/app/api/streams-ai/runtime-events/route.ts");
    expect(route).toContain("requireStreamsAIScope");
    expect(route).toContain("requireOwnedSession");
    expect(route).toContain("Cross-session runtime events are not allowed");
    expect(route).not.toContain('|| "agent-1"');
  });

  it("ships a generated 1000-case benchmark and drift release gate", () => {
    const benchmark = read("scripts/streams-ai-parity-benchmark.mjs");
    const drift = read("scripts/streams-ai-parity-drift-gate.mjs");
    expect(benchmark).toContain("index < 1000");
    expect(benchmark).toContain("thresholds");
    expect(drift).toContain("release blocked");
    expect(drift).toContain("criticalFailures");
  });
});
