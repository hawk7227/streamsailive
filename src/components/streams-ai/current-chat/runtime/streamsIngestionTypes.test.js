import { describe, expect, it } from "vitest";
import { createIngestionJobRecord, isSupportedIngestionKind } from "./streamsIngestionTypes";

describe("streamsIngestionTypes", () => {
  it("accepts supported ingestion kinds", () => {
    expect(isSupportedIngestionKind("video")).toBe(true);
    expect(isSupportedIngestionKind("youtube")).toBe(true);
  });

  it("creates ingestion job records", () => {
    const record = createIngestionJobRecord({ kind: "image", assetId: "asset_1" });
    expect(record.kind).toBe("image");
    expect(record.status).toBe("queued");
  });

  it("rejects unsupported ingestion kinds", () => {
    expect(() => createIngestionJobRecord({ kind: "other" })).toThrow("Unsupported ingestion kind");
  });
});
