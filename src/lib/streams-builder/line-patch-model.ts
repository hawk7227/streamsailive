export type LinePatchOperationType =
  | "add_before"
  | "add_after"
  | "replace_range"
  | "delete_range"
  | "replace_full_file";

export type LinePatchOperation = {
  id: string;
  type: LinePatchOperationType;
  filePath: string;
  startLine: number;
  endLine?: number | null;
  content?: string;
  reason: string;
};

export type LinePatchRequest = {
  repository: string;
  branch: string;
  filePath: string;
  originalContent: string;
  operations: LinePatchOperation[];
  sourceTruthId?: string | null;
  checkpointId?: string | null;
  allowLargeReplacement?: boolean;
};

export type LinePatchPreview = {
  ok: boolean;
  filePath: string;
  originalContent: string;
  nextContent: string;
  operations: LinePatchOperation[];
  touchedLineRanges: Array<{ startLine: number; endLine: number; operationId: string; type: LinePatchOperationType }>;
  changedLineCount: number;
  isFullFileReplacement: boolean;
  canDownloadFullFile: boolean;
  canPushControlledPatch: boolean;
  errors: string[];
  audit: string[];
};

function splitLines(content: string) {
  return content.length ? content.split(/\r?\n/) : [];
}

function normalizeContent(content?: string) {
  return typeof content === "string" ? content.replace(/\r\n/g, "\n") : "";
}

function assertLineRange(lines: string[], operation: LinePatchOperation) {
  const total = lines.length;
  const start = operation.startLine;
  const end = operation.endLine ?? operation.startLine;

  if (!Number.isInteger(start) || start < 1) return `Operation ${operation.id} has an invalid startLine.`;
  if (!Number.isInteger(end) || end < start) return `Operation ${operation.id} has an invalid endLine.`;

  if (operation.type === "add_before" && start > total + 1) return `Operation ${operation.id} add_before startLine is beyond file length.`;
  if (operation.type === "add_after" && start > total) return `Operation ${operation.id} add_after startLine is beyond file length.`;
  if ((operation.type === "replace_range" || operation.type === "delete_range") && end > total) return `Operation ${operation.id} range exceeds file length.`;

  return null;
}

function countChangedLines(before: string, after: string) {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  return Math.abs(afterLines.length - beforeLines.length) + beforeLines.reduce((count, line, index) => count + (afterLines[index] !== line ? 1 : 0), 0);
}

export function createLineNumberedFile(content: string) {
  return splitLines(content).map((line, index) => ({ lineNumber: index + 1, content: line }));
}

export function applyLinePatchRequest(request: LinePatchRequest): LinePatchPreview {
  const errors: string[] = [];
  const audit: string[] = [];
  const originalContent = normalizeContent(request.originalContent);
  let lines = splitLines(originalContent);
  const sorted = [...request.operations].sort((left, right) => right.startLine - left.startLine);
  const touchedLineRanges: LinePatchPreview["touchedLineRanges"] = [];

  if (!request.repository.trim()) errors.push("Repository is required.");
  if (!request.branch.trim()) errors.push("Branch is required.");
  if (!request.filePath.trim()) errors.push("File path is required.");
  if (!Array.isArray(request.operations) || request.operations.length === 0) errors.push("At least one patch operation is required.");

  for (const operation of sorted) {
    if (operation.filePath !== request.filePath) {
      errors.push(`Operation ${operation.id} targets ${operation.filePath}, but request file is ${request.filePath}.`);
      continue;
    }

    const rangeError = operation.type === "replace_full_file" ? null : assertLineRange(lines, operation);
    if (rangeError) {
      errors.push(rangeError);
      continue;
    }

    const patchLines = splitLines(normalizeContent(operation.content));

    if (operation.type === "replace_full_file") {
      if (!request.allowLargeReplacement) {
        errors.push(`Operation ${operation.id} is a full-file replacement but allowLargeReplacement is false.`);
        continue;
      }
      touchedLineRanges.push({ startLine: 1, endLine: Math.max(lines.length, 1), operationId: operation.id, type: operation.type });
      audit.push(`replace_full_file ${request.filePath}: ${operation.reason}`);
      lines = patchLines;
      continue;
    }

    const startIndex = operation.startLine - 1;
    const endIndex = (operation.endLine ?? operation.startLine) - 1;

    if (operation.type === "add_before") {
      lines.splice(startIndex, 0, ...patchLines);
      touchedLineRanges.push({ startLine: operation.startLine, endLine: operation.startLine, operationId: operation.id, type: operation.type });
      audit.push(`add_before line ${operation.startLine}: ${operation.reason}`);
    }

    if (operation.type === "add_after") {
      lines.splice(startIndex + 1, 0, ...patchLines);
      touchedLineRanges.push({ startLine: operation.startLine, endLine: operation.startLine, operationId: operation.id, type: operation.type });
      audit.push(`add_after line ${operation.startLine}: ${operation.reason}`);
    }

    if (operation.type === "replace_range") {
      lines.splice(startIndex, endIndex - startIndex + 1, ...patchLines);
      touchedLineRanges.push({ startLine: operation.startLine, endLine: operation.endLine ?? operation.startLine, operationId: operation.id, type: operation.type });
      audit.push(`replace_range lines ${operation.startLine}-${operation.endLine ?? operation.startLine}: ${operation.reason}`);
    }

    if (operation.type === "delete_range") {
      lines.splice(startIndex, endIndex - startIndex + 1);
      touchedLineRanges.push({ startLine: operation.startLine, endLine: operation.endLine ?? operation.startLine, operationId: operation.id, type: operation.type });
      audit.push(`delete_range lines ${operation.startLine}-${operation.endLine ?? operation.startLine}: ${operation.reason}`);
    }
  }

  const nextContent = lines.join("\n");
  const isFullFileReplacement = request.operations.some((operation) => operation.type === "replace_full_file");
  const changedLineCount = countChangedLines(originalContent, nextContent);
  const canPushControlledPatch = errors.length === 0 && Boolean(request.sourceTruthId) && Boolean(request.checkpointId);

  return {
    ok: errors.length === 0,
    filePath: request.filePath,
    originalContent,
    nextContent,
    operations: request.operations,
    touchedLineRanges,
    changedLineCount,
    isFullFileReplacement,
    canDownloadFullFile: errors.length === 0,
    canPushControlledPatch,
    errors,
    audit: [
      ...audit,
      canPushControlledPatch
        ? "Controlled patch is eligible for push after preview/proof gates pass."
        : "Push blocked until sourceTruthId and checkpointId are present.",
    ],
  };
}
