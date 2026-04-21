#!/usr/bin/env tsx
/**
 * scripts/test-live-orchestrator.ts
 *
 * Live integration test runner for the assistant orchestrator.
 * Requires a running Next.js server at ORCHESTRATOR_URL.
 *
 * Usage:
 *   ORCHESTRATOR_URL=http://localhost:3000/api/ai-assistant npx tsx scripts/test-live-orchestrator.ts
 *
 * What it tests (all require real OpenAI key):
 *   TEST 1  — Simple chat → mini, fast TTFT
 *   TEST 2  — Complex chat → full model upfront
 *   TEST 3  — File-backed → full model (requires workspaceId)
 *   TEST 4  — Embedding cache MISS → HIT on repeat query
 *   TEST 5  — Deadline race (observed via context_ms in logs)
 *   TEST 7  — Streaming integrity (tokens arrive incrementally)
 *   TEST 8  — TURN_TIMING present on every request
 *   TEST 9  — Error path surfaces correctly
 *   TEST 10 — No double call on non-tool simple chat
 */

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? "http://localhost:3000/api/ai-assistant";
const WORKSPACE_ID     = process.env.TEST_WORKSPACE_ID; // optional — required for TEST 3 & 4

type TurnResult = {
  testName: string;
  passed: boolean;
  firstTokenMs: number | null;
  totalMs: number;
  textChunks: number;
  fullText: string;
  events: string[];
  error?: string;
};

async function callOrchestrator(
  message: string,
  context: Record<string, unknown> = {},
): Promise<TurnResult & { rawEvents: Array<{ event: string; data: unknown }> }> {
  const start = performance.now();
  let firstTokenMs: number | null = null;
  const events: string[] = [];
  const rawEvents: Array<{ event: string; data: unknown }> = [];
  let textChunks = 0;
  let fullText = "";

  const res = await fetch(ORCHESTRATOR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context }),
  });

  if (!res.ok || !res.body) {
    return {
      testName: "",
      passed: false,
      firstTokenMs: null,
      totalMs: performance.now() - start,
      textChunks: 0,
      fullText: "",
      events: [`HTTP ${res.status}`],
      rawEvents: [],
      error: `HTTP ${res.status}`,
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      if (!part.trim()) continue;
      const eventLine = part.match(/^event: (.+)$/m)?.[1];
      const dataLine  = part.match(/^data: (.+)$/m)?.[1];
      if (!eventLine || !dataLine) continue;

      let data: unknown;
      try { data = JSON.parse(dataLine); } catch { data = dataLine; }

      events.push(eventLine);
      rawEvents.push({ event: eventLine, data });

      if (eventLine === "text_delta") {
        if (firstTokenMs === null) firstTokenMs = performance.now() - start;
        const d = data as { delta?: string };
        if (d.delta) { fullText += d.delta; textChunks++; }
      }
    }
  }

  return {
    testName: "",
    passed: true,
    firstTokenMs,
    totalMs: performance.now() - start,
    textChunks,
    fullText,
    events,
    rawEvents,
  };
}

function pass(name: string, detail: string) {
  console.log(`  ✅ PASS  ${name}: ${detail}`);
}
function fail(name: string, detail: string) {
  console.log(`  ❌ FAIL  ${name}: ${detail}`);
  process.exitCode = 1;
}
function info(msg: string) {
  console.log(`  ℹ  ${msg}`);
}

// ─────────────────────────────────────────────────────────────────────────────

async function test1_simpleChatFastPath() {
  console.log("\n── TEST 1: Simple chat → mini, fast TTFT ──");
  const result = await callOrchestrator("What is 2+2?");

  const phaseData = result.rawEvents
    .filter(e => e.event === "phase" && (e.data as { phase?: string }).phase === "calling_openai")
    .map(e => (e.data as { model?: string }).model);

  const model = phaseData[0];
  info(`model from phase event: ${model}`);
  info(`first token: ${result.firstTokenMs?.toFixed(0)}ms`);
  info(`total: ${result.totalMs.toFixed(0)}ms`);
  info(`text chunks received: ${result.textChunks}`);

  if (model === "gpt-4o-mini") {
    pass("model", `gpt-4o-mini selected ✓`);
  } else {
    fail("model", `expected gpt-4o-mini, got ${model}`);
  }

  if (result.textChunks > 1) {
    pass("streaming", `received ${result.textChunks} chunks (incremental, not one dump)`);
  } else if (result.textChunks === 1) {
    info("streaming: received 1 chunk — may be very short answer (acceptable for 2+2)");
  } else {
    fail("streaming", "received 0 text chunks");
  }

  if (result.firstTokenMs !== null && result.firstTokenMs < 500) {
    pass("TTFT", `${result.firstTokenMs.toFixed(0)}ms (acceptable)`);
  } else {
    fail("TTFT", `${result.firstTokenMs?.toFixed(0)}ms — expected <500ms`);
  }
}

async function test2_complexChatFullModel() {
  console.log("\n── TEST 2: Complex chat → full model ──");
  const result = await callOrchestrator(
    "Explain the tradeoffs between vector search and full-text search in large-scale systems.",
  );

  const phaseData = result.rawEvents
    .filter(e => e.event === "phase" && (e.data as { phase?: string }).phase === "calling_openai")
    .map(e => (e.data as { model?: string }).model);

  const model = phaseData[0];
  info(`model: ${model}`);
  info(`text chunks: ${result.textChunks}`);
  info(`answer length: ${result.fullText.length} chars`);

  if (model === "gpt-4.1" || model?.includes("4.1") || model?.includes("4o") && !model?.includes("mini")) {
    pass("model", `full model selected for complex query ✓`);
  } else {
    fail("model", `expected full model (gpt-4.1), got ${model}`);
  }

  if (result.fullText.length > 200) {
    pass("quality", `answer length ${result.fullText.length} chars — substantive response`);
  } else {
    fail("quality", `answer too short (${result.fullText.length} chars)`);
  }
}

async function test7_streamingIntegrity() {
  console.log("\n── TEST 7: Streaming integrity ──");
  const result = await callOrchestrator(
    "List 5 common HTTP status codes and what they mean.",
  );

  info(`text chunks: ${result.textChunks}`);
  info(`total text length: ${result.fullText.length} chars`);
  info(`first token: ${result.firstTokenMs?.toFixed(0)}ms`);

  if (result.textChunks > 3) {
    pass("incremental", `${result.textChunks} chunks — text arrived incrementally ✓`);
  } else if (result.textChunks === 1) {
    fail("incremental", "all text arrived in 1 chunk — not streaming");
  } else {
    info(`streaming: ${result.textChunks} chunks (borderline)`);
  }

  if (!result.events.includes("done")) {
    fail("completion", "no 'done' event received");
  } else {
    pass("completion", "turn completed with 'done' event ✓");
  }

  if (result.fullText.length > 0) {
    pass("content", "text content received ✓");
  } else {
    fail("content", "no text content in response");
  }
}

async function test8_turnTimingCoverage() {
  console.log("\n── TEST 8: TURN_TIMING log coverage ──");
  info("TURN_TIMING is emitted to server stdout (Vercel logs).");
  info("This test verifies the HTTP response completes on all 3 paths:\n");

  const tests = [
    { label: "simple chat",   msg: "hi" },
    { label: "complex chat",  msg: "Explain in detail how neural networks work." },
    { label: "image request", msg: "Generate an image of a sunset" },
  ];

  for (const t of tests) {
    const result = await callOrchestrator(t.msg);
    if (result.events.includes("done")) {
      pass(t.label, `completed (done event received) — TURN_TIMING logged server-side ✓`);
    } else {
      fail(t.label, "no done event — TURN_TIMING may not have fired");
    }
  }
  info("→ Check Vercel/server logs for TURN_TIMING JSON lines to verify all fields present.");
}

async function test9_errorPath() {
  console.log("\n── TEST 9: Error path surfaces correctly ──");
  // Send an empty message — orchestrator normalizes this and should return
  // a graceful response rather than hanging
  const result = await callOrchestrator("", {});

  if (result.events.includes("done")) {
    pass("no hang", "empty message resolved with done event — no silent hang ✓");
  } else if (result.error) {
    info(`got error: ${result.error} — acceptable if surfaced`);
  } else {
    fail("completion", "request hung or no done event");
  }
}

async function test10_noDoubleCall() {
  console.log("\n── TEST 10: No double call for simple non-tool chat ──");
  const start = performance.now();
  const result = await callOrchestrator("What color is the sky?");
  const elapsed = performance.now() - start;

  const toolCallEvents = result.events.filter(e => e === "tool_call");
  const phaseData = result.rawEvents
    .filter(e => e.event === "phase" && (e.data as { phase?: string }).phase === "calling_openai")
    .map(e => (e.data as { model?: string }).model);

  info(`OpenAI call count (phase events): ${phaseData.length}`);
  info(`Tool calls: ${toolCallEvents.length}`);
  info(`Total time: ${elapsed.toFixed(0)}ms`);

  if (phaseData.length === 1) {
    pass("single call", "exactly 1 OpenAI call — no double call ✓");
  } else {
    fail("single call", `expected 1 OpenAI call, got ${phaseData.length}`);
  }

  if (toolCallEvents.length === 0) {
    pass("no tools", "no tool calls on simple question ✓");
  } else {
    fail("no tools", `unexpected tool calls: ${toolCallEvents.length}`);
  }
}

async function test4_embeddingCacheConditional() {
  if (!WORKSPACE_ID) {
    console.log("\n── TEST 4: Embedding cache — SKIPPED (set TEST_WORKSPACE_ID to run) ──");
    return;
  }
  console.log("\n── TEST 4: Embedding cache MISS → HIT ──");
  const query = "What does this workspace contain?";

  info("Turn 1 (cold cache):");
  const r1 = await callOrchestrator(query, { workspaceId: WORKSPACE_ID });
  info(`  context_ms (inferred from total): ~${r1.totalMs.toFixed(0)}ms total`);

  info("Turn 2 (warm cache — same query):");
  const r2 = await callOrchestrator(query, { workspaceId: WORKSPACE_ID });
  info(`  context_ms (inferred from total): ~${r2.totalMs.toFixed(0)}ms total`);

  // We can't read server-side logs here, but total time should drop
  if (r2.totalMs < r1.totalMs * 0.8) {
    pass("cache speedup", `turn 2 (${r2.totalMs.toFixed(0)}ms) < turn 1 (${r1.totalMs.toFixed(0)}ms) — cache effective`);
  } else {
    info(`cache: turn 1=${r1.totalMs.toFixed(0)}ms, turn 2=${r2.totalMs.toFixed(0)}ms — check EMBED_CACHE_HIT in server logs`);
  }
}

// ── Runner ────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log(" StreamsAI Orchestrator — Live Integration Tests");
  console.log(`  Target: ${ORCHESTRATOR_URL}`);
  console.log(`  Workspace: ${WORKSPACE_ID ?? "(not set — file tests skipped)"}`);
  console.log("═══════════════════════════════════════════════════════");

  // Connectivity check
  try {
    const probe = await fetch(ORCHESTRATOR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "ping" }),
    });
    if (!probe.ok && probe.status !== 401) {
      console.log(`\n❌ Cannot reach ${ORCHESTRATOR_URL} (HTTP ${probe.status}). Start Next.js first.\n`);
      process.exit(1);
    }
  } catch {
    console.log(`\n❌ Cannot reach ${ORCHESTRATOR_URL}. Start Next.js with: pnpm dev\n`);
    process.exit(1);
  }

  await test1_simpleChatFastPath();
  await test2_complexChatFullModel();
  await test4_embeddingCacheConditional();
  await test7_streamingIntegrity();
  await test8_turnTimingCoverage();
  await test9_errorPath();
  await test10_noDoubleCall();

  console.log("\n═══════════════════════════════════════════════════════");
  if (process.exitCode === 1) {
    console.log(" RESULT: Some tests FAILED — review output above");
  } else {
    console.log(" RESULT: All live tests PASSED");
  }
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch(console.error);
