import { describe, expect, it } from "vitest";
import { applyLinePatchRequest } from "../line-patch-model";
import { SAFE_VISUAL_EDITOR_BUILD_ORDER, VISUAL_EDITOR_BUILD_GROUPS } from "../visual-editor-build-groups";

describe("visual editor robust build groups", () => {
  it("covers every build item from 1 through 15 exactly once", () => {
    const ids = VISUAL_EDITOR_BUILD_GROUPS.flatMap((group) => group.items.map((item) => item.id)).sort((a, b) => a - b);

    expect(ids).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
    expect(new Set(ids).size).toBe(15);
  });

  it("keeps the safe grouped build order aligned with the registered groups", () => {
    expect(SAFE_VISUAL_EDITOR_BUILD_ORDER).toEqual(VISUAL_EDITOR_BUILD_GROUPS.map((group) => group.id));
  });

  it("contains real implementation metadata for every item", () => {
    for (const group of VISUAL_EDITOR_BUILD_GROUPS) {
      expect(group.title.trim().length).toBeGreaterThan(4);
      expect(group.safeBuildReason.trim().length).toBeGreaterThan(20);
      expect(group.nextActions.length).toBeGreaterThan(0);

      for (const item of group.items) {
        expect(item.title.trim().length).toBeGreaterThan(4);
        expect(item.limitation.trim().length).toBeGreaterThan(10);
        expect(item.robustTarget.trim().length).toBeGreaterThan(10);
        expect(["done", "started", "needs_backend", "needs_mapping", "planned"]).toContain(item.status);
      }
    }
  });
});

describe("visual editor patch model compatibility", () => {
  const originalContent = [
    "export default function Page() {",
    "  return (",
    "    <main>",
    "      <section className=\"card\">Old panel</section>",
    "      <p>Old text</p>",
    "    </main>",
    "  );",
    "}",
  ].join("\n");

  it("supports replace_range for text/component updates", () => {
    const preview = applyLinePatchRequest({
      repository: "hawk7227/patientpanel",
      branch: "master",
      filePath: "src/app/page.tsx",
      originalContent,
      sourceTruthId: "source-proof",
      checkpointId: "checkpoint-proof",
      operations: [
        {
          id: "replace-text",
          type: "replace_range",
          filePath: "src/app/page.tsx",
          startLine: 5,
          endLine: 5,
          content: "      <p>New text</p>",
          reason: "Visual editor text replacement",
        },
      ],
    });

    expect(preview.ok).toBe(true);
    expect(preview.canPushControlledPatch).toBe(true);
    expect(preview.nextContent).toContain("New text");
  });

  it("supports delete_range for panel removal", () => {
    const preview = applyLinePatchRequest({
      repository: "hawk7227/patientpanel",
      branch: "master",
      filePath: "src/app/page.tsx",
      originalContent,
      sourceTruthId: "source-proof",
      checkpointId: "checkpoint-proof",
      operations: [
        {
          id: "delete-panel",
          type: "delete_range",
          filePath: "src/app/page.tsx",
          startLine: 4,
          endLine: 4,
          reason: "Visual editor panel removal",
        },
      ],
    });

    expect(preview.ok).toBe(true);
    expect(preview.canPushControlledPatch).toBe(true);
    expect(preview.nextContent).not.toContain("Old panel");
  });

  it("supports replace_full_file only when large replacement is explicitly allowed", () => {
    const preview = applyLinePatchRequest({
      repository: "hawk7227/patientpanel",
      branch: "master",
      filePath: "src/app/page.tsx",
      originalContent,
      sourceTruthId: "source-proof",
      checkpointId: "checkpoint-proof",
      allowLargeReplacement: true,
      operations: [
        {
          id: "replace-full-file",
          type: "replace_full_file",
          filePath: "src/app/page.tsx",
          startLine: 1,
          endLine: 1,
          content: "export default function Page() { return <main>Approved visual draft</main>; }",
          reason: "Approved visual editor full-file fallback",
        },
      ],
    });

    expect(preview.ok).toBe(true);
    expect(preview.canPushControlledPatch).toBe(true);
    expect(preview.nextContent).toContain("Approved visual draft");
  });
});
