import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveElementSourceMapping } from "../src/lib/streams-builder/element-source-mapping";
import { planMinimalLinePatch } from "../src/lib/streams-builder/line-patch-planner";

const filePath = "src/app/example/page.tsx";

describe("builder precise mapping and patch planning", () => {
  it("uses a bounded range operation for a small edit", () => {
    const original = ["export default function Page() {", "  return <h1>Old title</h1>;", "}"].join("\n");
    const next = ["export default function Page() {", "  return <h1>New title</h1>;", "}"].join("\n");
    const plan = planMinimalLinePatch(filePath, original, next);
    expect(plan.operations).toHaveLength(1);
    expect(plan.operations[0].type).not.toBe("replace_full_file");
    expect(plan.changedStartLine).toBeGreaterThan(0);
    expect(plan.changedEndLine).toBeGreaterThanOrEqual(plan.changedStartLine);
  });

  it("retains the controlled full-file fallback for a very large unsafe edit", () => {
    const original = Array.from({ length: 700 }, (_, index) => `before-${index}`).join("\n");
    const next = Array.from({ length: 700 }, (_, index) => `after-${index}`).join("\n");
    const plan = planMinimalLinePatch(filePath, original, next);
    expect(plan.operations).toHaveLength(1);
    expect(plan.operations[0].type).toBe("replace_full_file");
  });

  it("maps a uniquely selected frontend value back to its source file", () => {
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
    expect(mapping.sourceFile).toBe(filePath);
    expect(mapping.sourceStartLine).toBeGreaterThan(0);
    expect(mapping.matchedValue).toBe("Start Free Trial");
  });

  it("mounts the compatibility bridge while preserving both fallbacks", () => {
    const shell = readFileSync(resolve(process.cwd(), "src/components/streams-workspace/ProjectWorkspaceShell.tsx"), "utf8");
    const bridge = readFileSync(resolve(process.cwd(), "src/components/streams-workspace/BuilderPrecisionCompatibilityBridge.tsx"), "utf8");
    expect(shell).toContain("BuilderPrecisionCompatibilityBridge");
    expect(bridge).toContain("planMinimalLinePatch");
    expect(bridge).toContain("fallback");
  });
});
