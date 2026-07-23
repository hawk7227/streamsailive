import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ImageGenerationCard from "../src/components/streams-ai/current-chat/new-face/cards/ImageGenerationCard";
import VideoGenerationCard from "../src/components/streams-ai/current-chat/new-face/cards/VideoGenerationCard";
import InlineAssistantImageCard from "../src/components/streams-ai/current-chat/new-face/media/InlineAssistantImageCard";
import InlineAssistantVideoCard from "../src/components/streams-ai/current-chat/new-face/media/InlineAssistantVideoCard";

describe("frameless inline chat media", () => {
  it("renders generated images directly without card status or metadata chrome", () => {
    const html = renderToStaticMarkup(<ImageGenerationCard image={{ status: "ready", url: "https://example.com/image.png" }} />);
    expect(html).toContain("streamsInlineMedia streamsInlineImage");
    expect(html).toContain("https://example.com/image.png");
    expect(html).not.toContain("Image ready");
    expect(html).not.toContain("streamsGeneratedMediaMeta");
    expect(html).not.toContain("streamsGeneratedMediaCard");
  });

  it("renders generated videos directly without footer or provider labels", () => {
    const html = renderToStaticMarkup(<VideoGenerationCard video={{ status: "ready", url: "https://example.com/video.mp4", provider: "provider" }} />);
    expect(html).toContain("streamsInlineMedia streamsInlineVideo");
    expect(html).toContain("https://example.com/video.mp4");
    expect(html).not.toContain("Video ready");
    expect(html).not.toContain("Provider:");
    expect(html).not.toContain("streamsGeneratedMediaCard");
  });

  it("uses the same direct media surface for assistant image and video streams", () => {
    const imageHtml = renderToStaticMarkup(<InlineAssistantImageCard image={{ status: "ready", url: "https://example.com/assistant.png" }} />);
    const videoHtml = renderToStaticMarkup(<InlineAssistantVideoCard video={{ url: "https://example.com/assistant.mp4" }} />);
    expect(imageHtml).toContain("streamsInlineMedia streamsInlineImage");
    expect(videoHtml).toContain("streamsInlineMedia streamsInlineVideo");
    expect(imageHtml).not.toContain("inlineAssistantImageMetaRow");
    expect(videoHtml).not.toContain("Generated video</strong>");
  });
});
