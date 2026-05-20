import { describe, expect, it, vi } from "vitest";
import { createStreamsIngestionClient } from "./streamsIngestionClient";

function response(body, ok = true) {
  return { ok, json: async () => body };
}

describe("streamsIngestionClient", () => {
  it("creates ingestion jobs", async () => {
    const fetcher = vi.fn(async () => response({ id: "job_1" }));
    const client = createStreamsIngestionClient({ fetcher });

    const result = await client.createJob({ kind: "image" });

    expect(result.id).toBe("job_1");
    expect(fetcher.mock.calls[0][0]).toContain("/api/streams/ingest/create");
  });

  it("reads status", async () => {
    const fetcher = vi.fn(async () => response({ status: "complete" }));
    const client = createStreamsIngestionClient({ fetcher });

    expect((await client.getStatus("job_1")).status).toBe("complete");
  });

  it("throws on failed responses", async () => {
    const fetcher = vi.fn(async () => response({}, false));
    const client = createStreamsIngestionClient({ fetcher });

    await expect(client.getStatus("job_1")).rejects.toThrow("Ingestion status request failed.");
  });
});
