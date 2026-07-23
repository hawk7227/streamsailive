import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/components/streams-ai/current-chat/new-face/composer/StreamsComposer", () => ({
  default: () => <div data-testid="preserved-streams-composer">Composer</div>,
}));
vi.mock("../src/components/streams-ai/current-chat/new-face/markdown/ChatMarkdownMessage", () => ({
  default: ({ content }: { content: string }) => <div data-testid="preserved-markdown">{content}</div>,
}));
vi.mock("@/components/account/StreamsAccountActionPanel", () => ({
  default: () => <div>Account panel</div>,
}));
vi.mock("../src/components/streams-ai/visual-operator/MessageActions", () => ({
  default: () => <div>Message actions</div>,
}));
vi.mock("../src/components/streams-ai/visual-operator/useAuthoritativeStreamsRuntime", () => ({
  default: (runtime: unknown) => runtime,
}));

import StreamsOperatorShell from "../src/components/streams-ai/visual-operator/StreamsOperatorShell";

describe("builder-style Streams chat shell", () => {
  it("keeps the existing runtime and composer inside the new workspace presentation", () => {
    const html = renderToStaticMarkup(<StreamsOperatorShell chatRuntime={{ messages: [] }} />);
    expect(html).toContain('data-testid="preserved-streams-composer"');
    expect(html).toContain("Ask, build, create, launch.");
    expect(html).toContain("Start with a conversation");
  });

  it("uses the same compact universal navigation destinations as the builder", () => {
    const html = renderToStaticMarkup(<StreamsOperatorShell chatRuntime={{ messages: [] }} />);
    for (const label of ["Home", "Projects", "Workspace", "Files", "Create", "Generate", "Build", "Assets", "Tasks", "History", "Ask AI", "Settings"]) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    expect(html).toContain('class="operatorSidebar"');
    expect(html).not.toContain("Collapse sidebar");
    expect(html).not.toContain("Your AI Business Operator");
  });

  it("preserves open assistant responses and restrained user bubbles", () => {
    const html = renderToStaticMarkup(<StreamsOperatorShell chatRuntime={{ messages: [
      { id: "u1", role: "user", content: "Build this project" },
      { id: "a1", role: "assistant", content: "I am working on it." },
    ] }} />);
    expect(html).toContain('class="operatorMessage user"');
    expect(html).toContain('class="operatorMessage assistant"');
    expect(html).toContain('data-testid="preserved-markdown"');
  });
});
