import type { VisualEditOperation, VisualPatchMapperResult, VisualTarget } from "./visual-edit-operations";

function stripOrigin(value?: string) {
  try {
    const url = new URL(value || "");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return value || "";
  }
}

function targetNeedles(target: VisualTarget) {
  const values = [target.original, target.textFingerprint, target.src, stripOrigin(target.src), target.className]
    .map((value) => String(value || "").trim())
    .filter((value) => value.length > 2);
  return Array.from(new Set(values));
}

function replaceFirstNeedle(content: string, target: VisualTarget, next: string) {
  for (const needle of targetNeedles(target)) {
    if (content.includes(needle)) return content.replace(needle, next);
  }
  return content;
}

function scoreLine(line: string, target: VisualTarget) {
  const lower = line.toLowerCase();
  return targetNeedles(target).reduce((score, needle) => score + (lower.includes(needle.toLowerCase()) ? 1 : 0), 0);
}

function findBestLine(lines: string[], target: VisualTarget) {
  let bestIndex = -1;
  let bestScore = 0;
  lines.forEach((line, index) => {
    const score = scoreLine(line, target);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });
  return bestScore > 0 ? bestIndex : -1;
}

function tagNameFromLine(line: string) {
  return line.match(/<([A-Za-z][\w.]*)\b/)?.[1] || "";
}

function openCount(line: string, tag: string) {
  const safe = tag.replace(/\./g, "\\.");
  return (line.match(new RegExp(`<${safe}\\b(?![^>]*\\/>)`, "g")) || []).length;
}

function closeCount(line: string, tag: string) {
  const safe = tag.replace(/\./g, "\\.");
  return (line.match(new RegExp(`</${safe}\\s*>`, "g")) || []).length;
}

function findMatchingEnd(lines: string[], start: number, tag: string) {
  let depth = 0;
  for (let index = start; index < lines.length; index += 1) {
    depth += openCount(lines[index], tag);
    depth -= closeCount(lines[index], tag);
    if (depth <= 0 && index > start) return index;
  }
  return start;
}

function removeNodeBlock(content: string, target: VisualTarget) {
  const lines = content.split("\n");
  const best = findBestLine(lines, target);
  if (best < 0) return replaceFirstNeedle(content, target, "");
  for (let start = best; start >= Math.max(0, best - 100); start -= 1) {
    const line = lines[start];
    const tag = tagNameFromLine(line);
    if (!tag) continue;
    if (!/<(div|section|article|aside|li|header|footer|main|Image|img|video|button)\b/.test(line)) continue;
    const end = findMatchingEnd(lines, start, tag);
    if (end < best) continue;
    if (end - start > Math.max(140, lines.length * 0.4)) continue;
    return [...lines.slice(0, start), ...lines.slice(end + 1)].join("\n");
  }
  return replaceFirstNeedle(content, target, "");
}

function insertNode(content: string, target: VisualTarget, jsx: string, position: "inside" | "before" | "after") {
  const lines = content.split("\n");
  const best = findBestLine(lines, target);
  if (best < 0) return `${content}\n${jsx}`;
  if (position === "before") {
    lines.splice(best, 0, jsx);
    return lines.join("\n");
  }
  if (position === "after") {
    lines.splice(best + 1, 0, jsx);
    return lines.join("\n");
  }
  lines.splice(best + 1, 0, jsx);
  return lines.join("\n");
}

function styleObject(style: Record<string, unknown>) {
  const entries = Object.entries(style).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");
  if (!entries.length) return "";
  return `{{ ${entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(", ")} }}`;
}

function updateStyle(content: string, target: VisualTarget, style: Record<string, unknown>) {
  const styleText = styleObject(style);
  if (!styleText) return content;
  const lines = content.split("\n");
  const best = findBestLine(lines, target);
  if (best < 0) return content;
  let start = best;
  while (start > 0 && !/<[A-Za-z]/.test(lines[start])) start -= 1;
  if (lines[start].includes("style=")) return content;
  lines[start] = lines[start].replace(/<([A-Za-z][^\s/>]*)(\s|>)/, `<$1 style=${styleText}$2`);
  return lines.join("\n");
}

export function applyVisualOperationToSource(content: string, operation: VisualEditOperation): VisualPatchMapperResult {
  let next = content;
  let summary: string = operation.type;

  if (operation.type === "text.update") {
    next = replaceFirstNeedle(content, operation.target, operation.value);
    summary = "Updated selected text.";
  }

  if (operation.type === "asset.replace") {
    next = replaceFirstNeedle(content, operation.target, operation.asset.src);
    summary = `Replaced ${operation.asset.kind} asset.`;
  }

  if (operation.type === "style.update") {
    next = updateStyle(content, operation.target, operation.style);
    summary = "Updated selected component style.";
  }

  if (operation.type === "node.resize") {
    next = updateStyle(content, operation.target, { width: `${operation.width}px`, height: `${operation.height}px` });
    summary = "Resized selected component.";
  }

  if (operation.type === "node.move") {
    next = updateStyle(content, operation.target, { position: "relative", left: `${operation.x}px`, top: `${operation.y}px` });
    summary = "Moved selected component.";
  }

  if (operation.type === "node.rotate") {
    next = updateStyle(content, operation.target, { transform: `rotate(${operation.rotate}deg)` });
    summary = "Rotated selected component.";
  }

  if (operation.type === "node.delete") {
    next = removeNodeBlock(content, operation.target);
    summary = "Deleted selected component block.";
  }

  if (operation.type === "node.insert") {
    next = insertNode(content, operation.target, operation.componentTemplate.defaultJsx, operation.position);
    summary = `Inserted ${operation.componentTemplate.label}.`;
  }

  if (operation.type === "node.duplicate") {
    const needles = targetNeedles(operation.target);
    const first = needles.find((needle) => content.includes(needle));
    next = first ? content.replace(first, `${first}\n${first}`) : content;
    summary = "Duplicated selected component fallback.";
  }

  return {
    ok: next !== content,
    content: next,
    operation,
    summary,
    sourceFound: next !== content,
  };
}
