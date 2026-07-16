import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { sanitizeStreamsAIPayload } from "../src/lib/streams-ai/protected-reasoning";

describe("Streams AI message persistence safety", () => {
  it("removes protected fields from nested runtime metadata", () => {
    const clean = sanitizeStreamsAIPayload({
      metadata: {
        contextSnapshot: {
          system_prompt: "must not persist",
          usefulContext: "safe",
        },
      },
    }) as any;

    expect(clean.metadata.contextSnapshot.system_prompt).toBeUndefined();
    expect(clean.metadata.contextSnapshot.usefulContext).toBe("safe");
  });

  it("sanitizes the complete create input before protected-field validation", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/lib/streams-ai/repositories/messages-repository.ts"),
      "utf8",
    );

    expect(source).toContain("const safeInput = sanitizeStreamsAIPayload(input)");
    expect(source).toContain("assertNoProtectedFields(safeInput)");
    expect(source.indexOf("const safeInput = sanitizeStreamsAIPayload(input)")).toBeLessThan(
      source.indexOf("assertNoProtectedFields(safeInput)"),
    );
  });
});
