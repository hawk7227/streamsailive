import { describe, expect, it } from "vitest";
import markdownCss from "../src/components/streams-ai/current-chat/new-face/markdown/chat-markdown.css?raw";

describe("Streams markdown semantic colors", () => {
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
    expect(markdownCss).toContain(".chatMarkdown li::marker");
    expect(markdownCss).toContain(".chatMarkdown blockquote");
    expect(markdownCss).toContain(".chatMarkdown a");
    expect(markdownCss).toContain(".chatCodeHeader");
    expect(markdownCss).toContain(".chatTableWrap th");
  });

  it("protects semantic colors from page-level overrides", () => {
    expect(markdownCss).toContain("color: var(--chat-heading-text) !important");
    expect(markdownCss).toContain("color: var(--chat-strong-text) !important");
    expect(markdownCss).toContain("color: var(--chat-link-text) !important");
    expect(markdownCss).toContain("color: var(--chat-quote-text) !important");
  });
});
