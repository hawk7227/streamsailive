import { describe, expect, it } from "vitest";
import { createAssetRecord, isDurableAsset } from "./streamsAssetModel";

describe("streamsAssetModel", () => {
  it("creates asset records", () => {
    const asset = createAssetRecord({
      id: "asset_1",
      kind: "image",
      storageBucket: "media",
      storagePath: "a.png",
    });

    expect(asset.id).toBe("asset_1");
    expect(asset.kind).toBe("image");
    expect(isDurableAsset(asset)).toBe(true);
  });

  it("detects non-durable assets", () => {
    expect(isDurableAsset(createAssetRecord({ id: "a" }))).toBe(false);
  });
});
