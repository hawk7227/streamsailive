import { describe, expect, it } from "vitest";
import { autosizeComposerTextarea } from "../src/components/streams-ai/current-chat/new-face/composer/StreamsComposer";

describe("Streams composer auto-grow behavior", () => {
  it("expands to the full scroll height and never enables inner vertical scrolling", () => {
    const node = {
      scrollHeight: 286,
      style: { height: "", overflowY: "" },
    } as unknown as HTMLTextAreaElement;

    autosizeComposerTextarea(node);

    expect(node.style.height).toBe("286px");
    expect(node.style.overflowY).toBe("hidden");
  });

  it("keeps the one-line minimum height", () => {
    const node = {
      scrollHeight: 12,
      style: { height: "", overflowY: "" },
    } as unknown as HTMLTextAreaElement;

    autosizeComposerTextarea(node);

    expect(node.style.height).toBe("30px");
    expect(node.style.overflowY).toBe("hidden");
  });
});
