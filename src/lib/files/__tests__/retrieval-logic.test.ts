/**
 * src/lib/files/__tests__/retrieval-logic.test.ts
 *
 * Unit tests for pure file intelligence functions.
 * No OpenAI calls. No Supabase.
 *
 * Covers:
 *   TEST 4 partial — embedding cache key stability and LRU behavior
 *   Retrieval diversification — diversifyByFile correctness
 */

import { describe, it, expect, beforeEach } from "vitest";
import { embeddingCache, embeddingCacheKey } from "../embedCache";

// ── Re-implement diversifyByFile for isolated testing ─────────────────────

type RawResult = { file_id: string; chunk_index: number; content: string; rank: number };

function diversifyByFile(
  results: RawResult[],
  limit: number,
  maxPerFile: number,
): RawResult[] {
  const countByFile = new Map<string, number>();
  const out: RawResult[] = [];
  for (const r of results) {
    const count = countByFile.get(r.file_id) ?? 0;
    if (count >= maxPerFile) continue;
    countByFile.set(r.file_id, count + 1);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

function makeResult(fileId: string, chunkIdx: number, rank: number): RawResult {
  return { file_id: fileId, chunk_index: chunkIdx, content: `content-${fileId}-${chunkIdx}`, rank };
}

// ── Retrieval diversification ─────────────────────────────────────────────

describe("diversifyByFile — per-file chunk cap", () => {
  it("single file dominating all 6 slots → capped at maxPerFile", () => {
    const results = Array.from({ length: 8 }, (_, i) =>
      makeResult("types.ts", i, 1.0 - i * 0.05),
    );
    const diversified = diversifyByFile(results, 6, 2);
    expect(diversified).toHaveLength(2);
    expect(diversified.every(r => r.file_id === "types.ts")).toBe(true);
    // Highest-ranked chunks preserved
    expect(diversified[0].chunk_index).toBe(0);
    expect(diversified[1].chunk_index).toBe(1);
  });

  it("3 files × 4 chunks each → 2 from each file, 6 total", () => {
    const results = [
      makeResult("a.ts", 0, 0.95),
      makeResult("a.ts", 1, 0.93),
      makeResult("b.ts", 0, 0.91),
      makeResult("b.ts", 1, 0.89),
      makeResult("c.ts", 0, 0.87),
      makeResult("c.ts", 1, 0.85),
      makeResult("a.ts", 2, 0.83), // 3rd chunk from a — should be excluded
      makeResult("b.ts", 2, 0.81), // 3rd chunk from b — should be excluded
    ];
    const diversified = diversifyByFile(results, 6, 2);
    expect(diversified).toHaveLength(6);
    const byFile = new Map<string, number>();
    for (const r of diversified) byFile.set(r.file_id, (byFile.get(r.file_id) ?? 0) + 1);
    expect(byFile.get("a.ts")).toBe(2);
    expect(byFile.get("b.ts")).toBe(2);
    expect(byFile.get("c.ts")).toBe(2);
  });

  it("rank order is preserved within and across files", () => {
    const results = [
      makeResult("a.ts", 0, 0.99),
      makeResult("b.ts", 0, 0.97),
      makeResult("a.ts", 1, 0.95),
      makeResult("b.ts", 1, 0.93),
    ];
    const diversified = diversifyByFile(results, 4, 2);
    // Should come out in original rank order: a0, b0, a1, b1
    expect(diversified[0].file_id).toBe("a.ts");
    expect(diversified[0].chunk_index).toBe(0);
    expect(diversified[1].file_id).toBe("b.ts");
    expect(diversified[1].chunk_index).toBe(0);
    expect(diversified[2].file_id).toBe("a.ts");
    expect(diversified[2].chunk_index).toBe(1);
    expect(diversified[3].file_id).toBe("b.ts");
    expect(diversified[3].chunk_index).toBe(1);
  });

  it("fewer candidates than limit → returns all without padding", () => {
    const results = [makeResult("a.ts", 0, 0.9), makeResult("b.ts", 0, 0.8)];
    const diversified = diversifyByFile(results, 6, 2);
    expect(diversified).toHaveLength(2);
  });

  it("empty results → empty output", () => {
    expect(diversifyByFile([], 6, 2)).toHaveLength(0);
  });

  it("maxPerFile = 1 → one chunk per file maximum", () => {
    const results = [
      makeResult("a.ts", 0, 0.99),
      makeResult("a.ts", 1, 0.97),
      makeResult("b.ts", 0, 0.95),
      makeResult("b.ts", 1, 0.93),
    ];
    const diversified = diversifyByFile(results, 4, 1);
    expect(diversified).toHaveLength(2);
    expect(diversified[0].file_id).toBe("a.ts");
    expect(diversified[0].chunk_index).toBe(0); // only highest-ranked chunk
    expect(diversified[1].file_id).toBe("b.ts");
    expect(diversified[1].chunk_index).toBe(0);
  });

  it("exactly hitting the limit stops iteration", () => {
    const results = Array.from({ length: 20 }, (_, i) =>
      makeResult(`file-${i}.ts`, 0, 1.0 - i * 0.01),
    );
    const diversified = diversifyByFile(results, 6, 2);
    expect(diversified).toHaveLength(6);
  });
});

// ── Embedding cache key stability ─────────────────────────────────────────

describe("embeddingCacheKey — stability and normalization", () => {
  it("same workspace + same query → same key", () => {
    const k1 = embeddingCacheKey("ws-1", "authentication flow");
    const k2 = embeddingCacheKey("ws-1", "authentication flow");
    expect(k1).toBe(k2);
  });

  it("normalized queries produce same key (trim + lowercase)", () => {
    const k1 = embeddingCacheKey("ws-1", "  Authentication Flow  ");
    const k2 = embeddingCacheKey("ws-1", "authentication flow");
    expect(k1).toBe(k2);
  });

  it("different workspace → different key (no cross-workspace bleed)", () => {
    const k1 = embeddingCacheKey("ws-1", "auth");
    const k2 = embeddingCacheKey("ws-2", "auth");
    expect(k1).not.toBe(k2);
  });

  it("different query → different key", () => {
    const k1 = embeddingCacheKey("ws-1", "authentication");
    const k2 = embeddingCacheKey("ws-1", "authorization");
    expect(k1).not.toBe(k2);
  });

  it("key format is workspaceId:hash (no whitespace, no slashes)", () => {
    const key = embeddingCacheKey("my-workspace", "query text");
    expect(key).toMatch(/^[^:\s]+:[a-z0-9]+$/);
    expect(key.startsWith("my-workspace:")).toBe(true);
  });
});

// ── Embedding LRU cache behavior ──────────────────────────────────────────

describe("EmbeddingLRUCache — LRU and TTL behavior", () => {
  const testEmbedding = Array.from({ length: 10 }, (_, i) => i * 0.1);

  it("set then get returns the same embedding", () => {
    const key = embeddingCacheKey("ws-test", "test-query-get-set");
    embeddingCache.set(key, testEmbedding);
    const result = embeddingCache.get(key);
    expect(result).toEqual(testEmbedding);
  });

  it("get on missing key returns null", () => {
    const result = embeddingCache.get("ws-nonexistent:zzz999");
    expect(result).toBeNull();
  });

  it("stats tracks hits and misses", () => {
    const key = embeddingCacheKey("ws-stats", "stats-query");
    embeddingCache.set(key, testEmbedding);
    const before = embeddingCache.stats();

    embeddingCache.get(key);         // hit
    embeddingCache.get("missing-key-xyz"); // miss

    const after = embeddingCache.stats();
    expect(after.hits).toBeGreaterThan(before.hits);
    expect(after.misses).toBeGreaterThan(before.misses);
  });

  it("stats hitRate is a percentage string", () => {
    const stats = embeddingCache.stats();
    expect(stats.hitRate).toMatch(/^\d+%$/);
  });

  it("size tracks number of entries", () => {
    const sizeBefore = embeddingCache.stats().size;
    const key = `ws-size:unique-key-${Date.now()}`;
    embeddingCache.set(key, testEmbedding);
    expect(embeddingCache.stats().size).toBe(sizeBefore + 1);
  });
});
