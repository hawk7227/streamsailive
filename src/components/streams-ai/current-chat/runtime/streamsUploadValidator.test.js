import { describe, expect, it } from "vitest";
import { getUploadKind, validateUploadFile, validateUploadFiles } from "./streamsUploadValidator";

function makeFile(name, type, size = 1024) {
  return { name, type, size };
}

describe("streamsUploadValidator", () => {
  it("classifies common file types", () => {
    expect(getUploadKind(makeFile("a.png", "image/png"))).toBe("image");
    expect(getUploadKind(makeFile("a.mp4", "video/mp4"))).toBe("video");
    expect(getUploadKind(makeFile("a.mp3", "audio/mpeg"))).toBe("audio");
    expect(getUploadKind(makeFile("a.pdf", "application/pdf"))).toBe("document");
    expect(getUploadKind(makeFile("a.tsx", ""))).toBe("code");
  });

  it("accepts supported files", () => {
    expect(validateUploadFile(makeFile("a.webp", "image/webp")).ok).toBe(true);
    expect(validateUploadFile(makeFile("a.mov", "video/quicktime")).ok).toBe(true);
  });

  it("rejects oversized files", () => {
    const result = validateUploadFile(makeFile("a.png", "image/png", 100), {
      limits: { image: 10 },
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("file_too_large");
  });

  it("returns truthful unsupported analysis state", () => {
    const result = validateUploadFile(makeFile("a.bin", "application/octet-stream"));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("unsupported_for_analysis");
  });

  it("validates lists", () => {
    const results = validateUploadFiles([
      makeFile("a.png", "image/png"),
      makeFile("b.pdf", "application/pdf"),
    ]);

    expect(results).toHaveLength(2);
    expect(results.every((item) => item.ok)).toBe(true);
  });
});
