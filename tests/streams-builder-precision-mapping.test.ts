import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveElementSourceMapping } from "../src/lib/streams-builder/element-source-mapping";
import { planMinimalLinePatch } from "../src/lib/streams-builder/line-patch-planner";

const filePath = "src/app/example/page.tsx";

describe("builder precise mapping and patch planning", () => {
  it("plans one exact replace_range for a bounded edit", () => {
    const original = ["export default function Page() {", "  return <h1>Old title</h1>;", "}"].join("\n");
    const next = ["export default function Page() {", "  return <h1>New title</h1>;", "}"].join("\n");
    const plan = planMinimalLinePatch(filePath, original, next);
    expect(plan.strategy).toBe("replace_range");
    expect(plan.operations).toHaveLength(1);
    expect(plan.operations[0]).toMatchObject({ type: "replace_range", startLine: 2, endLine: 2, content: "  return <h1>New title</h1>;" });
  });

  it("plans insertion and deletion without replacing the whole file", () => {
    const insertion = planMinimalLinePatch(filePath, "a\nc", "a\nb\nc");
    expect(insertion.strategy).toBe("add_after");
    expect(insertion.operations[0]).toMatchObject({ type: "add_after", startLine: 1, content: "b" });

    const deletion = planMinimalLinePatch(filePath, "a\nb\nc", "a\nc");
    expect(deletion.strategy).toBe("delete_range");
    expect(deletion.operations[0]).toMatchObject({ type: "delete_range", startLine: 2, endLine: 2 });
  });

  it("retains controlled full-file fallback for unsafe very large edits", () => {
    const original = Array.from({ length: 700 }, (_, index) => `before-${index}`).join("\n");
    const next = Array.from({ length: 700 }, (_, index) => `after-${index}`).join("\n");
    const plan = planMinimalLinePatch(filePath, original, next);
    expect(plan.strategy).toBe("replace_full_file");
    expect(plan.operations[0].type).toBe("replace_full_file");
  });

  it("maps a uniquely selected frontend value to a bounded source node", () => {
    const source = [
      "export default function Page() {",
      "  return (",
      "    <main>",
      "      <button className=\"primary\">Start Free Trial</button>",
      "    </main>",
      "  );",
      "}",
    ].join("\n");
    const mapping = resolveElementSourceMapping({ route: "/", sourceFile: filePath, sourceContent: source, selector: "button.primary", kind: "button", text: "Start Free Trial" });
    expect(mapping.strategy).toBe("exact-unique");
    expect(mapping.confidence).toBeGreaterThan(0.9);
    expect(mapping.sourceStartLine).toBeGreaterThan(0);
    expect(mapping.sourceEndLine).toBeGreaterThanOrEqual(mapping.sourceStartLine);
    expect(mapping.matchedValue).toBe("Start Free Trial");
  });

  it("mounts the compatibility bridge and keeps both fallback systems", () => {
    const shell = readFileSync(resolve(process.cwd(), "src/components/streams-workspace/ProjectWorkspaceShell.tsx"), "utf8");
    const bridge = readFileSync(resolve(process.cwd(), "src/components/streams-workspace/BuilderPrecisionCompatibilityBridge.tsx"), "utf8");
    expect(shell).toContain("<BuilderPrecisionCompatibilityBridge />");
    expect(bridge).toContain("planMinimalLinePatch");
    expect(bridge).toContain("full-file replacement remains available as fallback");
    expect(bridge).toContain("Existing visual-to-code lookup remains authoritative fallback");
  });
});
