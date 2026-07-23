import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ChatMarkdownMessage from "../src/components/streams-ai/current-chat/new-face/markdown/ChatMarkdownMessage";
import { CHAT_MARKDOWN_SEMANTIC_COLORS, CHAT_MARKDOWN_STYLE_VARS } from "../src/components/streams-ai/current-chat/new-face/markdown/markdown-semantic-colors";

describe("Streams markdown semantic colors", () => {
  it("keeps heading and bold colors different from response body text", () => {
    expect(CHAT_MARKDOWN_SEMANTIC_COLORS.responseText).not.toBe(CHAT_MARKDOWN_SEMANTIC_COLORS.headingText);
    expect(CHAT_MARKDOWN_SEMANTIC_COLORS.responseText).not.toBe(CHAT_MARKDOWN_SEMANTIC_COLORS.strongText);
    expect(CHAT_MARKDOWN_SEMANTIC_COLORS.headingText).not.toBe(CHAT_MARKDOWN_SEMANTIC_COLORS.strongText);
  });

  it("defines separate colors for all markdown artifacts", () => {
    const values = Object.values(CHAT_MARKDOWN_SEMANTIC_COLORS);
    expect(new Set(values).size).toBe(values.length);
    expect(CHAT_MARKDOWN_STYLE_VARS["--chat-marker-text"]).toBe(CHAT_MARKDOWN_SEMANTIC_COLORS.markerText);
    expect(CHAT_MARKDOWN_STYLE_VARS["--chat-link-text"]).toBe(CHAT_MARKDOWN_SEMANTIC_COLORS.linkText);
    expect(CHAT_MARKDOWN_STYLE_VARS["--chat-quote-text"]).toBe(CHAT_MARKDOWN_SEMANTIC_COLORS.quoteText);
    expect(CHAT_MARKDOWN_STYLE_VARS["--chat-code-label"]).toBe(CHAT_MARKDOWN_SEMANTIC_COLORS.codeLabel);
    expect(CHAT_MARKDOWN_STYLE_VARS["--chat-table-heading"]).toBe(CHAT_MARKDOWN_SEMANTIC_COLORS.tableHeading);
  });

  it("keeps the proven renderer producing heading and bold markdown elements", () => {
    const html = renderToStaticMarkup(<ChatMarkdownMessage content="# Heading\n\nBody with **bold text**." />);
    expect(html).toContain('class="chatMarkdown"');
    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("<strong>bold text</strong>");
  });
});
