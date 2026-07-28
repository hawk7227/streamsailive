import { describe, expect, it } from "vitest";
import { autosizeComposerTextarea } from "../src/components/streams-ai/current-chat/new-face/composer/StreamsComposer";

describe("Streams composer adaptive auto-grow behavior", () => {
  it("caps long input at the desktop maximum and enables internal scrolling", () => {
    const node = {
      scrollHeight: 286,
      style: { height: "", overflowY: "" },
    } as unknown as HTMLTextAreaElement;

    autosizeComposerTextarea(node);

    expect(node.style.height).toBe("224px");
    expect(node.style.overflowY).toBe("auto");
  });

  it("keeps the compact two-line minimum height", () => {
    const node = {
      scrollHeight: 12,
      style: { height: "", overflowY: "" },
    } as unknown as HTMLTextAreaElement;

    autosizeComposerTextarea(node);

    expect(node.style.height).toBe("48px");
    expect(node.style.overflowY).toBe("hidden");
  });
});
