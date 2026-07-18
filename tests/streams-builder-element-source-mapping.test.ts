import { describe, expect, it } from "vitest";
import { resolveElementSourceMapping } from "../src/lib/streams-builder/element-source-mapping";

describe("builder element source mapping", () => {
  it("maps a unique visible frontend value to a bounded source range", () => {
    const source = [
      "export default function Page() {",
      "  return (",
      "    <main>",
      "      <button className=\"primary\">Start Free Trial</button>",
      "    </main>",
      "  );",
      "}",
    ].join("\n");
    const mapping = resolveElementSourceMapping({
      projectId: "project-1",
      route: "/",
      sourceFile: "src/app/page.tsx",
      sourceContent: source,
      selector: "button.primary",
      kind: "button",
      text: "Start Free Trial",
    });
    expect(mapping.strategy).toBe("exact-unique");
    expect(mapping.confidence).toBeGreaterThan(0.9);
    expect(mapping.sourceStartLine).toBeGreaterThan(0);
    expect(mapping.sourceEndLine).toBeGreaterThanOrEqual(mapping.sourceStartLine);
    expect(mapping.matchedValue).toBe("Start Free Trial");
    expect(mapping.projectId).toBe("project-1");
  });

  it("returns an unresolved record instead of guessing when no safe source value exists", () => {
    const mapping = resolveElementSourceMapping({
      route: "/",
      sourceFile: "src/app/page.tsx",
      sourceContent: "export default function Page(){ return <main />; }",
      selector: "button.missing",
      kind: "button",
      text: "Not present",
    });
    expect(mapping.strategy).toBe("unresolved");
    expect(mapping.sourceStartLine).toBe(0);
    expect(mapping.sourceEndLine).toBe(0);
    expect(mapping.confidence).toBe(0);
  });
});
