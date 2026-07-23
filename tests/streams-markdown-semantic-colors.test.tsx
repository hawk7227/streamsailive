import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ChatMarkdownMessage from "../src/components/streams-ai/current-chat/new-face/markdown/ChatMarkdownMessage";
import markdownCss from "../src/components/streams-ai/current-chat/new-face/markdown/chat-markdown.css?raw";

describe("Streams markdown semantic colors", () => {
  it("emits distinct semantic classes for markdown artifacts", () => {
    const html = renderToStaticMarkup(<ChatMarkdownMessage content={`# Heading\n\nBody **bold title** with [link](/streams-ai).\n\n- Item\n\n> Quote\n\n\`code\``} />);
    expect(html).toContain("chatMarkdownHeading");
    expect(html).toContain("chatMarkdownStrong");
    expect(html).toContain("chatMarkdownLink");
    expect(html).toContain("chatMarkdownList");
    expect(html).toContain("chatMarkdownQuote");
    expect(html).toContain("chatMarkdownArtifact");
  });

  it("keeps heading and bold colors different from response body text", () => {
    expect(markdownCss).toContain("--chat-response-text: #dbe7f7");
    expect(markdownCss).toContain("--chat-heading-text: #67e8f9");
    expect(markdownCss).toContain("--chat-strong-text: #f0abfc");
    expect(markdownCss).toContain("color: var(--chat-response-text)");
    expect(markdownCss).toContain("color: var(--chat-heading-text)");
    expect(markdownCss).toContain("color: var(--chat-strong-text)");
    expect("#dbe7f7").not.toBe("#67e8f9");
    expect("#dbe7f7").not.toBe("#f0abfc");
  });

  it("gives other markdown artifacts their own semantic colors", () => {
    for (const token of ["--chat-marker-text", "--chat-link-text", "--chat-quote-text", "--chat-code-label", "--chat-table-heading"]) {
      expect(markdownCss).toContain(token);
    }
  });
});
