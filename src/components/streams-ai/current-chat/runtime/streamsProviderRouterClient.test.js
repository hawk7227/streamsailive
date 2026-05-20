import { describe, expect, it, vi } from "vitest";
import { createStreamsProviderRouterClient } from "./streamsProviderRouterClient";

function response(body, ok = true) {
  return { ok, json: async () => body };
}

describe("streamsProviderRouterClient", () => {
  it("creates media jobs through the backend router", async () => {
    const fetcher = vi.fn(async () => response({ id: "job_1" }));
    const client = createStreamsProviderRouterClient({ fetcher });

    const result = await client.createMediaJob({ mode: "text_to_image" });

    expect(result.id).toBe("job_1");
    expect(fetcher.mock.calls[0][0]).toContain("/api/streams/media/create");
  });

  it("reads media status", async () => {
    const fetcher = vi.fn(async () => response({ status: "complete" }));
    const client = createStreamsProviderRouterClient({ fetcher });

    expect((await client.getMediaStatus("job_1")).status).toBe("complete");
  });
});
