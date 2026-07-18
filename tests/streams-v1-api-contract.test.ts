import { describe, expect, it, vi } from "vitest";
import { createStreamsV1OpenApiDocument } from "../src/lib/streams-api/openapi-v1";
import { StreamsV1Client, StreamsV1ClientError, parseStreamsSseChunk } from "../src/lib/streams-api/client-v1";
import { STREAMS_V1_CORE_ROUTES, STREAMS_V1_BUILDER_ROUTES, STREAMS_V1_ROUTE_INVENTORY, normalizeNonNegativeCursor, normalizePositiveLimit, requireIdempotencyKey } from "../src/lib/streams-api/v1-contract";

describe("Streams v1 API contract", () => {
  it("publishes every required core and builder route in OpenAPI", () => {
    const document = createStreamsV1OpenApiDocument("https://streamsailive.vercel.app");
    expect(STREAMS_V1_CORE_ROUTES).toContain("/api/v1/projects");
    expect(STREAMS_V1_CORE_ROUTES).toContain("/api/v1/messages");
    expect(STREAMS_V1_BUILDER_ROUTES).toContain("/api/v1/builder/verifications");
    expect(Object.keys(document.paths)).toEqual([...STREAMS_V1_ROUTE_INVENTORY]);
    expect(document["x-streams-route-count"]).toBe(STREAMS_V1_ROUTE_INVENTORY.length);
  });

  it("normalizes limits, cursors, and idempotency keys", () => {
    expect(normalizePositiveLimit("500", 50, 200)).toBe(200);
    expect(normalizePositiveLimit("bad", 50, 200)).toBe(50);
    expect(normalizeNonNegativeCursor("7")).toBe(7);
    expect(normalizeNonNegativeCursor(-1)).toBeNull();
    expect(requireIdempotencyKey("  request-1  ")).toBe("request-1");
  });

  it("sends bearer, query, and idempotency data and surfaces error envelopes", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("projectId=project-1");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer token-1");
      expect((init?.headers as Record<string, string>)["Idempotency-Key"]).toBe("idem-1");
      return new Response(JSON.stringify({ ok: false, apiVersion: "v1", error: "Conflict", code: "REVISION_CONFLICT" }), { status: 409, headers: { "Content-Type": "application/json" } });
    });
    const client = new StreamsV1Client({ baseUrl: "https://streamsailive.vercel.app", accessToken: "token-1", fetcher: fetcher as typeof fetch });
    await expect(client.request("/api/v1/projects", { query: { projectId: "project-1" }, idempotencyKey: "idem-1" })).rejects.toMatchObject({ name: "StreamsV1ClientError", status: 409, code: "REVISION_CONFLICT" } satisfies Partial<StreamsV1ClientError>);
  });

  it("parses SSE events across split chunks without losing carry", () => {
    const first = parseStreamsSseChunk("event: activity\ndata: working\n\nid: 4\nevent: token\ndata: hel");
    expect(first.events).toEqual([{ event: "activity", data: "working" }]);
    const second = parseStreamsSseChunk("lo\n\nevent: done\ndata: true\n\n", first.carry);
    expect(second.events).toEqual([
      { event: "token", data: "hello", id: "4" },
      { event: "done", data: "true" },
    ]);
    expect(second.carry).toBe("");
  });
});
