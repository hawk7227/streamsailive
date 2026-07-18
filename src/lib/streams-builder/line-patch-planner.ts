import type { LinePatchOperation } from "./line-patch-model";

function lines(value: string) {
  return String(value || "").replace(/\r\n/g, "\n").split("\n");
}

export type PlannedLinePatch = {
  operations: LinePatchOperation[];
  strategy: "unchanged" | "replace_range" | "add_before" | "add_after" | "delete_range" | "replace_full_file";
  changedStartLine: number;
  changedEndLine: number;
};

export function planMinimalLinePatch(filePath: string, originalContent: string, nextContent: string): PlannedLinePatch {
  if (originalContent === nextContent) {
    return { operations: [], strategy: "unchanged", changedStartLine: 0, changedEndLine: 0 };
  }

  const before = lines(originalContent);
  const after = lines(nextContent);
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) suffix += 1;

  const removed = before.slice(prefix, before.length - suffix);
  const inserted = after.slice(prefix, after.length - suffix);
  const startLine = prefix + 1;
  const endLine = Math.max(startLine, before.length - suffix);
  const id = `precise-${Date.now()}`;

  if (!removed.length && inserted.length) {
    if (prefix === 0) {
      return { operations: [{ id, type: "add_before", filePath, startLine: 1, content: inserted.join("\n"), reason: "Precise visual/code draft insertion" }], strategy: "add_before", changedStartLine: 1, changedEndLine: 1 };
    }
    return { operations: [{ id, type: "add_after", filePath, startLine: prefix, content: inserted.join("\n"), reason: "Precise visual/code draft insertion" }], strategy: "add_after", changedStartLine: prefix, changedEndLine: prefix };
  }

  if (removed.length && !inserted.length) {
    return { operations: [{ id, type: "delete_range", filePath, startLine, endLine, reason: "Precise visual/code draft deletion" }], strategy: "delete_range", changedStartLine: startLine, changedEndLine: endLine };
  }

  if (removed.length <= 500 && inserted.length <= 500) {
    return { operations: [{ id, type: "replace_range", filePath, startLine, endLine, content: inserted.join("\n"), reason: "Precise visual/code draft replacement" }], strategy: "replace_range", changedStartLine: startLine, changedEndLine: endLine };
  }

  return {
    operations: [{ id, type: "replace_full_file", filePath, startLine: 1, endLine: 1, content: nextContent, reason: "Controlled full-file fallback because the safe precise range exceeded 500 lines" }],
    strategy: "replace_full_file",
    changedStartLine: 1,
    changedEndLine: Math.max(before.length, 1),
  };
}
