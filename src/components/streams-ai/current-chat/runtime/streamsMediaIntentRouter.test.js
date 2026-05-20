import { describe, expect, it } from "vitest";
import { detectStreamsMediaIntent, extractFirstUrl, isYouTubeUrl } from "./streamsMediaIntentRouter";

describe("streamsMediaIntentRouter", () => {
  it("routes text to image", () => {
    expect(detectStreamsMediaIntent({ message: "generate an image of a car" }).mode).toBe("text_to_image");
  });

  it("routes micro image analysis", () => {
    const result = detectStreamsMediaIntent({
      message: "micro analyze this",
      attachments: [{ mimeType: "image/png" }],
    });

    expect(result.mode).toBe("image_analysis");
    expect(result.detail).toBe("original");
    expect(result.reasoning).toBe("high");
  });

  it("routes image to image", () => {
    expect(detectStreamsMediaIntent({
      message: "edit this image",
      attachments: [{ kind: "image" }],
    }).mode).toBe("image_to_image");
  });

  it("routes image to video", () => {
    expect(detectStreamsMediaIntent({
      message: "animate this into video",
      attachments: [{ kind: "image" }],
    }).mode).toBe("image_to_video");
  });

  it("routes text to video", () => {
    expect(detectStreamsMediaIntent({ message: "generate a video of a mountain" }).mode).toBe("text_to_video");
  });

  it("routes YouTube URL ingestion", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(detectStreamsMediaIntent({ message: "read https://youtu.be/abc" }).mode).toBe("youtube_ingestion");
  });

  it("routes normal URL ingestion", () => {
    expect(extractFirstUrl("read https://example.com/a")).toBe("https://example.com/a");
    expect(detectStreamsMediaIntent({ message: "read https://example.com/a" }).mode).toBe("url_ingestion");
  });

  it("routes attachment-only uploads", () => {
    expect(detectStreamsMediaIntent({ attachments: [{ kind: "file" }] }).mode).toBe("file_upload");
  });
});
