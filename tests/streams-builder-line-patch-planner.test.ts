import { describe, expect, it } from "vitest";
import { planMinimalLinePatch } from "../src/lib/streams-builder/line-patch-planner";

describe("builder line patch planner", () => {
  it("prefers a bounded range and retains full-file fallback", () => {
    const filePath = "src/app/example/page.tsx";
    const original = ["export default function Page() {", "  return <h1>Old title</h1>;", "}"].join("\n");
    const next = ["export default function Page() {", "  return <h1>New title</h1>;", "}"].join("\n");
    const precise = planMinimalLinePatch(filePath, original, next);
    expect(precise.operations).toHaveLength(1);
    expect(precise.operations[0]).toMatchObject({ type: "replace_range", startLine: 2, endLine: 2 });

    const largeOriginal = Array.from({ length: 700 }, (_, index) => `before-${index}`).join("\n");
    const largeNext = Array.from({ length: 700 }, (_, index) => `after-${index}`).join("\n");
    const fallback = planMinimalLinePatch(filePath, largeOriginal, largeNext);
    expect(fallback.operations[0].type).toBe("replace_full_file");
  });
});
