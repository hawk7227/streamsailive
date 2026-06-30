export type SourceFileSnapshot = { path: string; content: string; route?: string; repo?: string; branch?: string; sha?: string };
export type VisualSelection = {
  selectionId?: string;
  tag?: string;
  text?: string;
  href?: string;
  imageSrc?: string;
  selector?: string;
  sourceFile?: string;
  component?: string;
  symbol?: string;
  itemKey?: string;
  operationTarget?: string;
  parentText?: string;
  nearbyHeading?: string;
  route?: string;
};
export type GraphItem = {
  key: string;
  file: string;
  component?: string;
  arrayName?: string;
  itemIndex?: number;
  text: string[];
  image?: string;
  href?: string;
  range: { startLine: number; endLine: number; start: number; end: number };
};
export type SourceGraph = { files: SourceFileSnapshot[]; items: GraphItem[]; components: Record<string, { file: string; imports: string[] }> };
export type ResolvedSelection = { confidence: number; reasons: string[]; item?: GraphItem; sourceFile?: string; component?: string; targetType: string; safeOperations: string[] };
export type PatchResult = { file: string; before: string; after: string; patch: string; operation: string; verification: Record<string, unknown> };

function linesUntil(text: string, index: number) {
  return text.slice(0, Math.max(0, index)).split("\n").length;
}

function splitTopLevelObjects(arrayBody: string) {
  const objects: Array<{ text: string; start: number; end: number }> = [];
  let depth = 0;
  let start = -1;
  let quote = "";
  let escaped = false;
  for (let i = 0; i < arrayBody.length; i++) {
    const ch = arrayBody[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") { if (depth === 0) start = i; depth++; }
    if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) { objects.push({ text: arrayBody.slice(start, i + 1), start, end: i + 1 }); start = -1; }
    }
  }
  return objects;
}

function literalValue(objectText: string, key: string) {
  const re = new RegExp(`${key}\\s*:\\s*([\"'\`])([\\s\\S]*?)\\1`, "m");
  const match = objectText.match(re);
  return match?.[2]?.trim() || "";
}

function textValues(objectText: string) {
  const keys = ["title", "accent", "subtext", "body", "cta", "label", "name", "heading", "alt"];
  return keys.map((key) => literalValue(objectText, key)).filter(Boolean);
}

function importNames(content: string) {
  return [...content.matchAll(/import\s+([A-Za-z0-9_{}*,\s]+)\s+from\s+["']([^"']+)["']/g)].map((m) => `${m[1]} from ${m[2]}`);
}

export function buildSourceGraph(files: SourceFileSnapshot[]): SourceGraph {
  const items: GraphItem[] = [];
  const components: SourceGraph["components"] = {};
  for (const file of files) {
    const content = file.content || "";
    const exports = [...content.matchAll(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]);
    for (const name of exports) components[name] = { file: file.path, imports: importNames(content) };
    const arrayMatches = [...content.matchAll(/(?:const|let|var)\s+([A-Z][A-Z0-9_]*|[A-Za-z0-9_]*CARDS[A-Za-z0-9_]*)\s*[:\w\s<>\[\],]*=\s*\[/g)];
    for (const match of arrayMatches) {
      const arrayName = match[1];
      const bodyStart = (match.index || 0) + match[0].length;
      let depth = 1, quote = "", escaped = false, end = bodyStart;
      for (; end < content.length; end++) {
        const ch = content[end];
        if (quote) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === quote) quote = ""; continue; }
        if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
        if (ch === "[") depth++;
        if (ch === "]") { depth--; if (depth === 0) break; }
      }
      const body = content.slice(bodyStart, end);
      splitTopLevelObjects(body).forEach((obj, index) => {
        const absoluteStart = bodyStart + obj.start;
        const absoluteEnd = bodyStart + obj.end;
        const href = literalValue(obj.text, "href");
        const image = literalValue(obj.text, "img") || literalValue(obj.text, "src");
        const text = textValues(obj.text);
        if (!text.length && !href && !image) return;
        items.push({
          key: href || image || text.join(" ") || `${arrayName}:${index}`,
          file: file.path,
          arrayName,
          itemIndex: index,
          text,
          image,
          href,
          range: { startLine: linesUntil(content, absoluteStart), endLine: linesUntil(content, absoluteEnd), start: absoluteStart, end: absoluteEnd },
        });
      });
    }
  }
  return { files, items, components };
}

function includes(haystack = "", needle = "") {
  const h = String(haystack || "").toLowerCase();
  const n = String(needle || "").toLowerCase().trim();
  return Boolean(n && h.includes(n));
}

export function resolveSelection(graph: SourceGraph, selection: VisualSelection): ResolvedSelection {
  const reasons: string[] = [];
  let best: { item: GraphItem; score: number; reasons: string[] } | null = null;
  for (const item of graph.items) {
    let score = 0;
    const local: string[] = [];
    const allText = item.text.join(" ");
    if (selection.sourceFile && selection.sourceFile === item.file) { score += 25; local.push("source file fingerprint matched"); }
    if (selection.symbol && selection.symbol === item.arrayName) { score += 18; local.push("data symbol fingerprint matched"); }
    if (selection.itemKey && (selection.itemKey === item.key || selection.itemKey === item.href)) { score += 20; local.push("item key matched"); }
    if (selection.href && item.href && selection.href.includes(item.href)) { score += 18; local.push("href matched"); }
    if (selection.imageSrc && item.image && selection.imageSrc.includes(item.image)) { score += 18; local.push("image src matched"); }
    for (const t of item.text) {
      if (includes(selection.text, t) || includes(selection.parentText, t) || includes(selection.nearbyHeading, t)) { score += 8; local.push(`text matched: ${t}`); }
    }
    if (!best || score > best.score) best = { item, score, reasons: local };
  }
  if (best && best.score > 0) {
    const confidence = Math.min(99, best.score);
    return { confidence, reasons: best.reasons, item: best.item, sourceFile: best.item.file, targetType: best.item.arrayName ? "array-item" : "jsx-node", safeOperations: ["remove-selection", "edit-text", "replace-image", "change-style"] };
  }
  if (selection.sourceFile) reasons.push("source file fingerprint exists but no exact data item was found");
  return { confidence: selection.sourceFile ? 62 : 28, reasons, sourceFile: selection.sourceFile, component: selection.component, targetType: selection.operationTarget || "unknown", safeOperations: [] };
}

function unifiedPatch(path: string, before: string, after: string) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  return [`--- a/${path}`, `+++ b/${path}`, `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`, ...afterLines.map((line) => ` ${line}`)].join("\n");
}

function removeObjectAt(content: string, range: GraphItem["range"]) {
  let start = range.start;
  let end = range.end;
  while (end < content.length && /[\s,]/.test(content[end] || "")) end++;
  if (content[end - 1] !== ",") {
    let cursor = start - 1;
    while (cursor >= 0 && /\s/.test(content[cursor] || "")) cursor--;
    if (content[cursor] === ",") start = cursor;
  }
  return content.slice(0, start) + content.slice(end);
}

export function planVisualEdit(files: SourceFileSnapshot[], selection: VisualSelection, command = "remove this") {
  const graph = buildSourceGraph(files);
  const resolved = resolveSelection(graph, selection);
  const normalizedCommand = command.toLowerCase();
  if (!/remove|delete|hide/.test(normalizedCommand)) return { graph, resolved, patches: [], error: "Only remove/delete operations are enabled for the first guarded patch engine." };
  if (!resolved.item || resolved.confidence < 80) return { graph, resolved, patches: [], error: "Selection confidence is too low for automatic patching." };
  const file = files.find((f) => f.path === resolved.item?.file);
  if (!file) return { graph, resolved, patches: [], error: "Source file was not provided." };
  const before = file.content;
  const after = removeObjectAt(before, resolved.item.range);
  const removedText = resolved.item.text.join(" ");
  const verification = {
    selectedTextBefore: removedText ? before.includes(resolved.item.text[0] || removedText) : true,
    selectedTextAfter: removedText ? !after.includes(resolved.item.text[0] || removedText) : true,
    sourceFile: file.path,
    confidence: resolved.confidence,
    reasons: resolved.reasons,
  };
  const patch: PatchResult = { file: file.path, before, after, patch: unifiedPatch(file.path, before, after), operation: "remove-array-item", verification };
  return { graph, resolved, patches: [patch], error: "" };
}
