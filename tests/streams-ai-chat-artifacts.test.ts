import { describe, expect, it } from "vitest";
import { highlightCode } from "../src/components/streams-ai/current-chat/new-face/markdown/syntaxHighlight";
import { isLinkIntent } from "../src/components/streams-ai/current-chat/runtime/streamsLinkClient";
import fs from "node:fs";
import path from "node:path";

describe("Streams AI chat artifact integration", () => {
  it("never hijacks normal chat prompts as link ingestion", () => {
    const prompt = `Respond with Markdown exactly.\n| Link | State |\n| https://example.com/docs | Ready |\n\n\`\`\`javascript\nconst url = "https://example.com";\n\`\`\``;
    expect(isLinkIntent(prompt, "chat")).toBe(false);
    expect(isLinkIntent("Analyze this link https://example.com/article", "chat")).toBe(false);
    expect(isLinkIntent("https://example.com/article", "url")).toBe(true);
    expect(isLinkIntent("https://one.example https://two.example", "url")).toBe(false);
  });

  it("produces distinct safe syntax tokens", () => {
    const html = highlightCode('const score = 98; // ready\nreturn "complete";', "javascript");
    expect(html).toContain("syntaxToken--keyword");
    expect(html).toContain("syntaxToken--number");
    expect(html).toContain("syntaxToken--comment");
    expect(html).toContain("syntaxToken--string");
    expect(html).not.toContain("<script>");
  });

  it("wires full message metadata runtime and collapsible user messages", () => {
    const file = fs.readFileSync(path.join(process.cwd(), "src/components/streams-ai/visual-operator/StreamsOperatorShell.jsx"), "utf8");
    expect(file).toContain("<CollapsibleUserMessage content={text}/>");
    expect(file).toContain("<ChatMarkdownMessage content={text} message={message} runtime={chatRuntime}/>");
  });

  it("ships the link ingest route in the production app router", () => {
    expect(fs.existsSync(path.join(process.cwd(), "src/app/api/streams/link/ingest/route.js"))).toBe(true);
  });
});
