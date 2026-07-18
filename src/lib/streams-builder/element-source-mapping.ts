export type ElementSourceMappingInput = {
  projectId?: string;
  route: string;
  sourceFile: string;
  sourceContent: string;
  selector?: string;
  kind?: string;
  original?: string;
  text?: string;
  src?: string;
  parentLayerId?: string;
  childLayerIds?: string[];
};

export type ElementSourceMapping = {
  elementMappingId: string;
  projectId: string;
  route: string;
  componentName: string;
  sourceFile: string;
  sourceStartLine: number;
  sourceEndLine: number;
  astNodePath: string;
  cssSelector: string;
  elementSignature: string;
  parentMappingId: string | null;
  childMappingIds: string[];
  confidence: number;
  matchedValue: string;
  strategy: "exact-unique" | "exact-first" | "selector-token" | "unresolved";
};

function lineAt(content: string, offset: number) {
  return content.slice(0, Math.max(0, offset)).split(/\r?\n/).length;
}

function componentName(filePath: string) {
  return filePath.split("/").pop()?.replace(/\.(tsx|jsx|ts|js)$/i, "") || "Unknown";
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
}

function candidates(input: ElementSourceMappingInput) {
  const values = [input.original, input.text, input.src]
    .map((value) => String(value || "").trim())
    .filter((value) => value.length > 1 && value.length < 2000);
  return Array.from(new Set(values)).sort((left, right) => right.length - left.length);
}

function selectorTokens(selector?: string) {
  return String(selector || "")
    .split(/[\s>+~.#:[\]=()"']+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !/^(div|span|section|main|body|html|nth-child)$/i.test(token));
}

function nearestNodeRange(content: string, offset: number) {
  const line = lineAt(content, offset);
  const rows = content.split(/\r?\n/);
  let start = Math.max(1, line);
  let end = Math.max(1, line);
  for (let current = line - 1; current >= 0 && current >= line - 20; current -= 1) {
    if (/<[A-Za-z][^>]*>/.test(rows[current] || "")) { start = current + 1; break; }
  }
  for (let current = line - 1; current < rows.length && current <= line + 30; current += 1) {
    if (/<\/[A-Za-z][^>]*>/.test(rows[current] || "") || /\/>/.test(rows[current] || "")) { end = current + 1; break; }
  }
  return { start, end: Math.max(start, end) };
}

export function resolveElementSourceMapping(input: ElementSourceMappingInput): ElementSourceMapping {
  const source = String(input.sourceContent || "");
  let offset = -1;
  let matchedValue = "";
  let strategy: ElementSourceMapping["strategy"] = "unresolved";
  let confidence = 0;

  for (const value of candidates(input)) {
    const first = source.indexOf(value);
    if (first < 0) continue;
    offset = first;
    matchedValue = value;
    strategy = source.indexOf(value, first + value.length) < 0 ? "exact-unique" : "exact-first";
    confidence = strategy === "exact-unique" ? 0.98 : 0.72;
    break;
  }

  if (offset < 0) {
    for (const token of selectorTokens(input.selector)) {
      const found = source.indexOf(token);
      if (found < 0) continue;
      offset = found;
      matchedValue = token;
      strategy = "selector-token";
      confidence = 0.48;
      break;
    }
  }

  const range = offset >= 0 ? nearestNodeRange(source, offset) : { start: 0, end: 0 };
  const signatureSource = [input.route, input.sourceFile, input.selector, input.kind, matchedValue, range.start, range.end].join("|");
  return {
    elementMappingId: `map-${hash(signatureSource)}`,
    projectId: String(input.projectId || ""),
    route: String(input.route || "/"),
    componentName: componentName(input.sourceFile),
    sourceFile: input.sourceFile,
    sourceStartLine: range.start,
    sourceEndLine: range.end,
    astNodePath: range.start ? `${componentName(input.sourceFile)}:${range.start}-${range.end}` : "",
    cssSelector: String(input.selector || ""),
    elementSignature: hash(signatureSource),
    parentMappingId: input.parentLayerId ? `layer-${hash(input.parentLayerId)}` : null,
    childMappingIds: (input.childLayerIds || []).map((id) => `layer-${hash(id)}`),
    confidence,
    matchedValue,
    strategy,
  };
}
